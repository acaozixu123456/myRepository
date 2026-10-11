// 剧情对白播放器：立绘 + 对话框 + 打字机，点击推进，可跳过。
import { STORIES } from '../content/story';
import { FACTIONS } from '../data/factions';
import { HERO_BY_ID } from '../data/heroes';
import { artUrl } from '../ui/art';
import { esc } from '../ui/components';
import { icon } from '../ui/icons';
import type { AppCtx } from './ctx';

const STORY_BY_ID = new Map(STORIES.map((s) => [s.id, s]));
export const hasStory = (id: string | undefined): id is string => !!id && STORY_BY_ID.has(id);

/** 没看过的剧情才会播；播完记入存档。 */
export async function playStoryOnce(ctx: AppCtx, id: string | undefined): Promise<void> {
  if (!hasStory(id)) return;
  const seen = (ctx.s.stories ??= []);
  if (seen.includes(id)) return;
  seen.push(id);
  ctx.save();
  await playStory(ctx, id);
}

export function playStory(ctx: AppCtx, id: string): Promise<void> {
  const def = STORY_BY_ID.get(id);
  if (!def) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const el = document.createElement('div');
    el.className = 'story';
    el.innerHTML = `
      <div class="stage-bg"></div>
      <div class="portraits"><div class="pt L"></div><div class="pt R"></div></div>
      <button class="skip" data-story="skip">跳过</button>
      <div class="chapter-title">${esc(def.title)}</div>
      <div class="box"><div class="name"></div><div class="txt"></div><i class="next">${icon('arrowUp', 18)}</i></div>`;
    ctx.root.appendChild(el);
    const $ = (s: string) => el.querySelector(s) as HTMLElement;
    const boxName = $('.name'), boxTxt = $('.txt'), pts = [$('.pt.L'), $('.pt.R')];
    let i = -1, typing = false, timer = 0, full = '', side = 0, last = '';
    const slot = new Map<string, number>();

    const finish = () => { clearInterval(timer); el.classList.add('out'); setTimeout(() => el.remove(), 220); resolve(); };
    const show = () => { clearInterval(timer); typing = false; boxTxt.textContent = full; el.classList.add('done'); };
    const next = () => {
      if (typing) return show();
      i++;
      if (i >= def.lines.length) return finish();
      const ln = def.lines[i];
      el.classList.remove('done');
      el.classList.toggle('narr', ln.who === 'narrator');
      const hero = HERO_BY_ID[ln.who];
      const nm = ln.who === 'narrator' ? '' : ln.who === 'player' ? '铲屎官' : hero?.name ?? ln.who;
      boxName.innerHTML = nm ? `<b ${hero ? `style="--c:${FACTIONS[hero.faction].color}"` : ''}>${esc(nm)}</b>` : '';
      boxName.style.display = nm ? '' : 'none';
      if (hero) {
        if (!slot.has(ln.who)) slot.set(ln.who, side++ % 2);
        const k = slot.get(ln.who)!;
        for (const [j, p] of pts.entries()) {
          if (j !== k) { p.classList.remove('on'); continue; }
          if (p.dataset.id !== ln.who) { p.dataset.id = ln.who; p.innerHTML = `<img src="${artUrl(ln.who, 'full', k === 1)}" alt="" draggable="false">`; }
          p.className = `pt ${j ? 'R' : 'L'} on ${ln.mood ?? 'normal'}`;
          void p.offsetWidth;
        }
      }
      el.classList.toggle('dimp', !hero);
      last = ln.who;
      full = ln.text;
      boxTxt.textContent = '';
      typing = true;
      let n = 0;
      timer = window.setInterval(() => {
        n += 1;
        boxTxt.textContent = full.slice(0, n);
        if (n >= full.length) show();
      }, 32);
      void last;
    };
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-story=skip]')) return finish();
      next();
    });
    setTimeout(() => $('.chapter-title').classList.add('gone'), 1500);
    next();
  });
}

export const STORY_CSS = `
.story{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;justify-content:flex-end;animation:fadein .25s;user-select:none}
.story.out{opacity:0;transition:opacity .2s}
.story .stage-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(255,226,170,.55),rgba(32,18,48,.94) 72%),linear-gradient(#2a1b3d,#120a1c)}
.story .stage-bg::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 22px,transparent 22px 54px)}
.story .portraits{position:absolute;left:0;right:0;bottom:150px;height:56%;pointer-events:none}
.story .pt{position:absolute;bottom:0;height:100%;width:68%;opacity:0;transform:translateY(24px);transition:opacity .25s,transform .3s cubic-bezier(.2,1.3,.4,1),filter .25s}
.story .pt.L{left:0}.story .pt.R{right:0}
.story.dimp .pt.on{filter:brightness(.55) saturate(.8)}
.story .pt img{position:absolute;bottom:0;left:50%;height:100%;transform:translateX(-50%);filter:drop-shadow(0 10px 14px rgba(0,0,0,.55))}
.story .pt.on{opacity:1;transform:none}
.story .pt.on.happy img{animation:stbounce .5s}
.story .pt.on.angry img{animation:shake .45s}
.story .pt.on.surprised img{animation:stpop .35s}
.story .pt.on.sad img{filter:brightness(.82) saturate(.8) drop-shadow(0 10px 14px rgba(0,0,0,.55));transform:translateX(-50%) translateY(8px)}
.story .pt.on.sly img{animation:stsly .6s}
.story .box{position:relative;margin:0 10px calc(14px + env(safe-area-inset-bottom,0px));min-height:132px;padding:22px 18px 16px;border-radius:20px;background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 0 0 4px var(--wood-2),0 0 0 6px var(--wood-hi),0 8px 0 var(--wood-3)}
.story .box .name{position:absolute;left:16px;top:-16px}
.story .box .name b{display:inline-block;padding:3px 16px 4px;border-radius:999px;background:var(--c,#7a5a8a);color:#fff;font-family:var(--f-d);font-weight:400;font-size:18px;box-shadow:0 3px 0 rgba(0,0,0,.25),inset 0 0 0 2px rgba(255,255,255,.4)}
.story .box .txt{font-size:16.5px;line-height:1.65;font-weight:700;color:var(--ink);min-height:80px}
.story.narr .box .txt{font-style:italic;color:var(--ink-2);text-align:center;padding-top:6px}
.story .box .next{position:absolute;right:14px;bottom:8px;opacity:0;transform:rotate(180deg);color:var(--orange-d)}
.story.done .box .next{opacity:1;animation:blink 1s infinite}
.story .skip{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:3;padding:5px 14px;border-radius:999px;background:rgba(43,28,16,.72);color:#fff6dc;font-weight:700;font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)}
.story .chapter-title{position:absolute;left:0;right:0;top:14%;text-align:center;font-family:var(--f-d);font-size:26px;color:#ffe9a8;letter-spacing:.08em;text-shadow:0 3px 0 rgba(0,0,0,.45);transition:opacity .6s}
.story .chapter-title.gone{opacity:0}
@keyframes stbounce{0%,100%{transform:translateX(-50%)}40%{transform:translateX(-50%) translateY(-14px)}}
@keyframes stpop{0%{transform:translateX(-50%) scale(.92)}60%{transform:translateX(-50%) scale(1.05)}100%{transform:translateX(-50%) scale(1)}}
@keyframes stsly{0%,100%{transform:translateX(-50%) rotate(0)}50%{transform:translateX(-50%) rotate(3deg)}}
`;
