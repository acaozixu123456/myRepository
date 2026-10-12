// 探索玩法回归脚本：先 `npm run dev`，再 node tools/explore-flow.mjs。依次验证：被发现并追上(enemy) / 背后偷袭(player) / 潜行不被发现 / 冲撞撞晕 / 灵视。输出 JSON，期望 A.enc=[enemy] B.enc=[player] C.state=idle D.stun>0
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 700 } });
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:5173/world.html?ch=4&t=0', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.done, null, { timeout: 90000 });
const r = await p.evaluate(async () => {
  const ex = window.ex; const out = {};
  const e = ex.ents.find((x) => x.spawn.id === 'e1'); const L = ex.leader;
  const reset = (x, z) => { for (const a of ex.team) a.pos.set(x, 0.32, z); ex.trail = ex.trail.map(() => ex.team[0].pos.clone()); ex.grace = 0; };
  // A: 站在敌人正前方视野内 → 被发现并追上 → enemy
  e.group.position.set(8, 0.32, -2); e.face = Math.PI / 2; e.state = 'idle'; e.cooldown = 0; e.target.copy(e.group.position);
  reset(13, -2);
  let t = 0, seen = false, chase = false;
  for (; t < 10; t += 0.05) { ex.update(0.05); if (e.state === 'chase') chase = true; if (window.enc?.length) break; }
  out.A = { chase, enc: window.enc?.slice(), t: +t.toFixed(2) };
  await new Promise((r) => setTimeout(r, 80));
  // B: 背后接近 → 不被发现，engage → player
  window.enc = [];
  const e2 = ex.ents.find((x) => x.spawn.id === 'e1'); e2.alive = true; e2.group.visible = true; e2.group.position.set(8, 0.32, -2); e2.face = Math.PI / 2; e2.state = 'idle'; e2.cooldown = 0; e2.target.copy(e2.group.position);
  reset(4.5, -2); ex.grace = 0;
  for (let i = 0; i < 20; i++) ex.update(0.05);
  out.B = { state: e2.state, ambushReady: ex.ambushReady, near: !!ex.nearEnt };
  ex.engage(); await new Promise((r) => setTimeout(r, 50));
  out.B.enc = window.enc.slice(); await new Promise((r) => setTimeout(r, 80));
  // C: 潜行贴近正面 → 不被发现
  window.enc = []; ex.busy = false; ex.paused = false;
  e2.alive = true; e2.group.visible = true; e2.group.position.set(8, 0.32, -2); e2.face = -Math.PI / 2; e2.state = 'idle'; e2.cooldown = 0;
  reset(12, -2); ex.cd.sneak = 0; ex.useSkill('sneak');
  for (let i = 0; i < 30; i++) ex.update(0.05);
  out.C = { state: e2.state, sneakT: +ex.sneakT.toFixed(1) };
  // D: 冲撞撞晕
  ex.busy = false; ex.paused = false; e2.state = 'idle'; e2.stun = 0; e2.group.position.set(8, 0.32, -2);
  reset(0, -2); L.yaw = Math.PI / 2; ex.cd.dash = 0; ex.grace = 0;
  ex.teamIds = ['wei_xiahoudun'];
  const okd = ex.useSkill('dash');
  for (let i = 0; i < 12; i++) ex.update(0.05);
  out.D = { okd, stun: +e2.stun.toFixed(1), x: +L.pos.x.toFixed(1) };
  // E: 灵视显出隐藏宝箱
  const ch = ex.ents.find((x) => x.spawn.id === 'x1'); out.E0 = ch.group.visible;
  reset(2, 0); ex.cd.reveal = 0; ex.useSkill('reveal'); ex.update(0.05); out.E1 = ch.group.visible;
  // F: 传送门
  ex.busy = false; ex.paused = false; ex.portalCd = 0;
  const [pa, pb] = ex.portals; reset(pa[0], pa[1]); ex.grace = 0;
  ex.update(0.05);
  out.F = { at: [+L.pos.x.toFixed(1), +L.pos.z.toFixed(1)], toB: Math.hypot(L.pos.x - pb[0], L.pos.z - pb[1]) < 0.5 };
  return out;
});
// G: 场景机关速度（码头潮汐滩约 0.55 倍；云岛风口约 1.5 倍 + 顺风漂移；宫阙滑地松手后继续滑）
r.G = {};
for (const ch of [3, 5, 6]) {
  await p.goto(`http://127.0.0.1:5173/world.html?ch=${ch}&t=0`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.done, null, { timeout: 90000 });
  r.G[ch] = await p.evaluate(() => {
    const ex = window.ex, z = ex.zones[0]; if (!z) return null;
    ex.grace = 99;
    const place = (x, zz) => { for (const a of ex.team) a.pos.set(x, 0.32, zz); ex.zoneNow = null; ex.vel.set(0, 0, 0); };
    const dist = (x, zz, steps) => { place(x, zz); const p0 = ex.leader.pos.clone(); for (let i = 0; i < steps; i++) { ex.push(z.dx || 1, z.dz || 0, 0.02); ex.update(0.02); } return ex.leader.pos.distanceTo(p0); };
    const open = ex.zones.length ? [z.x + 9, z.z] : [0, 0];
    const inZ = dist(z.x - 1, z.z, 6), outZ = dist(open[0], open[1], 6);
    // 滑地：在圈里推 6 步后松手，再空转 30 帧，看还滑了多远
    place(z.x - 1, z.z); for (let i = 0; i < 6; i++) { ex.push(z.dx || 1, z.dz || 0, 0.02); ex.update(0.02); }
    const p1 = ex.leader.pos.clone(); for (let i = 0; i < 30; i++) ex.update(0.02);
    return { kind: z.kind, inZone: +inZ.toFixed(2), outside: +outZ.toFixed(2), coastAfterRelease: +ex.leader.pos.distanceTo(p1).toFixed(2) };
  });
}
console.log(JSON.stringify(r));
await b.close();
