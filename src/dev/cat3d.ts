// 3D 小猫调试页：?ids=a,b  ?poses=idle,windup,strike  ?yaw=35  ?w=300
import { HEROES } from '../data/heroes';
import { lookOf } from '../data/units';
import { POSES } from '../fx/actor';
import { buildCat3D } from '../art3d/cat3d';
import { applyPose } from '../art3d/pose';
import { FRAME, Renderer3D } from '../art3d/renderer';

const q = new URLSearchParams(location.search);
const ids = (q.get('ids') ?? HEROES.slice(0, 6).map((h) => h.id).join(',')).split(',');
const poses = (q.get('poses') ?? 'idle,windup,strike,castUp,hurt').split(',');
const yaw = (+(q.get('yaw') ?? 32) * Math.PI) / 180;
const W = +(q.get('w') ?? 300);
const H = Math.round((W * (FRAME.y1 - FRAME.y0)) / (FRAME.x1 - FRAME.x0));
const app = document.getElementById('app')!;
const R = Renderer3D.get();
document.getElementById('info')!.textContent = `three: ${!!R}`;
for (const id of ids) {
  const row = document.createElement('div'); row.className = 'row'; app.appendChild(row);
  const cat = buildCat3D(lookOf(id), id);
  cat.phase = 0;
  for (const pn of poses) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; row.appendChild(cv);
    const P: Record<string, number> = {};
    for (const [part, d] of Object.entries(POSES[pn] ?? {})) (d as number[]).forEach((v, i) => { P[`${part}.${i}`] = v; });
    applyPose(cat, P, { alive: true, moving: pn === 'dash', t: 0.4 });
    const [sx, sy, sw, sh] = R!.render(cat, W, H, yaw);
    cv.getContext('2d')!.drawImage(R!.canvas, sx, sy, sw, sh, 0, 0, W, H);
  }
}
(window as unknown as { done: boolean }).done = true;
