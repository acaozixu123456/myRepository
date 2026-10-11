// 新手引导：三步，一次只亮一个提示（猫猫气泡 + 目标按钮脉冲），完成对应操作后自动进入下一步。
import type { AppCtx } from './ctx';

interface Step { id: string; target: string; screen: string; text: string; done: (ctx: AppCtx) => boolean }

const STEPS: Step[] = [
  { id: 'recruit', target: '#nav [data-to=gacha]', screen: '*', text: '军师！先用招福符招一位新猫吧，纸箱里说不定有惊喜。', done: (c) => (c.s.seen?.length ?? 0) > 5 },
  { id: 'levelup', target: '#nav [data-to=lineup]', screen: '*', text: '去阵容里给猫猫升级，战力上来才打得过下一关。', done: (c) => Object.values(c.s.heroes).some((h) => h.lv > 8) },
  { id: 'challenge', target: '#chBtn', screen: 'home', text: '战力不错了，点这里挑战下一关！', done: (c) => (c.s.best?.index ?? 1) > 1 || (c.s.best?.chapter ?? 1) > 1 },
];

let bubble: HTMLElement | null = null;
let lit: Element | null = null;

export function clearGuide() {
  bubble?.remove(); bubble = null;
  lit?.classList.remove('guide-pulse'); lit = null;
}

let key = '';
export function updateGuide(ctx: AppCtx) {
  if (ctx.screen === 'shop' || ctx.screen === 'pay' || ctx.screen === 'social' || ctx.screen === 'events' || ctx.root.querySelector('.story,.reveal,.mask')) { clearGuide(); key = ''; return; } // 有剧情 / 弹窗 / 抽卡时不打扰
  const done = (ctx.s.tips ??= []);
  let any = false;
  for (const st of STEPS) {
    if (done.includes(st.id)) continue;
    if (st.done(ctx)) { done.push(st.id); ctx.save(); continue; }
    if ((st.screen !== '*' && st.screen !== ctx.screen) || (st.id === 'levelup' && ctx.screen === 'lineup') || (st.id === 'recruit' && ctx.screen === 'gacha')) { clearGuide(); key = ''; return; }
    const el = ctx.root.querySelector(st.target);
    if (!el) { clearGuide(); key = ''; return; }
    const k = `${st.id}|${ctx.screen}`;
    if (k === key && bubble?.isConnected) return;
    clearGuide(); key = k;
    el.classList.add('guide-pulse'); lit = el;
    const r = (el as HTMLElement).getBoundingClientRect();
    const host = ctx.root.getBoundingClientRect();
    bubble = document.createElement('div');
    bubble.className = 'guide-bubble';
    bubble.innerHTML = `<b>喵</b><span>${st.text}</span>`;
    const cx = r.left - host.left + r.width / 2;
    bubble.style.left = `${Math.max(12, Math.min(host.width - 232, cx - 110))}px`;
    bubble.style.bottom = `${host.bottom - r.top + 12}px`;
    bubble.style.setProperty('--ax', `${cx - Math.max(12, Math.min(host.width - 232, cx - 110))}px`);
    ctx.root.appendChild(bubble);
    return;
  }
  if (!any) { clearGuide(); key = ''; }
}

export const GUIDE_CSS = `
.guide-pulse{animation:gpulse 1.1s infinite;position:relative;z-index:15}
@keyframes gpulse{0%,100%{box-shadow:0 0 0 0 rgba(255,210,90,.9)}60%{box-shadow:0 0 0 12px rgba(255,210,90,0)}}
.guide-bubble{position:absolute;z-index:16;width:220px;display:flex;gap:8px;align-items:flex-start;padding:9px 12px;border-radius:16px;background:var(--paper);box-shadow:0 0 0 3px var(--wood-2),0 6px 14px rgba(0,0,0,.35);font-weight:800;font-size:13px;line-height:1.5;color:var(--ink);animation:rise .3s;pointer-events:none}
.guide-bubble b{flex:none;width:26px;height:26px;border-radius:50%;background:linear-gradient(#ffd27a,#f0a22e);color:#5a2a05;font-family:var(--f-d);font-weight:400;display:flex;align-items:center;justify-content:center}
.guide-bubble::after{content:'';position:absolute;bottom:-9px;left:var(--ax,50%);margin-left:-8px;border:8px solid transparent;border-top-color:var(--paper);border-bottom:0}
`;
