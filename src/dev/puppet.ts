// 立绘木偶调试页：一排姿势 × 每只立绘猫。?ids=a,b  ?poses=idle,windup,strike
import { ILLUST } from '../art/illust-index';
import { lookOf } from '../data/units';
import { Actor, POSES } from '../fx/actor';
import { MeshGL } from '../fx/mesh';
import { buildIllustRig } from '../fx/rig';
import { Scene } from '../fx/scene';

const q = new URLSearchParams(location.search);
const ids = (q.get('ids') ?? Object.keys(ILLUST).join(',')).split(',');
const poses = (q.get('poses') ?? 'idle,ready,windup,strike,thrust,cast,castUp,guard,hurt,dash').split(',');
const app = document.getElementById('app')!;
document.getElementById('info')!.textContent = `webgl: ${MeshGL.ok}`;
(async () => {
  for (const id of ids) {
    const row = document.createElement('div'); row.className = 'row'; app.appendChild(row);
    const rig = await buildIllustRig(lookOf(id), ILLUST[id].full, 0.62, id);
    for (const pn of poses) {
      const cv = document.createElement('canvas'); row.appendChild(cv);
      const sc = new Scene(cv);
      const a = new Actor(sc, rig, { uid: 1, side: 'A', name: id, faction: 'wei', heroId: id, maxHp: 1, hp: 1 }, 480, 560, +(q.get('s') ?? 0.85));
      a.setPoseNow(POSES[pn]);
      a.phase = 0;
      cv.width = 330; cv.height = 520;
      const ctx = cv.getContext('2d')!;
      ctx.translate(165 - 480, 500 - 560);
      a.draw(ctx);
    }
  }
  (window as unknown as { done: boolean }).done = true;
})();
