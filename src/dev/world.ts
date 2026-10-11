// 3D 世界调试页：?yaw=0.6&pitch=0.9&dist=44  shadow=0 / bloom=0  team=a,b,c  go=x,z（走到某点）  t=秒
import { Explorer } from '../world/explore';
import { WorldView, defaultQuality } from '../world/engine';
import { buildStreet } from '../world/street';
import { preloadWorldTextures } from '../world/tex';
import { levelOf } from '../world/levels';

const q = new URLSearchParams(location.search);
const quality = defaultQuality();
if (q.get('bloom') === '0') quality.bloom = false;
if (q.get('shadow') === '0') quality.shadows = false;
if (q.get('rain') === '0') quality.rain = false;
await preloadWorldTextures();
const wv = new WorldView(document.getElementById('cv') as HTMLCanvasElement, quality);
const L = levelOf(+(q.get('ch') ?? 1));
const st = buildStreet(L);
wv.setMood(L.mood);
wv.scene.add(st.group);
wv.yaw = +(q.get('yaw') ?? 0.5); wv.pitch = +(q.get('pitch') ?? 1.0); wv.dist = +(q.get('dist') ?? 44);
const team = (q.get('team') ?? 'wei_caomiaode,shu_liumiaobei,xian_changmiao,wei_simamiyi,shu_pangmiaotong').split(',');
const ex = new Explorer(wv, st, team, { encounter: async () => true, chest: () => undefined, talk: () => undefined });
ex.addSpawn({ id: 'e1', kind: 'enemy', x: 8, z: -2, units: ['mob_qun_vanguard', 'mob_qun_guard'], label: '纸箱贼 Lv5', patrol: 4 });
ex.addSpawn({ id: 'b1', kind: 'boss', x: -4, z: -16, units: ['qun_dongzhuo'], label: '董桌 · 首领', patrol: 0 });
ex.addSpawn({ id: 'c1', kind: 'chest', x: 6, z: 8, label: '宝箱' });
ex.addSpawn({ id: 'n1', kind: 'npc', x: -8, z: 8, units: ['xian_changmiao'], label: '嫦喵' });
const go = q.get('go');
if (go) { const [x, z] = go.split(',').map(Number); ex.moveTo(x, z); }
const sim = +(q.get('t') ?? 0);
for (let i = 0; i < sim * 20; i++) ex.update(0.05);
wv.focus.copy(ex.leaderPos);
wv.snapCamera();
for (let i = 0; i < 20; i++) { ex.update(0.1); st.update(i * 0.1, 0.1); wv.snapCamera(); }
const fc = q.get('focus'); // ?focus=x,z：镜头对准某个点（看道具用；要放在预热循环之后，否则会被队长拉回去）
if (fc) { const [fx, fz] = fc.split(',').map(Number); wv.focus.set(fx, 0.3, fz); wv.snapCamera(); }
wv.render(0.1);
(window as unknown as { done: boolean; ex: Explorer; wv: WorldView }).ex = ex;
(window as unknown as { done: boolean }).done = true;
