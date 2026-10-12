// 纸箱寻猫小游戏界面：看猫躲进哪个箱子 → 箱子互换 → 点出猫在的那个。规则在 game/boxcat.ts。
import { MAX_ROUND, consolation, gamesLeft, makeRound, recordFound, rewardFor, useGame } from '../../game/boxcat';
import type { Round } from '../../game/boxcat';
import { gainText } from '../../game/explore';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const BOXCAT_CSS = `
.bc-stage{position:relative;height:96px;margin:26px 0 4px}
.bc-box{position:absolute;top:22px;width:58px;height:54px;margin-left:-29px;border-radius:6px;background:linear-gradient(#c98a4a,#a8693a);border:2px solid #6a4020;box-shadow:0 3px 0 rgba(0,0,0,.35);transition:left .3s,transform .25s;cursor:pointer;color:#fff}
.bc-box::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:10px;margin-left:-5px;background:rgba(240,220,170,.55)}
.bc-box.up{transform:translateY(-26px)}
.bc-box.dim{opacity:.55;pointer-events:none}
.bc-box.pick{outline:3px solid #ffe27a}
.bc-cat{position:absolute;left:50%;top:-20px;width:30px;height:24px;margin-left:-15px;border-radius:50% 50% 40% 40%;background:#ff9a4a;border:2px solid #7a4018;font-size:11px;line-height:20px;text-align:center;font-weight:900;color:#3a1a08;opacity:0;transition:opacity .15s}
.bc-cat::before,.bc-cat::after{content:"";position:absolute;top:-8px;border:6px solid transparent;border-bottom:8px solid #ff9a4a}
.bc-cat::before{left:-2px}.bc-cat::after{right:-2px}
.bc-box.up .bc-cat,.bc-box.show .bc-cat{opacity:1}
.bc-streak{font-weight:800;font-size:13px;color:#c9b8e8}
`;

type Phase = 'idle' | 'watch' | 'shuffle' | 'pick' | 'decide' | 'over';
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 打开纸箱寻猫；玩家点「收摊」后结束。 */
export function openBoxCat(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>纸箱寻猫</h3><div class="fish-status"></div><div class="bc-stage"></div><div class="bc-streak"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-bc="main">开始</button><button class="btn blue" data-bc="cash" style="display:none">收手领奖</button><button class="btn ghost" data-bc="close">收摊</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const status = q<HTMLElement>('.fish-status'), stage = q<HTMLElement>('.bc-stage'), streakEl = q<HTMLElement>('.bc-streak'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-bc="main"]'), cash = q<HTMLButtonElement>('[data-bc="cash"]');
    let phase: Phase = 'idle', streak = 0, rd: Round, alive = true;
    let boxes: HTMLElement[] = [], slotOf: number[] = [];

    const refresh = () => { info.textContent = `今天还能玩 ${gamesLeft(ctx.s)} 局`; streakEl.textContent = streak > 0 ? `连胜 ${streak}/${MAX_ROUND} · 现在收手可得 ${gainText(rewardFor(ctx.s, streak))}` : ''; };
    const say = (t: string) => { status.innerHTML = t; };
    const place = () => boxes.forEach((b, i) => { b.style.left = `${((slotOf[i] + 0.5) / rd.boxes) * 100}%`; });
    const build = (r: Round) => {
      rd = r; stage.innerHTML = ''; slotOf = Array.from({ length: r.boxes }, (_, i) => i);
      boxes = slotOf.map((i) => { const b = document.createElement('div'); b.className = 'bc-box'; b.dataset.box = String(i); if (i === r.cat) b.dataset.cat = '1'; b.innerHTML = '<span class="bc-cat">猫</span>'; stage.appendChild(b); return b; });
      boxes.forEach((b) => { b.style.transitionDuration = `${r.stepMs * 0.8}ms`; });
      place();
    };
    const idle = () => {
      phase = 'idle'; refresh(); cash.style.display = 'none'; main.style.display = '';
      const left = gamesLeft(ctx.s) > 0;
      main.disabled = !left; main.textContent = left ? '开始' : '今天玩够啦';
      say(left ? '猫猫躲进纸箱里了。看清它在哪个箱子，箱子换位置后把它找出来！' : '猫猫都玩累了，明早 5 点再来');
      stage.innerHTML = '';
    };
    const startGame = () => { if (!useGame(ctx.s)) { idle(); return; } ctx.save(); streak = 0; void playRound(1); };
    const playRound = async (n: number) => {
      build(makeRound(n, Math.random)); cash.style.display = 'none'; main.style.display = 'none'; refresh();
      phase = 'watch'; say(`第 ${n} 轮 · 看好，猫猫在这里！`);
      boxes[rd.cat].classList.add('up'); await wait(1100); if (!alive) return;
      boxes[rd.cat].classList.remove('up'); await wait(350); if (!alive) return;
      phase = 'shuffle'; say('换位置啦…盯紧！');
      for (const [a, b] of rd.swaps) {
        const ia = slotOf.indexOf(a), ib = slotOf.indexOf(b);
        slotOf[ia] = b; slotOf[ib] = a; place();
        await wait(rd.stepMs); if (!alive) return;
      }
      phase = 'pick'; say('猫猫在哪个箱子里？');
    };
    const pickBox = async (el: HTMLElement) => {
      if (phase !== 'pick') return;
      phase = 'decide';
      boxes.forEach((b) => b.classList.add('dim'));
      el.classList.remove('dim'); el.classList.add('pick');
      const right = el.dataset.cat === '1';
      boxes[rd.cat].classList.remove('dim'); boxes[rd.cat].classList.add('show', 'up');
      if (right) {
        streak++; recordFound(ctx.s); sfx.coin(); ctx.save();
        if (streak >= MAX_ROUND) { await bank(true); return; }
        say(`找到啦！连胜 ${streak}。<br><small>继续挑战奖励更高，但猜错只能拿走一半。</small>`);
        refresh(); main.style.display = ''; main.disabled = false; main.textContent = '继续挑战'; cash.style.display = '';
      } else {
        sfx.no();
        const g = consolation(ctx.s, streak);
        if (streak > 0) { applyGain(ctx.s, g); ctx.save(); }
        say(`猜错啦，猫猫在这儿。<br>${streak > 0 ? `<small>拿走一半：${gainText(g)}</small>` : '<small>这局没有收入</small>'}`);
        streak = 0; refresh(); phase = 'over'; main.style.display = ''; main.textContent = gamesLeft(ctx.s) > 0 ? '再来一局' : '今天玩够啦'; main.disabled = gamesLeft(ctx.s) <= 0; cash.style.display = 'none';
      }
    };
    const bank = async (perfect = false) => {
      const g = rewardFor(ctx.s, streak);
      applyGain(ctx.s, g); ctx.save(); sfx.up();
      say(`${perfect ? '全部找对！<br>' : '见好就收！<br>'}<small>${gainText(g)}</small>`);
      streak = 0; refresh(); phase = 'over'; cash.style.display = 'none'; main.style.display = ''; main.textContent = gamesLeft(ctx.s) > 0 ? '再来一局' : '今天玩够啦'; main.disabled = gamesLeft(ctx.s) <= 0;
    };
    const press = () => { if (main.disabled || main.style.display === 'none') return; if (phase === 'idle' || phase === 'over') startGame(); else if (phase === 'decide') void playRound(streak + 1); };
    const close = () => { alive = false; window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const box = el.closest('.bc-box') as HTMLElement | null;
      if (box) { void pickBox(box); return; }
      const b = el.closest('[data-bc]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.bc === 'close') close(); else if (b.dataset.bc === 'cash') { if (phase === 'decide' && streak > 0) void bank(); } else press();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
