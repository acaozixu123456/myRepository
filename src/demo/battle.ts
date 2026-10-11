// 战斗演示页：选阵容 → 引擎模拟 → 播放器回放。
import { simulate } from '../engine/battle';
import { Player, spriteMode } from '../fx/player';
import { HERO_BY_ID } from '../data/heroes';
import { KITS } from '../data/kits';
import { FACTIONS } from '../data/factions';
import type { UnitSetup } from '../engine/types';
import type { BgTheme } from '../fx/bg';

const q = new URLSearchParams(location.search);
const PRESETS: Record<string, { name: string; a: string; b: string }> = {
  classic: { name: '蜀吴联军 vs 群雄乱斗', a: 'shu_guanyunmiao,shu_zhangmiaofei,shu_zhugemiaoliang,shu_liumiaobei,wu_zhoumiaoyu', b: 'qun_lvbuding,man_mengmiaohuo,xian_zuoci,wei_caomiaode,man_zhurong' },
  ur: { name: 'UR 大乱斗', a: 'man_mengmiaohuo,wei_caomiaode,wu_zhoumiaoyu,shu_liumiaobei,wu_sunxiangxiang', b: 'qun_lvbuding,shu_zhangmiaofei,xian_zuoci,qun_huatuo,man_zhurong' },
  wei: { name: '魏 vs 蜀', a: 'wei_xuhuchi,wei_xiahoudun,wei_caomiaode,wei_guojia,qun_huatuo', b: 'shu_zhangmiaofei,shu_guanyunmiao,shu_liumiaobei,shu_zhugemiaoliang,wu_sunxiangxiang' },
};
spriteMode.cat3d = !!q.get('r3d');
spriteMode.illust = !q.get('flat');
let preset = q.get('p') ?? 'classic';
const teams = () => ({ a: (q.get('a') ?? PRESETS[preset].a).split(','), b: (q.get('b') ?? PRESETS[preset].b).split(',') });
const SEED = +(q.get('seed') ?? 2);
const THEME = (q.get('theme') ?? 'meadow') as BgTheme;
const setups = (ids: string[]): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: 60, pos: i, star: 5, awaken: i % 2 ? 'B' : 'A', skillLv: 9 }));

const css = `
:root{color-scheme:dark}
body{margin:0;background:#161225;color:#f4eedd;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif}
#app{max-width:1000px;margin:0 auto;padding:12px 16px 40px}
.stage{position:relative;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px -16px #000;background:#000}
canvas{display:block;width:100%;height:auto;aspect-ratio:960/600}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.btn{border:0;border-radius:14px;padding:8px 18px;font:700 15px inherit;cursor:pointer;background:linear-gradient(#ffb25c,#f08a2b);color:#5a2a05;box-shadow:0 4px 0 #b95f12}
.btn.alt{background:linear-gradient(#8fd0ff,#4a95e0);color:#0f2f57;box-shadow:0 4px 0 #2563a8}
.btn[aria-pressed=true]{outline:3px solid #fff}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 #b95f12}
.chk{font-size:13px;color:#cfc8e6;display:flex;gap:6px;align-items:center}
.log{font-size:13px;color:#b9b3cf;min-height:20px}
.loading{position:absolute;inset:0;display:grid;place-items:center;background:#161225;color:#ffd9a0;font-size:20px}
h1{font:400 28px "ZCOOL KuaiLe","Noto Sans SC",sans-serif;margin:6px 0 2px}
.note{color:#9d97b8;font-size:13px;margin:4px 0}
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
document.getElementById('app')!.innerHTML = `
<h1>猫国志 · 战斗演示</h1>
<div class="note">引擎实时模拟，回放时每只猫都是骨骼动画；绝技带插入图与专属特效。</div>
<div class="stage"><canvas id="cv"></canvas><div class="loading" id="loading">正在为猫猫穿衣服…</div></div>
<div class="bar">
  <button class="btn" id="restart">重新开战</button>
  <button class="btn alt" data-speed="1" aria-pressed="true">1×</button><button class="btn alt" data-speed="2" aria-pressed="false">2×</button><button class="btn alt" data-speed="3" aria-pressed="false">3×</button>
  <button class="btn alt" id="skip">跳过</button>
  <select id="preset" class="btn alt">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
  <label class="chk"><input type="checkbox" id="ult"> 满元气开局（直接看绝技）</label>
  <select id="theme" class="btn alt"><option value="meadow">原野</option><option value="street">猫街</option><option value="market">集市</option><option value="redcliff">赤壁</option><option value="forest">山林</option><option value="mist">云端</option><option value="palace">宫殿</option><option value="neon">霓虹</option></select>
</div>
<div class="log" id="log"></div>`;

const canvas = document.getElementById('cv') as HTMLCanvasElement;
let player: Player | null = null;
let run = 0;

async function start(seed = SEED) {
  const my = ++run;
  document.getElementById('loading')!.style.display = 'grid';
  player?.scene.stop();
  player = new Player(canvas);
  player.installOverlay();
  player.onLog = (s) => (document.getElementById('log')!.textContent = s);
  const theme = (document.getElementById('theme') as HTMLSelectElement).value as BgTheme;
  const full = (document.getElementById('ult') as HTMLInputElement).checked;
  const t = teams();
  const sim = simulate({ seed, A: setups(t.a), B: setups(t.b), startEnergy: full ? 100 : { A: +(q.get('energy') ?? 0), B: +(q.get('energyB') ?? 0) } });
  const startEv = sim.events[0];
  if (startEv.t !== 'start') return;
  await player.setup(startEv, theme);
  if (my !== run) return;
  document.getElementById('loading')!.style.display = 'none';
  if (!q.get('test')) player.scene.start();
  const spd = +(document.querySelector('[data-speed][aria-pressed=true]') as HTMLElement).dataset.speed!;
  player.setSpeed(spd);
  await player.play(sim.events.slice(1));
  if (my === run) document.getElementById('log')!.textContent = `战斗结束：${sim.winner === 'A' ? '我方胜利' : '敌方胜利'}（${sim.rounds} 回合）`;
}

(document.getElementById('theme') as HTMLSelectElement).value = THEME;
(document.getElementById('preset') as HTMLSelectElement).value = preset;
(document.getElementById('preset') as HTMLSelectElement).onchange = (e) => { preset = (e.target as HTMLSelectElement).value; void start(SEED); };
(document.getElementById('ult') as HTMLInputElement).onchange = () => void start(SEED);
document.getElementById('restart')!.onclick = () => start(Math.floor(Math.random() * 1e6));
document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  b.setAttribute('aria-pressed', 'true');
  player?.setSpeed(+b.dataset.speed!);
}));
document.getElementById('skip')!.onclick = () => { if (player) { player.skipping = true; player.setSpeed(8); } };
(document.getElementById('theme') as HTMLSelectElement).onchange = () => start(SEED);

// 测试钩子：逐帧步进
(window as unknown as Record<string, unknown>).__demo = {
  get player() { return player; },
  step(sec: number) { const dt = 1 / 60; for (let t = 0; t < sec; t += dt) { player!.scene.step(dt); } player!.scene.draw(); },
  KITS, HERO_BY_ID, FACTIONS,
};
void start();
