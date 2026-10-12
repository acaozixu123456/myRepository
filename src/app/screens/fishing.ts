// 钓鱼小游戏界面：抛竿 → 等咬钩 → 在咬钩的短窗口里提竿。规则在 game/fishing.ts。
import { BITE_WINDOW, DEX_TOTAL, RARITY_NAME, biteDelay, castsLeft, dexCount, fishGain, judge, recordCatch, rollFish, useCast } from '../../game/fishing';
import type { Grade } from '../../game/fishing';
import { gainText } from '../../game/explore';
import { applyGain } from '../../game/stage';
import { alertSfx, sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const FISHING_CSS = `
.fish-ov{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:rgba(6,3,16,.72);animation:xhelpIn .25s ease-out both}
.fish-card{width:min(340px,90%);padding:16px 18px;border-radius:18px;background:rgba(22,14,44,.97);border:2px solid rgba(255,176,74,.65);box-shadow:0 0 28px rgba(255,160,60,.3);color:#eae4ff;text-align:center}
.fish-card h3{margin:0 0 8px;font-family:var(--f-d);font-size:20px;color:#ffe9a0;letter-spacing:.06em}
.fish-pond{position:relative;height:130px;border-radius:14px;overflow:hidden;background:linear-gradient(#10243f,#0a1a30 60%,#071222);border:1.5px solid rgba(127,240,255,.35)}
.fish-pond::before,.fish-pond::after{content:"";position:absolute;left:50%;top:62%;width:60px;height:18px;margin-left:-30px;border-radius:50%;border:1.5px solid rgba(127,240,255,.35);animation:fishRipple 2.4s ease-out infinite}
.fish-pond::after{animation-delay:1.2s}
@keyframes fishRipple{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.6);opacity:0}}
.fish-bobber{position:absolute;left:50%;top:58%;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 25%,#ff4a5a 26%);box-shadow:0 0 8px rgba(255,80,90,.7);transition:transform .15s}
.fish-bobber.idle{top:20%;opacity:.35}
.fish-bobber.wait{animation:fishBob 1.6s ease-in-out infinite}
.fish-bobber.bite{animation:fishBite .18s linear infinite;box-shadow:0 0 16px rgba(255,230,120,.95)}
@keyframes fishBob{50%{transform:translateY(5px)}}
@keyframes fishBite{0%,100%{transform:translateY(0)}50%{transform:translateY(14px)}}
.fish-status{min-height:46px;margin:10px 0 4px;font-weight:800;font-size:15px;line-height:1.5}
.fish-status b{font-size:18px}
.fish-status.bite{color:#ffe27a;font-size:19px}
.fish-info{font-size:12px;font-weight:700;color:#9a8ec0;margin-bottom:10px}
.fish-btns{display:flex;gap:10px;justify-content:center}
.fish-btns .btn{min-width:110px}
.fish-r-junk{color:#aaa}.fish-r-common{color:#cfe8ff}.fish-r-fine{color:#8affb0}.fish-r-rare{color:#c08aff}.fish-r-legend{color:#ffd24a;text-shadow:0 0 10px rgba(255,200,60,.8)}
`;

type Phase = 'idle' | 'wait' | 'bite' | 'result';

/** 打开钓鱼界面；玩家点「收竿」后结束。 */
export function openFishing(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>钓鱼点</h3><div class="fish-pond"><i class="fish-bobber idle"></i></div><div class="fish-status"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-fish="main">抛竿</button><button class="btn ghost" data-fish="close">收竿</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const bobber = q<HTMLElement>('.fish-bobber'), status = q<HTMLElement>('.fish-status'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-fish="main"]');
    let phase: Phase = 'idle', biteTimer = 0, missTimer = 0, biteAt = 0;

    const refreshInfo = () => { info.textContent = `今天还能抛 ${castsLeft(ctx.s)} 竿 · 鱼图鉴 ${dexCount(ctx.s)}/${DEX_TOTAL}`; };
    const set = (p: Phase, label: string, text: string, cls = '') => {
      phase = p; main.textContent = label; status.className = `fish-status ${cls}`; status.innerHTML = text;
      bobber.className = `fish-bobber ${p === 'result' ? 'idle' : p === 'idle' ? 'idle' : p}`;
      refreshInfo();
    };
    const idle = () => {
      if (castsLeft(ctx.s) <= 0) { set('idle', '今天钓够啦', '鱼都被你钓怕了，明早 5 点再来'); main.disabled = true; return; }
      set('idle', '抛竿', '点「抛竿」，等鱼上钩后在它咬钩的一瞬间提竿');
    };
    const fail = (grade: Grade) => set('result', '再来一杆', grade === 'early' ? '太心急了，鱼被吓跑了…' : '慢了一步，鱼溜走了…');
    const cast = () => {
      if (!useCast(ctx.s)) { idle(); return; }
      ctx.save();
      set('wait', '提竿', '鱼线入水了…等鱼儿咬钩');
      biteTimer = window.setTimeout(() => {
        phase = 'bite'; biteAt = performance.now();
        set('bite', '提竿！', '上钩了！快提竿！', 'bite');
        alertSfx();
        missTimer = window.setTimeout(() => fail('miss'), BITE_WINDOW * 1000);
      }, biteDelay(Math.random) * 1000);
    };
    const reel = () => {
      if (phase === 'wait') { clearTimeout(biteTimer); fail('early'); return; }
      if (phase !== 'bite') return;
      clearTimeout(missTimer);
      const grade = judge(performance.now() - biteAt);
      const f = rollFish(Math.random, grade);
      const g = fishGain(ctx.s, f);
      applyGain(ctx.s, g); recordCatch(ctx.s, f); ctx.save();
      f.rarity === 'rare' || f.rarity === 'legend' ? sfx.up() : sfx.coin();
      set('result', '再来一杆', `${grade === 'perfect' ? '完美提竿！<br>' : ''}钓到 <b class="fish-r-${f.rarity}">${f.name}</b>（${RARITY_NAME[f.rarity]}）<br><small>${gainText(g)}</small>`);
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') cast(); else reel(); };
    const close = () => { clearTimeout(biteTimer); clearTimeout(missTimer); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-fish]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.fish === 'close') close(); else press();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
