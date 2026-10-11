// 日常福利界面：七日签到弹窗、快速探索。
import { FAST_COST, FAST_MAX, FAST_MINUTES, SIGNIN_REWARDS, SIGNIN_VIP_DOUBLE, canSign, ensureDaily, fastExplore, fastFree, fastUsed, nextSignDay, signIn } from '../../game/daily';
import type { SignReward } from '../../game/daily';
import { vipLevel } from '../../game/premium';
import { fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { floaty, updateHome } from './home';

function rewardChips(r: SignReward, size = 18): string {
  return [r.fish ? `${icon('fish', size)}${fmt(r.fish)}` : '', r.bells ? `${icon('bells', size)}${fmt(r.bells)}` : '', r.catnip ? `${icon('catnip', size)}${r.catnip}` : '', r.tickets ? `${icon('ticket', size)}${r.tickets}` : '', r.moon ? `${icon('moon', size)}${r.moon}` : ''].filter(Boolean).join('<br>');
}

export function openSignin(ctx: AppCtx) {
  const s = ctx.s;
  const d = ensureDaily(s);
  const next = nextSignDay(s);
  const can = canSign(s);
  const doubled = vipLevel(s) >= SIGNIN_VIP_DOUBLE;
  ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog signin">
    <h3 class="title" style="margin:0 0 4px">${icon('calendar', 26)} 七日签到</h3>
    <p class="muted" style="font-size:12px;margin:0 0 10px;font-weight:700">漏签不清零，七天一轮；累计签到 ${d.signTotal} 天。${doubled ? `<b style="color:var(--green-d)">VIP${SIGNIN_VIP_DOUBLE}+ 奖励翻倍中</b>` : `VIP${SIGNIN_VIP_DOUBLE} 起奖励翻倍`}</p>
    <div class="sgrid">${SIGNIN_REWARDS.map((r, i) => {
      const day = i + 1; const done = can ? day < next : day <= (d.signStreak % 7 === 0 && d.signStreak > 0 ? 7 : d.signStreak % 7); const cur = can && day === next;
      return `<div class="sd ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${day === 7 ? 'big' : ''}"><i>第${day}天</i><span>${rewardChips(r)}</span>${done ? `<em>${icon('check', 18)}</em>` : ''}</div>`;
    }).join('')}</div>
    <div class="row" style="justify-content:center;gap:10px;margin-top:12px"><button class="btn ghost" data-act="closedialog">关闭</button><button class="btn ${can ? 'green' : 'ghost'}" data-act="signin-claim" ${can ? '' : 'disabled'}>${can ? `签到第 ${next} 天` : '今日已签到'}</button></div></div></div>`);
}

export function handleDaily(ctx: AppCtx, act: string): boolean {
  const s = ctx.s;
  switch (act) {
    case 'signin': openSignin(ctx); return true;
    case 'signin-claim': {
      const r = signIn(s);
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); sfx.coin(); floaty(ctx, '签到成功', 'calendar', 50, 30);
      openSignin(ctx); updateHome(ctx);
      ctx.toast(`第 ${r.day} 天：${[r.reward.fish && `${fmt(r.reward.fish)} 小鱼干`, r.reward.bells && `${r.reward.bells} 金铃铛`, r.reward.catnip && `${r.reward.catnip} 猫薄荷`, r.reward.tickets && `${r.reward.tickets} 招福符`, r.reward.moon && `${r.reward.moon} 月光珠`].filter(Boolean).join('、')}`);
      return true;
    }
    case 'fast': {
      const r = fastExplore(s);
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); sfx.coin(); floaty(ctx, `+${fmt(r.fish)}`, 'fish', 50, 40);
      ctx.toast(`快速探索：${FAST_MINUTES / 60} 小时收益 ${fmt(r.fish)} 小鱼干、${fmt(r.exp)} 经验${r.paid ? `（花了 ${FAST_COST} 金铃铛）` : ''}`);
      updateHome(ctx);
      return true;
    }
  }
  return false;
}

export const fastLabel = (ctx: AppCtx) => {
  const free = fastFree(ctx.s);
  const used = fastUsed(ctx.s);
  return used >= FAST_MAX ? '今日已满' : free > 0 ? `快速探索 · 免费 ${free}` : `快速探索 · ${icon('bells', 14)}${FAST_COST}`;
};

export const DAILY_CSS = `
.signin .sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.sd{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:76px;padding:6px 2px;border-radius:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);font-size:12px;font-weight:800;text-align:center;line-height:1.35}
.sd i{font-style:normal;font-size:10.5px;color:var(--ink-3)}.sd span{display:flex;flex-direction:column;align-items:center;font-family:var(--f-d);font-size:13px}
.sd span .ic{vertical-align:-4px;margin-right:2px}
.sd.cur{background:linear-gradient(#fff3c4,#ffd96a);box-shadow:inset 0 0 0 3px var(--orange),0 0 12px rgba(255,170,40,.7);animation:gpulse 1.4s infinite}
.sd.done{opacity:.55}.sd.done em{position:absolute;right:3px;top:3px;width:22px;height:22px;border-radius:50%;background:var(--green);display:grid;place-items:center}
.sd.big{grid-column:span 2;background:linear-gradient(#ffe9f6,#ffd0ee);box-shadow:inset 0 0 0 2px #ff6ad0}
.idlebtns{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.idlebtns .btn.sm{min-height:34px;padding:4px 10px 6px;font-size:13px;white-space:nowrap}
`;
