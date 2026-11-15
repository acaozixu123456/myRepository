// 荒地复苏的规则：纯数据，不碰画面。所有函数都显式接收「现在」的毫秒时间戳，方便测试和快进。
import { TEXT } from './notes.js';

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;

// ---- 地形 ----
export const R = 10.5;
export const POND = { x: 3.6, z: 2.6, r: 3.2, sz: 0.82 };
export const LANTERN = { x: -0.2, z: 1.0 };
export const DEAD_TREES = [{ x: -4.2, z: -3.4 }, { x: 5.6, z: -5.2 }];
export const BRIDGE = { x: 3.4, z: 5.0 };
export const ROCKS = [{ x: 7.0, z: 5.0 }, { x: -8.0, z: 5.2 }, { x: 3.4, z: -8.0 }];
export const edgeR = a => R * (1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7 + 2) + 0.02 * Math.sin(a * 13));
export const inIsland = (x, z, margin = 1) => Math.hypot(x, z) < edgeR(Math.atan2(z, x)) - margin;
export const pondDist = (x, z) => Math.hypot(x - POND.x, (z - POND.z) / POND.sz);

// ---- 物种 ----
// dur: 长成所需小时；w: 对生机的贡献；r: 占地半径；need: 需要的最低生机；n: 外观数量
export const SPECIES = {
  grass:  { dur: 4,   w: 1,   r: 0.45, need: 0,    n: 3 },
  flower: { dur: 20,  w: 1.5, r: 0.6,  need: 0.04, n: 4 },
  bush:   { dur: 48,  w: 3,   r: 1.2,  need: 0.12, n: 2 },
  tree:   { dur: 120, w: 6,   r: 1.8,  need: 0.25, n: 5 },
  pine:   { dur: 144, w: 6,   r: 1.7,  need: 0.4,  n: 3 },
  mush:   { dur: 6,   w: 0.5, r: 0.4,  need: 0.15, n: 2 },
  mood:   { dur: 10,  w: 2,   r: 0.8,  need: 0,    n: 4 },
};
export const SEEDABLE = ['grass', 'flower', 'bush', 'tree', 'pine'];
const ANIMALS = [
  { sp: 'chick', ok: (s, v) => v >= 0.08 },
  { sp: 'bee',   ok: (s, v, c) => c.flowers >= 5 },
  { sp: 'bunny', ok: (s, v) => v >= 0.2 },
  { sp: 'fish',  ok: (s, v) => s.pond && v >= 0.3 },
  { sp: 'deer',  ok: (s, v, c) => v >= 0.45 && c.trees >= 3 },
  { sp: 'fox',   ok: (s, v) => v >= 0.6 },
  { sp: 'cat',   ok: (s, v) => v >= 0.75 },
];
const VITALITY_FULL = 230;
const MAX_PLANTS = 150;
const MAX_SEEDS = 3;
const SEED_REFILL = 3 * HOUR;
export const WATER_COOLDOWN = 4 * HOUR;
const MAX_NOTES = 400;

// ---- 随机数 ----
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// ---- 状态 ----
export function newState(now, seed = (Math.random() * 2 ** 31) | 0) {
  const s = {
    v: 1, seed, createdAt: now, lastHour: Math.floor(now / HOUR),
    plants: [], nextId: 1, animals: [], notes: [], readAt: 0,
    pond: false, dead: 2, islets: 0, found: {},
    seeds: MAX_SEEDS, seedAt: now, waterAt: 0, waterCount: 0,
  };
  note(s, now, 'start', TEXT.start[0]);
  return s;
}

function note(s, t, k, text) {
  s.notes.push({ t, k, s: text });
  if (s.notes.length > MAX_NOTES) s.notes.splice(0, s.notes.length - MAX_NOTES);
}

export const dayNumber = (s, now) => Math.floor((startOfDay(now) - startOfDay(s.createdAt)) / DAY + 0.5) + 1;
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function maturity(p, now) {
  return Math.max(0, Math.min(1, (now - p.born) / (SPECIES[p.sp].dur * HOUR)));
}
export function vitality(s, now) {
  let sum = 0;
  for (const p of s.plants) sum += SPECIES[p.sp].w * maturity(p, now);
  return Math.min(1, sum / VITALITY_FULL);
}
function counts(s, now) {
  let flowers = 0, trees = 0;
  for (const p of s.plants) {
    if (maturity(p, now) < 1) continue;
    if (p.sp === 'flower' || p.sp === 'mood') flowers++;
    if (p.sp === 'tree' || p.sp === 'pine') trees++;
  }
  return { flowers, trees };
}

// 为什么不能种在这里；能种则返回 null
export function placeProblem(s, sp, x, z) {
  const r = SPECIES[sp].r;
  if (!inIsland(x, z, 0.9 + r * 0.3)) return '太靠近岛的边缘了';
  if (pondDist(x, z) < POND.r + 0.5 + r * 0.3) return '这里是池塘';
  if (Math.hypot(x - LANTERN.x, z - LANTERN.z) < 1.3 + r * 0.4) return '离石灯太近了';
  if (Math.abs(z - BRIDGE.z) < 1.0 + r * 0.3 && x > 0.5 - r * 0.3 && x < 6.3 + r * 0.3) return '池塘边这一小块留着有用';
  for (let i = 0; i < s.dead; i++) if (Math.hypot(x - DEAD_TREES[i].x, z - DEAD_TREES[i].z) < 0.8 + r * 0.5) return '这里有一棵枯树';
  for (const k of ROCKS) if (Math.hypot(x - k.x, z - k.z) < 1.3 + r * 0.3) return '这里有块石头';
  for (const p of s.plants) {
    const need = Math.max(r, SPECIES[p.sp].r) * 0.75 + Math.min(r, SPECIES[p.sp].r) * 0.25;
    if (Math.hypot(x - p.x, z - p.z) < need) return '这里已经长着东西了';
  }
  return null;
}

function addPlant(s, sp, x, z, born, rnd, extra) {
  const p = { id: s.nextId++, sp, x: +x.toFixed(2), z: +z.toFixed(2), born, k: Math.floor(rnd() * SPECIES[sp].n), rot: +(rnd() * 6.28).toFixed(2), sc: +(0.8 + rnd() * 0.4).toFixed(2), ...extra };
  // 红叶树少见
  if (sp === 'tree' && p.k === 4 && rnd() < 0.6) p.k = Math.floor(rnd() * 4);
  s.plants.push(p);
  return p;
}

// ---- 玩家动作 ----
export function seedsNow(s, now) {
  while (s.seeds < MAX_SEEDS && now - s.seedAt >= SEED_REFILL) { s.seeds++; s.seedAt += SEED_REFILL; }
  if (s.seeds >= MAX_SEEDS) s.seedAt = now;
  return s.seeds;
}
export const nextSeedIn = (s, now) => (s.seeds >= MAX_SEEDS ? 0 : Math.max(0, s.seedAt + SEED_REFILL - now));

export function plantSeed(s, sp, x, z, now) {
  if (seedsNow(s, now) <= 0) return '种子用完了，过一会儿会有新的';
  if (vitality(s, now) < SPECIES[sp].need) return '土还太贫瘠，先种点别的养养地';
  const why = placeProblem(s, sp, x, z);
  if (why) return why;
  if (s.seeds === MAX_SEEDS) s.seedAt = now;
  s.seeds--;
  const rnd = mulberry32(s.seed ^ (s.nextId * 7919));
  addPlant(s, sp, x, z, now, rnd, { by: 1 });
  s.found[sp] = s.found[sp] || now;
  note(s, now, 'you', pick(rnd, TEXT.planted[sp]));
  return null;
}

export function plantMood(s, text, x, z, now) {
  const why = placeProblem(s, 'mood', x, z);
  if (why) return why;
  const h = hashStr(text + now);
  const rnd = mulberry32(h);
  addPlant(s, 'mood', x, z, now, rnd, { q: text, hue: Math.floor(rnd() * 360), by: 1 });
  note(s, now, 'you', pick(rnd, TEXT.mood.plant).replace('{q}', text));
  return null;
}

export const waterWait = (s, now) => Math.max(0, s.waterAt + WATER_COOLDOWN - now);
export function water(s, now) {
  if (waterWait(s, now) > 0) return '土还是湿的，晚点再浇';
  for (const p of s.plants) if (maturity(p, now) < 1) p.born -= 2 * HOUR;
  s.waterAt = now; s.waterCount++;
  note(s, now, 'you', pick(mulberry32(s.seed ^ s.waterCount), TEXT.water));
  return null;
}

// ---- 时间推进 ----
// 把状态从 lastHour 推到 now，返回这次新增的笔记数。
export function advance(s, now) {
  const before = s.notes.length;
  const target = Math.floor(now / HOUR);
  let h = Math.max(s.lastHour, target - 24 * 60); // 离开太久只补最近 60 天
  for (; h < target; h++) tick(s, h + 1);
  s.lastHour = target;
  seedsNow(s, now);
  return s.notes.length - before;
}

function tick(s, h) {
  const t = h * HOUR; // 这一小时结束的时刻
  const rnd = mulberry32((s.seed ^ Math.imul(h, 2654435761)) | 0);
  const tAt = () => t - Math.floor(rnd() * HOUR); // 这一小时内的随机时刻
  const v = vitality(s, t);
  const hour = new Date(t).getHours();
  const wet = t - s.waterAt < DAY;

  // 1. 长成
  for (const p of s.plants) {
    if (p.done || t - p.born < SPECIES[p.sp].dur * HOUR) continue;
    p.done = 1;
    const when = Math.min(t, Math.max(t - HOUR + 1, p.born + SPECIES[p.sp].dur * HOUR));
    if (p.sp === 'mood') { note(s, when, 'mood', pick(rnd, TEXT.mood.bloom).replace('{q}', p.q)); continue; }
    const key = 'grown_' + p.sp;
    if (!s.found[key]) { s.found[key] = when; note(s, when, 'grow', pick(rnd, TEXT.grownFirst[p.sp])); }
    else if (TEXT.grown[p.sp] && rnd() < (p.sp === 'flower' || p.sp === 'mush' ? 0.15 : 0.6)) note(s, when, 'grow', pick(rnd, TEXT.grown[p.sp]));
  }

  // 2. 自己长出来的东西
  if (s.plants.length < MAX_PLANTS) {
    let p = 0.09 + 0.2 * v;
    if (wet) p *= 1.6;
    if (s.plants.length > 120) p *= 0.4;
    if (rnd() < p) {
      const n = {}; for (const q of s.plants) n[q.sp] = (n[q.sp] || 0) + 1;
      const weights = [['grass', (n.grass || 0) > 50 ? 1 : 5], ['flower', v >= 0.04 ? ((n.flower || 0) > 40 ? 0.8 : 3) : 0], ['bush', v >= 0.12 ? 1.4 : 0], ['tree', v >= 0.25 ? 1.1 : 0], ['pine', v >= 0.4 ? 0.8 : 0], ['mush', v >= 0.15 ? 0.7 : 0]];
      let x = rnd() * weights.reduce((a, w) => a + w[1], 0), sp = 'grass';
      for (const [k, w] of weights) { if (x < w) { sp = k; break; } x -= w; }
      for (let i = 0; i < 14; i++) {
        let px, pz;
        if (s.plants.length && rnd() < 0.7) {
          const near = pick(rnd, s.plants), a = rnd() * 6.28, d = 0.7 + rnd() * 2.2 + SPECIES[sp].r;
          px = near.x + Math.cos(a) * d; pz = near.z + Math.sin(a) * d;
        } else {
          const a = rnd() * 6.28, d = Math.sqrt(rnd()) * R;
          px = Math.cos(a) * d; pz = Math.sin(a) * d;
        }
        if (placeProblem(s, sp, px, pz)) continue;
        const when = tAt();
        addPlant(s, sp, px, pz, when, rnd);
        if (!s.found[sp]) { s.found[sp] = when; note(s, when, 'sprout', pick(rnd, TEXT.sproutFirst[sp])); }
        else if (rnd() < (sp === 'grass' ? 0.06 : 0.3)) note(s, when, 'sprout', pick(rnd, TEXT.sprout[sp]));
        break;
      }
    }
  }

  // 2b. 地满了以后，老的草和花会枯掉，给新的让位
  if (s.plants.length > 125 && rnd() < 0.12) {
    const old = s.plants.filter(q => q.done && !q.by && (q.sp === 'grass' || q.sp === 'flower' || q.sp === 'mush'));
    if (old.length) { const q = pick(rnd, old); s.plants.splice(s.plants.indexOf(q), 1); if (rnd() < 0.08) note(s, tAt(), 'idle', pick(rnd, TEXT.wither)); }
  }

  // 3. 地貌变化
  if (!s.pond && (v >= 0.1 || s.waterCount >= 2)) { s.pond = true; note(s, tAt(), 'land', pick(rnd, TEXT.pond)); }
  if (s.dead === 2 && v >= 0.35 && (hour < 5 || hour > 21)) { s.dead = 1; note(s, tAt(), 'land', pick(rnd, TEXT.dead1)); }
  else if (s.dead === 1 && v >= 0.6) { s.dead = 0; note(s, tAt(), 'land', TEXT.dead2[0]); }
  if (!s.bridge && s.pond && v >= 0.5) { s.bridge = 1; note(s, tAt(), 'land', pick(rnd, TEXT.bridge)); }
  const isletAt = [0.3, 0.55, 0.8];
  if (s.islets < 3 && v >= isletAt[s.islets]) { note(s, tAt(), 'land', TEXT.islet[s.islets]); s.islets++; }

  // 4. 动物
  const c = counts(s, t);
  for (const a of ANIMALS) {
    if (s.animals.some(x => x.sp === a.sp) || !a.ok(s, v, c)) continue;
    if (rnd() < 0.2) { const when = tAt(); s.animals.push({ sp: a.sp, since: when }); note(s, when, 'animal', pick(rnd, TEXT.arrive[a.sp])); }
    break; // 一次最多来一位
  }

  // 5. 闲笔
  if (rnd() < 0.045) {
    const pool = [...TEXT.idle.any];
    const I = TEXT.idle;
    if (hour >= 20 || hour < 5) { pool.push(...I.night); if (v > 0.2) pool.push(...I.firefly); if (s.plants.some(p => p.sp === 'mood' && p.done)) pool.push(...I.moodflower); }
    else if (hour < 8) pool.push(...I.dawn);
    else if (hour >= 17) pool.push(...I.dusk);
    if (s.pond) pool.push(...I.pond);
    if (c.flowers >= 3) pool.push(...I.flowers);
    if (c.trees >= 1) pool.push(...I.trees);
    for (const a of s.animals) pool.push(...I[a.sp], ...I[a.sp]);
    let line = pick(rnd, pool);
    if (s.notes.slice(-12).some(n => n.s === line)) line = pick(rnd, pool);
    if (!s.notes.slice(-12).some(n => n.s === line)) note(s, tAt(), 'idle', line);
  }
}
