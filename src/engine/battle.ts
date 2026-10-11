import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import { HERO_BY_ID } from '../data/heroes';
import { BONDS, COUNTER_RING, baseStats } from '../data/systems';
import { KITS, genericKit } from '../data/kits';
import { Rng } from './rng';
import { STATUS_RULES, ZERO_MODS } from './statuses';
import type { Mods } from './statuses';
import type { BEvent, BattleConfig, Cond, Effect, Kit, Patch, PassiveDef, Scale, SkillDef, StatusInst, TargetSel, TriggerOn, Unit, UnitSetup } from './types';

interface Ctx {
  caster: Unit;
  targets: Unit[];
  source?: Unit; // 触发来源（被动）
  crit?: boolean;
  killed?: boolean;
  isBasic?: boolean;
}

const lvMul = (lv: number) => 1 + (lv - 1) * 0.075;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function scaleEffects(effs: Effect[], mul: number): Effect[] {
  const sc = (s: Scale): Scale => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, (v as number) * mul]));
  return effs.map((e) => {
    const c = { ...e } as Effect;
    if (c.t === 'damage' || c.t === 'heal' || c.t === 'shield') c.scale = sc(c.scale);
    if (c.t === 'summon') c.scale = sc(c.scale);
    if (c.t === 'when') c.then = scaleEffects(c.then, mul);
    if (c.t === 'repeat') c.effects = scaleEffects(c.effects, mul);
    return c;
  });
}

function applyPatch(kit: Kit, patch: Patch) {
  if (patch.skill === 'passive') {
    if (patch.addPassive) kit.passive.passive.push(patch.addPassive);
    return;
  }
  const sk: SkillDef = patch.skill === 'basic' ? kit.basic : kit.ultimate;
  if (patch.scaleMul) sk.effects = scaleEffects(sk.effects, patch.scaleMul);
  if (patch.replaceEffects) sk.effects = clone(patch.replaceEffects);
  if (patch.addEffects) sk.effects = sk.effects.concat(clone(patch.addEffects));
  if (patch.retarget) sk.target = clone(patch.retarget);
}

export interface BattleResult { events: BEvent[]; winner: 'A' | 'B' | 'draw'; rounds: number; units: Unit[] }

export function simulate(cfg: BattleConfig): BattleResult {
  const b = new Battle(cfg);
  return b.run();
}

class Battle {
  units: Unit[] = [];
  events: BEvent[] = [];
  rng: Rng;
  round = 0;
  uidSeq = 1;
  maxRounds: number;
  teamCounter: Record<string, number> = {};
  factionCount: Record<'A' | 'B', Partial<Record<FactionId, number>>> = { A: {}, B: {} };
  depth = 0;

  constructor(public cfg: BattleConfig) {
    this.rng = new Rng(cfg.seed);
    this.maxRounds = cfg.maxRounds ?? 30;
    for (const s of cfg.A) this.units.push(this.makeUnit(s, 'A'));
    for (const s of cfg.B) this.units.push(this.makeUnit(s, 'B'));
    for (const side of ['A', 'B'] as const) {
      for (const u of this.units.filter((x) => x.side === side)) this.factionCount[side][u.faction] = (this.factionCount[side][u.faction] ?? 0) + 1;
    }
    this.applyBonds();
  }

  makeUnit(s: UnitSetup, side: 'A' | 'B'): Unit {
    const h = HERO_BY_ID[s.heroId];
    if (!h) throw new Error(`unknown hero ${s.heroId}`);
    const bs = baseStats(h.role, h.rarity);
    const m = lvMul(s.level) * (1 + ((s.star ?? 1) - 1) * 0.08) * (s.statMul ?? 1);
    const kit = clone(KITS[s.heroId] ?? genericKit(s.heroId));
    const skillLv = s.skillLv ?? 1;
    for (const lm of kit.ultimate.levelMods ?? []) if (lm.lv <= skillLv) applyPatch(kit, lm.patch);
    for (const lm of kit.basic.levelMods ?? []) if (lm.lv <= skillLv) applyPatch(kit, lm.patch);
    if ((s.star ?? 1) >= 5 && s.awaken) for (const p of kit.awaken[s.awaken].patches) applyPatch(kit, p);
    const roleCrit = h.role === '刺客' ? 0.12 : h.role === '神射' ? 0.08 : 0.05;
    const maxHp = Math.round(bs.hp * m);
    return {
      uid: this.uidSeq++, side, pos: s.pos, heroId: s.heroId, name: h.name, faction: h.faction, role: h.role, level: s.level,
      maxHp, hp: maxHp, atk: Math.round(bs.atk * m), def: Math.round(bs.def * m), spd: bs.spd, crit: roleCrit, critDmg: 1.5,
      energy: typeof this.cfg.startEnergy === 'object' ? this.cfg.startEnergy[side] : (this.cfg.startEnergy ?? 0), shield: [], statuses: [], alive: true, kit, counters: {}, used: {}, acted: 0, extraTurn: false, invuln: 0, dmgMul: 1,
    };
  }

  applyBonds() {
    for (const side of ['A', 'B'] as const) {
      const ids = new Set(this.units.filter((u) => u.side === side).map((u) => u.heroId));
      const mine = this.units.filter((u) => u.side === side);
      for (const bond of BONDS) {
        if (!bond.heroes.every((h) => ids.has(h))) continue;
        const members = mine.filter((u) => bond.heroes.includes(u.heroId));
        if (bond.name === '桃园结义') for (const u of members) { u.maxHp = Math.round(u.maxHp * 1.2); u.hp = u.maxHp; u.atk = Math.round(u.atk * 1.2); u.def = Math.round(u.def * 1.2); }
        if (bond.name === '美人连环') for (const u of mine) if (u.heroId === 'qun_lvbuding') u.atk = Math.round(u.atk * 1.25);
        if (bond.name === '七擒七纵') for (const u of mine) if (u.faction === 'man') { u.maxHp = Math.round(u.maxHp * 1.15); u.hp = u.maxHp; }
        if (bond.name === '江东之虎') for (const u of mine) if (u.faction === 'wu') u.crit += 0.15;
        if (bond.name === '魏武之道') for (const u of mine) if (u.faction === 'wei') u.dmgMul *= 1.05;
      }
      // 同阵营基础加成
      const cnt = this.factionCount[side];
      for (const u of mine) {
        const n = cnt[u.faction] ?? 0;
        const k = n >= 5 ? 0.15 : n >= 3 ? 0.08 : 0;
        if (k) { u.atk = Math.round(u.atk * (1 + k)); u.maxHp = Math.round(u.maxHp * (1 + k)); u.hp = u.maxHp; }
        if (u.faction === 'qun') u.critDmg += 0.1 * (Object.keys(cnt).length - 1);
      }
    }
  }

  // ---------- 取值与查询 ----------
  mods(u: Unit): Mods {
    const m = ZERO_MODS();
    for (const s of u.statuses) {
      const r = STATUS_RULES[s.id];
      const d = r?.mods?.(s.power, s.stacks);
      if (d) for (const k of Object.keys(d) as (keyof Mods)[]) m[k] += d[k] ?? 0;
    }
    return m;
  }
  stat(u: Unit, k: 'atk' | 'def' | 'spd'): number {
    const m = this.mods(u);
    return Math.max(1, u[k] * (1 + (k === 'atk' ? m.atkPct : k === 'def' ? m.defPct : m.spdPct)));
  }
  has(u: Unit, id: string): StatusInst | undefined {
    return u.statuses.find((s) => s.id === id);
  }
  flag(u: Unit, f: 'stun' | 'silence' | 'taunt' | 'confuse' | 'dodge' | 'nine'): boolean {
    return u.statuses.some((s) => STATUS_RULES[s.id]?.flags?.includes(f));
  }
  alive(side: 'A' | 'B'): Unit[] {
    return this.units.filter((u) => u.side === side && u.alive);
  }
  foe(u: Unit): 'A' | 'B' {
    return u.side === 'A' ? 'B' : 'A';
  }
  shieldOf(u: Unit): number {
    return u.shield.reduce((a, s) => a + s.v, 0);
  }
  push(e: BEvent) {
    this.events.push(e);
  }

  // ---------- 条件与选择 ----------
  cond(c: Cond | undefined, ctx: Ctx, target?: Unit): boolean {
    if (!c) return true;
    const who = (w?: 'self' | 'target') => (w === 'target' ? (target ?? ctx.targets[0]) : ctx.caster);
    switch (c.c) {
      case 'hpBelow': { const u = who(c.who); return !!u && u.hp / u.maxHp < c.pct; }
      case 'hpAbove': { const u = who(c.who); return !!u && u.hp / u.maxHp >= c.pct; }
      case 'status': { const u = who(c.who); const s = u && this.has(u, c.id); return !!s && s.stacks >= (c.atLeast ?? 1); }
      case 'allyFaction': return (this.factionCount[ctx.caster.side][c.faction] ?? 0) >= c.atLeast;
      case 'heroAlive': return this.units.some((u) => u.alive && u.heroId === c.hero && (c.side === 'enemy' ? u.side !== ctx.caster.side : u.side === ctx.caster.side));
      case 'chance': return this.rng.chance(c.p);
      case 'crit': return !!ctx.crit;
      case 'targetFaction': { const u = target ?? ctx.targets[0]; return !!u && u.faction === c.faction; }
      case 'targetRole': { const u = target ?? ctx.targets[0]; return !!u && u.role === c.role; }
      case 'round': return this.round >= c.atLeast;
      case 'counter': return (ctx.caster.counters[c.key] ?? 0) >= c.atLeast;
      case 'killed': return !!ctx.killed;
      case 'not': return !this.cond(c.cond, ctx, target);
      case 'and': return c.conds.every((x) => this.cond(x, ctx, target));
      case 'or': return c.conds.some((x) => this.cond(x, ctx, target));
    }
  }

  select(sel: TargetSel, ctx: Ctx, taunt = false): Unit[] {
    const caster = ctx.caster;
    let pool: Unit[];
    if (sel.pick === 'self' || sel.side === 'self') return [caster];
    if (sel.pick === 'source') return ctx.source ? [ctx.source] : [];
    if (sel.pick === 'attacker') return ctx.source && ctx.source.alive ? [ctx.source] : [];
    pool = this.alive(sel.side === 'enemy' ? this.foe(caster) : caster.side);
    if (sel.exclSelf) pool = pool.filter((u) => u !== caster);
    if (sel.faction) pool = pool.filter((u) => u.faction === sel.faction);
    if (sel.role) pool = pool.filter((u) => u.role === sel.role);
    if (sel.hasStatus) pool = pool.filter((u) => this.has(u, sel.hasStatus!));
    if (sel.noStatus) pool = pool.filter((u) => !this.has(u, sel.noStatus!));
    if (!pool.length) return [];
    const n = sel.n ?? 1;
    const byPos = (a: Unit, c: Unit) => a.pos - c.pos;
    switch (sel.pick) {
      case 'all': return pool;
      case 'front': {
        if (taunt && sel.side === 'enemy') { const t = pool.filter((u) => this.flag(u, 'taunt')); if (t.length) return t.slice(0, n); }
        const sorted = pool.slice().sort(byPos);
        const minPos = sorted[0].pos;
        // 同一前后排内随机，优先最靠前的一排
        const row = sorted.filter((u) => (u.pos < 3) === (minPos < 3));
        return row.length > n ? this.rng.shuffle(row).slice(0, n) : sorted.slice(0, n);
      }
      case 'back': {
        const sorted = pool.slice().sort((a, c) => c.pos - a.pos);
        const maxPos = sorted[0].pos;
        const row = sorted.filter((u) => (u.pos < 3) === (maxPos < 3));
        return row.length > n ? this.rng.shuffle(row).slice(0, n) : sorted.slice(0, n);
      }
      case 'frontRow': { const f = pool.filter((u) => u.pos < 3); return f.length ? f : pool; }
      case 'backRow': { const f = pool.filter((u) => u.pos >= 3); return f.length ? f : pool; }
      case 'random': {
        if (taunt && sel.side === 'enemy' && n === 1) { const t = pool.filter((u) => this.flag(u, 'taunt')); if (t.length) return t.slice(0, 1); }
        return this.rng.shuffle(pool).slice(0, n);
      }
      case 'lowestHp': return pool.slice().sort((a, c) => a.hp - c.hp).slice(0, n);
      case 'lowestHpPct': return pool.slice().sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp).slice(0, n);
      case 'highestAtk': return pool.slice().sort((a, c) => c.atk - a.atk).slice(0, n);
      case 'lowestEnergy': return pool.slice().sort((a, c) => a.energy - c.energy).slice(0, n);
      case 'highestEnergy': return pool.slice().sort((a, c) => c.energy - a.energy).slice(0, n);
      case 'column': {
        const first = ctx.targets[0] ?? pool[0];
        const col = first.pos % 3;
        const same = pool.filter((u) => u.pos % 3 === col || (u.pos >= 3 && (u.pos - 3) === (col % 2)));
        return same.length ? same : [first];
      }
      default: return pool.slice(0, n);
    }
  }

  // ---------- 数值 ----------
  scaleVal(s: Scale, caster: Unit, target?: Unit): number {
    let v = 0;
    if (s.atk) v += s.atk * this.stat(caster, 'atk');
    if (s.def) v += s.def * this.stat(caster, 'def');
    if (s.maxHp) v += s.maxHp * caster.maxHp;
    if (s.curHp) v += s.curHp * caster.hp;
    if (s.missingHp) v += s.missingHp * (caster.maxHp - caster.hp);
    if (s.targetMaxHp && target) v += s.targetMaxHp * target.maxHp;
    return v;
  }

  counterMult(a: FactionId, d: FactionId): number {
    const i = COUNTER_RING.indexOf(a);
    if (COUNTER_RING[(i + 1) % 6] === d) return 1.2;
    const j = COUNTER_RING.indexOf(d);
    if (COUNTER_RING[(j + 1) % 6] === a) return 0.8;
    return 1;
  }

  dealDamage(ctx: Ctx, target: Unit, e: Extract<Effect, { t: 'damage' }>, hitIdx: number, hits: number) {
    const caster = ctx.caster;
    if (!target.alive) return;
    const elem = e.elem ?? 'phys';
    if (target.invuln > 0) { this.push({ t: 'text', uid: target.uid, text: '无敌' }); return; }
    if (this.flag(target, 'dodge')) {
      target.statuses = target.statuses.filter((s) => !STATUS_RULES[s.id]?.flags?.includes('dodge'));
      this.push({ t: 'status', dst: target.uid, id: 'illusion', op: 'remove', stacks: 0, src: caster.uid });
      this.push({ t: 'text', uid: target.uid, text: '闪避' });
      return;
    }
    let base = this.scaleVal(e.scale, caster, target);
    const cm = this.mods(caster);
    const tm = this.mods(target);
    const effDef = this.stat(target, 'def') * (1 - (e.ignoreDef ?? 0));
    const red = elem === 'true' ? 0 : effDef / (effDef + 500 + target.level * 6);
    const critP = caster.crit + cm.critRate + tm.critRate + (e.critBonus ?? 0);
    const crit = !e.noCrit && this.rng.chance(critP);
    ctx.crit = crit;
    let mult = (1 + cm.dmgDealtPct) * caster.dmgMul * (1 + tm.dmgTakenPct) * this.counterMult(caster.faction, target.faction);
    if (crit) mult *= caster.critDmg;
    if ((elem === 'fire' || elem === 'thunder') && this.has(target, 'wet')) mult *= 1.25;
    // 吴·赤壁：同阵营≥2 的火焰技能对淋湿目标额外伤害
    if (elem === 'fire' && caster.faction === 'wu' && this.has(target, 'wet')) mult *= 1 + 0.1 * (this.factionCount[caster.side].wu ?? 0);
    const cctx: Ctx = { ...ctx, targets: [target], crit };
    for (const bn of e.bonus ?? []) if (this.cond(bn.cond, cctx, target)) mult *= bn.mult;
    mult *= 0.95 + this.rng.next() * 0.1;
    const dmg = Math.max(1, Math.round(base * (1 - red) * mult));
    const { absorbed, hpLoss } = this.absorb(target, dmg);
    target.hp -= hpLoss;
    let killed = false;
    if (target.hp <= 0) {
      if (this.flag(target, 'nine')) {
        target.statuses = target.statuses.filter((s) => !STATUS_RULES[s.id]?.flags?.includes('nine'));
        target.hp = Math.max(1, Math.round(target.maxHp * 0.15));
        this.push({ t: 'status', dst: target.uid, id: 'nine', op: 'remove', stacks: 0, src: caster.uid });
        this.push({ t: 'text', uid: target.uid, text: '九命！' });
      } else {
        target.hp = 0;
        killed = true;
      }
    }
    this.push({ t: 'damage', src: caster.uid, dst: target.uid, amount: dmg, crit, elem, hp: target.hp, shield: this.shieldOf(target), killed, hit: hitIdx, hits, absorbed });
    if (e.lifesteal) this.heal(caster, caster, Math.round(dmg * e.lifesteal));
    this.gainEnergy(target, 10);
    cctx.killed = killed;
    ctx.killed = killed;
    if (killed) this.kill(target, caster);
    // 触发
    this.depth++;
    if (this.depth < 6) {
      this.fire('onHit', { caster, targets: [target], crit, killed }, caster);
      if (crit) this.fire('onCrit', { caster, targets: [target], crit, killed }, caster);
      if (!killed) this.fire('onHurt', { caster: target, targets: [caster], source: caster }, target);
      if (!killed) this.checkLowHp(target, caster);
      if (killed) this.fire('onKill', { caster, targets: [target], killed: true }, caster);
    }
    this.depth--;
  }

  absorb(t: Unit, dmg: number) {
    let rest = dmg;
    let absorbed = 0;
    for (const s of t.shield) {
      if (rest <= 0) break;
      const a = Math.min(s.v, rest);
      s.v -= a;
      rest -= a;
      absorbed += a;
    }
    t.shield = t.shield.filter((s) => s.v > 0);
    return { absorbed, hpLoss: rest };
  }

  heal(src: Unit, t: Unit, amount: number) {
    if (!t.alive || amount <= 0) return;
    const tm = this.mods(t);
    const real = Math.min(t.maxHp - t.hp, Math.round(amount * (1 + tm.healTakenPct)));
    if (real <= 0) return;
    t.hp += real;
    this.push({ t: 'heal', src: src.uid, dst: t.uid, amount: real, hp: t.hp });
    if (this.depth < 4) { this.depth++; this.fire('onHealed', { caster: t, targets: [t], source: src }, t); this.depth--; }
  }

  gainEnergy(u: Unit, n: number) {
    if (!u.alive) return;
    const before = u.energy;
    u.energy = Math.max(0, Math.min(150, u.energy + n));
    if (u.energy !== before) this.push({ t: 'energy', uid: u.uid, energy: u.energy });
  }

  kill(dead: Unit, killer: Unit) {
    dead.alive = false;
    dead.statuses = [];
    dead.shield = [];
    this.push({ t: 'death', uid: dead.uid });
    this.depth++;
    if (this.depth < 6) {
      this.fire('onDeath', { caster: dead, targets: [killer], source: killer }, dead);
      for (const ally of this.alive(dead.side)) this.fire('onAllyDeath', { caster: ally, targets: [ally], source: dead }, ally);
      this.factionOnDeath(dead);
    }
    this.depth--;
  }

  checkLowHp(u: Unit, src: Unit) {
    for (const [i, p] of u.kit.passive.passive.entries()) {
      if (p.on !== 'lowHp') continue;
      const key = `low${i}`;
      if ((u.used[key] ?? 0) >= 1) continue;
      if (u.hp / u.maxHp < (p.hpPct ?? 0.3)) {
        u.used[key] = 1;
        this.runPassive(u, p, { caster: u, targets: [u], source: src });
      }
    }
  }

  addStatus(src: Unit, t: Unit, id: string, turns: number, stacks = 1, power = 0, snap = 0) {
    if (!t.alive) return;
    const rule = STATUS_RULES[id];
    if (!rule) throw new Error(`unknown status ${id}`);
    const old = this.has(t, id);
    if (old) {
      old.stacks = Math.min(rule.maxStacks, old.stacks + stacks);
      old.turns = Math.max(old.turns, turns);
      old.power = Math.max(old.power, power);
      old.snap = Math.max(old.snap, snap);
      this.push({ t: 'status', dst: t.uid, id, op: 'add', stacks: old.stacks, src: src.uid });
    } else {
      t.statuses.push({ id, turns, stacks: Math.min(rule.maxStacks, stacks), power, snap, src: src.uid });
      this.push({ t: 'status', dst: t.uid, id, op: 'add', stacks, src: src.uid });
    }
  }

  // ---------- 效果执行 ----------
  exec(effs: Effect[], ctx: Ctx, defaultTargets?: Unit[]) {
    for (const e of effs) {
      const tg = e.to ? this.select(e.to, ctx) : (defaultTargets ?? ctx.targets);
      this.execOne(e, ctx, tg);
    }
  }

  execOne(e: Effect, ctx: Ctx, tg: Unit[]) {
    const caster = ctx.caster;
    switch (e.t) {
      case 'damage': {
        const hits = e.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          for (const t of tg) this.dealDamage(ctx, t, e, h, hits);
        }
        break;
      }
      case 'heal':
        for (const t of tg) this.heal(caster, t, this.scaleVal(e.scale, caster, t));
        break;
      case 'shield':
        for (const t of tg) {
          if (!t.alive) continue;
          const v = Math.round(this.scaleVal(e.scale, caster, t));
          t.shield.push({ v, turns: e.turns });
          this.push({ t: 'shield', src: caster.uid, dst: t.uid, amount: v, total: this.shieldOf(t) });
        }
        break;
      case 'status':
        for (const t of tg) {
          if (e.p !== undefined && !this.rng.chance(e.p)) continue;
          const rule = STATUS_RULES[e.id];
          if (rule?.cc && t.alive && (t.used['ccImmune'] ?? 0) >= this.round) continue;
          this.addStatus(caster, t, e.id, e.turns, e.stacks ?? 1, e.power ?? 0, e.snap ? this.scaleVal(e.snap, caster, t) : 0);
        }
        break;
      case 'energy':
        for (const t of tg) this.gainEnergy(t, e.amount);
        break;
      case 'cleanse':
        for (const t of tg) {
          const kind = e.kind ?? 'debuff';
          let n = e.n ?? 99;
          for (const s of t.statuses.slice()) {
            if (n <= 0) break;
            if (STATUS_RULES[s.id]?.kind === kind) {
              t.statuses = t.statuses.filter((x) => x !== s);
              this.push({ t: 'status', dst: t.uid, id: s.id, op: 'remove', stacks: 0, src: caster.uid });
              n--;
            }
          }
        }
        break;
      case 'revive':
        for (const t of tg) {
          if (t.alive) continue;
          t.alive = true;
          t.hp = Math.max(1, Math.round(t.maxHp * e.hpPct));
          this.push({ t: 'revive', uid: t.uid, hp: t.hp });
        }
        break;
      case 'extraTurn':
        caster.extraTurn = true;
        break;
      case 'counter':
        for (const t of tg) {
          const cur = t.counters[e.key] ?? 0;
          t.counters[e.key] = Math.min(e.max ?? 99, cur + e.add);
        }
        break;
      case 'selfDamage': {
        const loss = Math.round(caster.maxHp * e.pctMaxHp);
        caster.hp = Math.max(1, caster.hp - loss);
        this.push({ t: 'damage', src: caster.uid, dst: caster.uid, amount: loss, crit: false, elem: 'true', hp: caster.hp, shield: this.shieldOf(caster), killed: false, hit: 0, hits: 1, absorbed: 0 });
        break;
      }
      case 'summon': {
        let n = e.count;
        if (e.perCounter) n = Math.max(e.count, caster.counters[e.perCounter] ?? 0);
        if (e.perCounter) caster.counters[e.perCounter] = 0;
        const pool = this.alive(this.foe(caster));
        if (!pool.length) break;
        const hitList: Unit[] = [];
        for (let i = 0; i < n; i++) hitList.push(this.rng.pick(pool.filter((u) => u.alive).length ? pool.filter((u) => u.alive) : pool));
        this.push({ t: 'summon', uid: caster.uid, beast: e.beast, count: n, targets: hitList.map((u) => u.uid) });
        hitList.forEach((t, i) => {
          if (!t.alive) return;
          this.dealDamage(ctx, t, { t: 'damage', scale: e.scale, elem: e.elem ?? 'phys' }, i, n);
          if (e.applyStatus && t.alive) this.addStatus(caster, t, e.applyStatus.id, e.applyStatus.turns, 1, e.applyStatus.power ?? 0, e.applyStatus.snap ? this.scaleVal(e.applyStatus.snap, caster, t) : 0);
        });
        break;
      }
      case 'when': {
        const target = tg[0];
        if (this.cond(e.cond, ctx, target)) this.exec(e.then, ctx, tg);
        else if (e.else) this.exec(e.else, ctx, tg);
        break;
      }
      case 'repeat':
        for (let i = 0; i < e.n; i++) this.exec(e.effects, ctx, tg);
        break;
      case 'text':
        this.push({ t: 'text', uid: caster.uid, text: e.text });
        break;
    }
  }

  // ---------- 被动 ----------
  fire(on: TriggerOn, ctx: Ctx, owner: Unit) {
    if (!owner.alive && on !== 'onDeath') return;
    for (const [i, p] of owner.kit.passive.passive.entries()) {
      if (p.on !== on) continue;
      const key = `${i}:${on}`;
      if (p.limit) {
        const k = p.limit.per === 'round' ? `${key}@${this.round}` : key;
        if ((owner.used[k] ?? 0) >= p.limit.n) continue;
        if (!this.cond(p.cond, { ...ctx, caster: owner }, ctx.targets[0])) continue;
        owner.used[k] = (owner.used[k] ?? 0) + 1;
      } else if (!this.cond(p.cond, { ...ctx, caster: owner }, ctx.targets[0])) continue;
      this.runPassive(owner, p, ctx);
    }
  }

  runPassive(owner: Unit, p: PassiveDef, ctx: Ctx) {
    const c: Ctx = { ...ctx, caster: owner };
    const tg = p.target ? this.select(p.target, c) : [owner];
    this.push({ t: 'passive', uid: owner.uid, name: owner.kit.passive.name });
    this.exec(p.effects, c, tg);
  }

  fireAll(on: TriggerOn, side?: 'A' | 'B') {
    for (const u of this.units.filter((x) => x.alive && (!side || x.side === side))) this.fire(on, { caster: u, targets: [u] }, u);
  }

  // ---------- 阵营机制 ----------
  factionRoundStart() {
    for (const side of ['A', 'B'] as const) {
      const cnt = this.factionCount[side];
      const wei = this.alive(side).filter((u) => u.faction === 'wei');
      if ((cnt.wei ?? 0) >= 2 && wei.length) {
        const t = wei.slice().sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
        const v = Math.round(t.maxHp * 0.05 * (cnt.wei ?? 0));
        t.shield.push({ v, turns: 2 });
        this.push({ t: 'shield', src: t.uid, dst: t.uid, amount: v, total: this.shieldOf(t) });
      }
    }
  }
  factionOnDeath(dead: Unit) {
    const cnt = this.factionCount[dead.side];
    if (dead.faction === 'shu' && (cnt.shu ?? 0) >= 2) {
      for (const u of this.alive(dead.side).filter((x) => x.faction === 'shu')) {
        this.addStatus(dead, u, 'fluff', 2, 1, 0.15);
        this.heal(dead, u, Math.round(u.maxHp * 0.08 * (cnt.shu ?? 0)));
      }
      const any = this.alive(dead.side).find((x) => x.faction === 'shu');
      if (any) this.push({ t: 'text', uid: any.uid, text: '桃园·同心' });
    }
  }
  factionAfterAct(u: Unit, usedBasic: boolean) {
    const cnt = this.factionCount[u.side];
    if (u.faction === 'man' && usedBasic) {
      this.teamCounter[`${u.side}:totem`] = (this.teamCounter[`${u.side}:totem`] ?? 0) + 1;
      if (this.teamCounter[`${u.side}:totem`] >= 6 && (cnt.man ?? 0) >= 2) {
        this.teamCounter[`${u.side}:totem`] = 0;
        const foes = this.alive(this.foe(u));
        if (foes.length) {
          const targets: Unit[] = [this.rng.pick(foes), this.rng.pick(foes), this.rng.pick(foes)];
          this.push({ t: 'summon', uid: u.uid, beast: 'tiger', count: 3, targets: targets.map((x) => x.uid) });
          targets.forEach((t, i) => this.dealDamage({ caster: u, targets: [t] }, t, { t: 'damage', scale: { atk: 0.8 } }, i, 3));
        }
      }
    }
    if (u.faction === 'xian' && (cnt.xian ?? 0) >= 2 && this.rng.chance(0.1 * (cnt.xian ?? 0))) {
      const allies = this.alive(u.side);
      if (allies.length) {
        const t = this.rng.pick(allies);
        this.push({ t: 'text', uid: t.uid, text: '天命' });
        this.gainEnergy(t, 15);
      }
    }
  }

  // ---------- 主循环 ----------
  tickStart(u: Unit) {
    for (const s of u.statuses.slice()) {
      const r = STATUS_RULES[s.id];
      if (r?.dot && u.alive) {
        const dmg = Math.max(1, Math.round(s.snap * s.stacks * (1 - 0)));
        const { hpLoss } = this.absorb(u, dmg);
        u.hp = Math.max(0, u.hp - hpLoss);
        const killed = u.hp <= 0;
        this.push({ t: 'dot', dst: u.uid, id: s.id, amount: dmg, hp: u.hp, killed });
        if (killed) { const src = this.units.find((x) => x.uid === s.src) ?? u; this.kill(u, src); }
      }
      if (r?.hot && u.alive) this.heal(u, u, Math.round(s.power * u.maxHp));
    }
  }
  tickEnd(u: Unit) {
    if (!u.alive) return;
    for (const s of u.statuses.slice()) {
      s.turns -= 1;
      if (s.turns <= 0) {
        u.statuses = u.statuses.filter((x) => x !== s);
        this.push({ t: 'status', dst: u.uid, id: s.id, op: 'remove', stacks: 0, src: s.src });
        if (STATUS_RULES[s.id]?.cc) u.used['ccImmune'] = this.round + 1; // 控制结束后下回合免疫
      }
    }
    for (const s of u.shield) s.turns -= 1;
    u.shield = u.shield.filter((s) => s.turns > 0 && s.v > 0);
    if (u.invuln > 0) u.invuln--;
  }

  act(u: Unit) {
    this.tickStart(u);
    if (!u.alive) return;
    if (this.flag(u, 'stun')) {
      this.push({ t: 'skip', uid: u.uid, reason: 'dizzy' });
      this.tickEnd(u);
      return;
    }
    this.fire('beforeAct', { caster: u, targets: [u] }, u);
    if (!u.alive) return;
    const ult = u.energy >= 100 && !this.flag(u, 'silence');
    const skill = ult ? u.kit.ultimate : u.kit.basic;
    const ctx: Ctx = { caster: u, targets: [], isBasic: !ult };
    const confused = this.flag(u, 'confuse');
    let effects = skill.effects;
    let tsel: TargetSel = skill.target ?? { side: 'enemy', pick: 'front' };
    if (confused) {
      tsel = { side: 'ally', pick: 'random', exclSelf: true };
      effects = [{ t: 'damage', scale: { atk: 1.0 } }];
    }
    let targets = this.select(tsel, ctx, !ult);
    if (!targets.length && confused) targets = this.select({ side: 'enemy', pick: 'front' }, ctx, false);
    if (!targets.length) { this.tickEnd(u); return; }
    ctx.targets = targets;
    if (ult) { u.energy = 0; this.push({ t: 'energy', uid: u.uid, energy: 0 }); }
    this.push({ t: 'act', uid: u.uid, skill: skill.name, fx: skill.fx, kind: ult ? 'ultimate' : 'basic', targets: targets.map((x) => x.uid), melee: !!skill.melee });
    this.fire(ult ? 'onUlt' : 'onBasic', ctx, u);
    if (ult) for (const e of this.alive(this.foe(u))) this.fire('onEnemyUlt', { caster: e, targets: [e], source: u }, e);
    this.exec(effects, ctx, targets);
    if (!ult) this.gainEnergy(u, 20);
    for (const a of this.alive(u.side)) if (a !== u) this.fire('onAllyAct', { caster: a, targets: [a], source: u }, a);
    this.fire('afterAct', ctx, u);
    this.factionAfterAct(u, !ult);
    u.acted++;
    this.tickEnd(u);
  }

  over(): 'A' | 'B' | null {
    if (!this.alive('A').length) return 'B';
    if (!this.alive('B').length) return 'A';
    return null;
  }

  run(): BattleResult {
    this.push({ t: 'start', units: this.units.map((u) => ({ uid: u.uid, side: u.side, pos: u.pos, heroId: u.heroId, name: u.name, maxHp: u.maxHp, hp: u.hp, faction: u.faction })) });
    this.fireAll('battleStart');
    let winner: 'A' | 'B' | 'draw' | null = this.over();
    while (!winner && this.round < this.maxRounds) {
      this.round++;
      this.push({ t: 'round', n: this.round });
      this.factionRoundStart();
      this.fireAll('roundStart');
      const order = this.units.filter((u) => u.alive).sort((a, c) => this.stat(c, 'spd') - this.stat(a, 'spd') || a.pos - c.pos);
      for (const u of order) {
        if (!u.alive) continue;
        this.act(u);
        let guard = 0;
        while (u.alive && u.extraTurn && guard++ < 1 && !this.over()) {
          u.extraTurn = false;
          this.push({ t: 'text', uid: u.uid, text: '再动！' });
          this.act(u);
        }
        u.extraTurn = false;
        winner = this.over();
        if (winner) break;
      }
      if (winner) break;
      this.fireAll('roundEnd');
      winner = this.over();
    }
    if (!winner) {
      const hpA = this.alive('A').reduce((a, u) => a + u.hp / u.maxHp, 0);
      const hpB = this.alive('B').reduce((a, u) => a + u.hp / u.maxHp, 0);
      winner = hpA === hpB ? 'draw' : hpA > hpB ? 'A' : 'B';
    }
    this.push({ t: 'end', winner, rounds: this.round });
    return { events: this.events, winner, rounds: this.round, units: this.units };
  }
}

export { FACTIONS };
