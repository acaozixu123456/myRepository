import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import { unitInfo } from '../data/units';
import { BONDS, COUNTER_BONUS, COUNTER_RING, baseStats } from '../data/systems';
import { KITS, genericKit } from '../data/kits';
import { Rng } from './rng';
import { STATUS_RULES, ZERO_MODS } from './statuses';
import type { Mods } from './statuses';
import type { BEvent, BattleConfig, Cond, Effect, Kit, Patch, PassiveDef, Scale, SkillDef, StatusInst, TargetSel, TriggerOn, Unit, UnitSetup } from './types';

interface Ctx {
  amount?: number; // 触发本次效果的那次受伤量
  caster: Unit;
  targets: Unit[];
  source?: Unit; // 触发来源（被动）
  crit?: boolean;
  killed?: boolean;
  isBasic?: boolean;
  melee?: boolean;
  counter?: boolean; // 装备反击产生的伤害，不再触发反击
  redwall?: boolean; // 本次绝技已触发赤壁琴火
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
    for (const s of cfg.A) if ((s.hpPct ?? 1) > 0) this.units.push(this.makeUnit(s, 'A'));
    for (const s of cfg.B) if ((s.hpPct ?? 1) > 0) this.units.push(this.makeUnit(s, 'B'));
    for (const side of ['A', 'B'] as const) {
      for (const u of this.units.filter((x) => x.side === side)) this.factionCount[side][u.faction] = (this.factionCount[side][u.faction] ?? 0) + 1;
    }
    this.applyBonds();
  }

  makeUnit(s: UnitSetup, side: 'A' | 'B'): Unit {
    const h = unitInfo(s.heroId);
    const bs = baseStats(h.role, h.rarity);
    bs.hp = Math.round(bs.hp * h.hpMul);
    bs.atk = Math.round(bs.atk * h.atkMul);
    const m = lvMul(s.level) * (1 + ((s.star ?? 1) - 1) * 0.08) * (s.statMul ?? 1);
    const kit = clone(KITS[s.heroId] ?? genericKit(s.heroId));
    const skillLv = s.skillLv ?? 1;
    for (const lm of kit.ultimate.levelMods ?? []) if (lm.lv <= skillLv) applyPatch(kit, lm.patch);
    for (const lm of kit.basic.levelMods ?? []) if (lm.lv <= skillLv) applyPatch(kit, lm.patch);
    if ((s.star ?? 1) >= 5 && s.awaken) for (const p of kit.awaken[s.awaken].patches) applyPatch(kit, p);
    const roleCrit = h.role === '刺客' ? 0.12 : h.role === '神射' ? 0.08 : 0.05;
    const g = s.gear ?? {};
    const maxHp = Math.round(bs.hp * m) + Math.round(g.hp ?? 0);
    return {
      uid: this.uidSeq++, side, pos: s.pos, heroId: s.heroId, name: h.name, faction: h.faction, role: h.role, level: s.level,
      maxHp, hp: Math.max(1, Math.round(maxHp * (s.hpPct ?? 1))), atk: Math.round(bs.atk * m) + Math.round(g.atk ?? 0), def: Math.round(bs.def * m) + Math.round(g.def ?? 0), spd: bs.spd + Math.round(g.spd ?? 0), crit: roleCrit + (g.crit ?? 0), critDmg: 1.5 + (g.critDmg ?? 0),
      energy: s.energy ?? (typeof this.cfg.startEnergy === 'object' ? this.cfg.startEnergy[side] : (this.cfg.startEnergy ?? 0)), shield: [], statuses: [], alive: true, kit, counters: {}, used: {}, acted: 0, extraTurn: false, invuln: 0, dmgMul: 1,
      hit: g.hit ?? 0, dodge: g.dodge ?? 0, dmgReduce: Math.min(0.6, g.dmgReduce ?? 0), healBonus: g.healBonus ?? 0, set4: s.set4 ?? [],
    };
  }

  // ---------- 关卡规则 ----------
  ruleSideMatch(rs: 'A' | 'B' | 'both', side: 'A' | 'B') { return rs === 'both' || rs === side; }
  ruleTo(to: string | undefined, u: Unit) {
    if (!to || to === 'all') return true;
    if (to === 'front') return u.pos <= 2;
    if (to === 'back') return u.pos >= 3;
    if (to.startsWith('faction:')) return u.faction === to.slice(8);
    if (to.startsWith('role:')) return u.role === to.slice(5);
    return false;
  }
  /** needFactions：该方含不少于 N 个不同阵营才生效 */
  ruleOk(r: import('./types').RuleFx, side: 'A' | 'B') {
    return !r.needFactions || Object.keys(this.factionCount[side]).length >= r.needFactions;
  }
  applyRuleStart() {
    for (const r of this.cfg.rules ?? []) {
      const picked = 'pick' in r && r.pick ? new Set((['A', 'B'] as const).map((sd) => this.alive(sd)[0] && this.pickBySpd(r.pick!, this.alive(sd)[0], r, 'start'))) : null;
      for (const u of this.units) {
        if (!u.alive || !('side' in r) || !this.ruleSideMatch(r.side, u.side) || !this.ruleOk(r, u.side) || !('to' in r) || !this.ruleTo(r.to, u)) continue;
        if (r.t === 'startStatus') { if (picked && !picked.has(u)) continue; this.addStatus(u, u, r.id, r.turns, r.stacks ?? 1, r.power ?? 0); }
        else if (r.t === 'startShield') this.addShieldPct(u, u, r.pct, r.turns);
        else if (r.t === 'startEnergy') this.gainEnergy(u, r.amount);
        else if (r.t === 'critAdd') u.crit += r.add;
        else if (r.t === 'dodgeAdd' && !r.rounds) u.dodge += r.add;
        else if (r.t === 'hitAdd' && !r.rounds) u.hit += r.add;
      }
    }
  }
  applyRuleRound() {
    for (const r of this.cfg.rules ?? []) {
      if (r.t === 'roundStatus' && (r.at ? this.round === r.at : this.round % r.every === 0)) {
        const picked = r.pick ? new Set((['A', 'B'] as const).map((sd) => this.alive(sd)[0] && this.pickBySpd(r.pick!, this.alive(sd)[0], r, 'round'))) : null;
        for (const u of this.units) if (u.alive && this.ruleSideMatch(r.side, u.side) && this.ruleOk(r, u.side) && this.ruleTo(r.to, u) && (!picked || picked.has(u))) this.addStatus(u, u, r.id, r.turns, 1, r.power ?? 0);
      }
      if (r.t === 'roundEnergyLowest') {
        for (const side of ['A', 'B'] as const) {
          if (!this.ruleSideMatch(r.side, side) || !this.ruleOk(r, side)) continue;
          const t = this.alive(side).slice().sort((a, c) => a.energy - c.energy || a.pos - c.pos)[0];
          if (t) this.gainEnergy(t, r.amount);
        }
      }
    }
  }
  /** 伤害倍率：dmgMul 看出手者，takenMul 看受击者 */
  ruleMul(kind: 'dmgMul' | 'takenMul', u: Unit, elem?: string): number {
    let m = 1;
    for (const r of this.cfg.rules ?? []) {
      if (r.t !== kind || !this.ruleSideMatch(r.side, u.side) || !this.ruleOk(r, u.side)) continue;
      if (r.elem && r.elem !== elem) continue;
      if (r.rounds && this.round > r.rounds) continue;
      if (!this.ruleTo(r.to, u)) continue;
      if (r.t === 'takenMul') {
        if (r.needShield && !u.shield.some((s) => s.v > 0)) continue;
        if (r.needStatus && !this.has(u, r.needStatus)) continue;
      }
      m *= r.mult;
    }
    return m;
  }
  ruleHealMul(src: Unit, t: Unit): number {
    let m = 1;
    for (const r of this.cfg.rules ?? []) {
      if (r.t === 'healMul' && this.ruleSideMatch(r.side, t.side) && this.ruleOk(r, t.side) && (!r.needStatus || this.has(t, r.needStatus))) m *= r.mult;
      if (r.t === 'firstHealMul' && this.ruleSideMatch(r.side, src.side) && this.ruleOk(r, src.side) && this.ruleTo(r.to, src) && this.onceBy(src, `r_fh${this.cfg.rules!.indexOf(r)}`)) m *= r.mult;
      if (r.t === 'firstHealTakenMul' && this.ruleSideMatch(r.side, t.side) && this.ruleOk(r, t.side) && this.ruleTo(r.to, t) && this.onceBy(t, `r_ft${this.cfg.rules!.indexOf(r)}`)) m *= r.mult;
    }
    return m;
  }
  ruleDodge(u: Unit): number {
    let d = 0;
    for (const r of this.cfg.rules ?? []) if (r.t === 'dodgeAdd' && r.rounds && this.round <= r.rounds && this.ruleSideMatch(r.side, u.side) && this.ruleOk(r, u.side) && this.ruleTo(r.to, u)) d += r.add;
    return d;
  }
  ruleHit(u: Unit): number {
    let d = 0;
    for (const r of this.cfg.rules ?? []) if (r.t === 'hitAdd' && r.rounds && this.round <= r.rounds && this.ruleSideMatch(r.side, u.side) && this.ruleOk(r, u.side) && this.ruleTo(r.to, u)) d += r.add;
    return d;
  }
  /** 同阵营里速度最高 / 最低的那只（用于 pick） */
  pickBySpd(pick: 'highestSpd' | 'lowestSpd', u: Unit, _r: unknown, _when: string): Unit {
    const mates = this.alive(u.side);
    return mates.slice().sort((a, c) => (pick === 'highestSpd' ? this.stat(c, 'spd') - this.stat(a, 'spd') : this.stat(a, 'spd') - this.stat(c, 'spd')) || a.pos - c.pos)[0];
  }
  ruleWho(who: import('./types').RuleWho, actor: Unit, target?: Unit): Unit[] {
    switch (who) {
      case 'actor': return [actor];
      case 'target': return target ? [target] : [];
      case 'allies': return this.alive(actor.side);
      case 'foes': return this.alive(this.foe(actor));
      case 'lowestAlly': { const t = this.alive(actor.side).slice().sort((a, c) => a.energy - c.energy || a.pos - c.pos)[0]; return t ? [t] : []; }
      case 'randomFoeFront': { const f = this.alive(this.foe(actor)); const front = f.filter((x) => x.pos <= 2); const pool = front.length ? front : f; return pool.length ? [this.rng.pick(pool)] : []; }
    }
  }
  /** 绝技预告：第一次满元气只发出预告并改打普攻，下一次行动才放绝技 */
  telegraphs(u: Unit): boolean {
    for (const [i, r] of (this.cfg.rules ?? []).entries()) {
      if (r.t !== 'telegraph' || !this.ruleSideMatch(r.side, u.side) || !this.ruleOk(r, u.side) || !this.ruleTo(r.to, u) || (r.hero && u.heroId !== r.hero)) continue;
      const k = `tg${i}`;
      if (u.used[k] === -2) continue; // first：已经放过，不再预告
      if (u.used[k] === -1) { u.used[k] = r.first ? -2 : 0; continue; } // 已预告过：这次放绝技
      u.used[k] = -1; // 标记“已预告”，下次行动放
      this.push({ t: 'text', uid: u.uid, text: '预告：绝技！' });
      return true;
    }
    return false;
  }
  ruleCnt: Record<string, number> = {};
  /** 触发事件规则 */
  ruleEvent(ev: import('./types').RuleEv, actor: Unit, target?: Unit, info?: { status?: string; inst?: import('./types').StatusInst }) {
    const rules = this.cfg.rules;
    if (!rules) return;
    for (const [i, r] of rules.entries()) {
      if (r.t !== 'on' || r.ev !== ev || !this.ruleSideMatch(r.side, actor.side) || !this.ruleOk(r, actor.side) || !this.ruleTo(r.to, actor)) continue;
      if (r.hero && actor.heroId !== r.hero) continue;
      if (r.hpBelow !== undefined && actor.hp / actor.maxHp >= r.hpBelow) continue;
      if (r.status && info?.status !== r.status) continue;
      if (r.cc && !(info?.status && STATUS_RULES[info.status]?.cc)) continue;
      const per = r.per ?? 'actor';
      const scope = per === 'actor' ? `${actor.uid}` : per === 'side' ? actor.side : `${actor.side}@${this.round}`;
      const key = `${i}|${scope}`;
      const n = (this.ruleCnt[key + '|n'] = (this.ruleCnt[key + '|n'] ?? 0) + 1);
      if (n % (r.every ?? 1) !== 0) continue;
      const fired = this.ruleCnt[key + '|f'] ?? 0;
      if (fired >= (per === 'round' ? 1 : r.max ?? 1)) continue;
      this.ruleCnt[key + '|f'] = fired + 1;
      const a = r.act;
      if (a.k === 'extend') { if (info?.inst) info.inst.turns += a.turns; continue; }
      if (a.k === 'totem') { this.teamCounter[`${actor.side}:totem`] = (this.teamCounter[`${actor.side}:totem`] ?? 0) + a.amount; continue; }
      for (const t of this.ruleWho(a.who, actor, target)) {
        if (a.k === 'energy') this.gainEnergy(t, a.amount);
        else if (a.k === 'status') this.addStatus(actor, t, a.id, a.turns, a.stacks ?? 1, a.power ?? 0, a.snapAtk ? Math.round(actor.atk * a.snapAtk) : 0);
        else if (a.k === 'shield') this.addShieldPct(actor, t, a.pct, a.turns);
        else if (a.k === 'heal') this.heal(actor, t, Math.round(t.maxHp * a.pct));
        else if (a.k === 'cleanse') {
          let left = a.n;
          for (const s of t.statuses.slice()) { if (left <= 0) break; if (STATUS_RULES[s.id]?.kind === 'debuff') { t.statuses = t.statuses.filter((x) => x !== s); this.push({ t: 'status', dst: t.uid, id: s.id, op: 'remove', stacks: 0, src: actor.uid }); left--; } }
        } else if (a.k === 'removeStack') {
          const s = this.has(t, a.id);
          if (s) { s.stacks -= 1; if (s.stacks <= 0) { t.statuses = t.statuses.filter((x) => x !== s); this.push({ t: 'status', dst: t.uid, id: a.id, op: 'remove', stacks: 0, src: actor.uid }); } }
        }
      }
    }
  }
  ruleFirstBasic(u: Unit) {
    for (const [i, r] of (this.cfg.rules ?? []).entries()) {
      if (r.t === 'firstBasicEnergy' && this.ruleSideMatch(r.side, u.side) && this.ruleOk(r, u.side) && this.ruleTo(r.to, u) && this.onceBy(u, `r_fb${i}`)) this.gainEnergy(u, r.amount);
    }
  }

  /** 已激活的命名羁绊（按阵营） */
  bondsOn: Record<'A' | 'B', Set<string>> = { A: new Set(), B: new Set() };
  hasBond(side: 'A' | 'B', name: string) { return this.bondsOn[side].has(name); }

  /** 放大最大生命时保持当前生命比例（多波战斗继承的残血不会被羁绊 / 阵营加成“回满”） */
  scaleMaxHp(u: Unit, k: number) {
    const r = u.hp / u.maxHp;
    u.maxHp = Math.round(u.maxHp * k);
    u.hp = Math.max(1, Math.round(u.maxHp * r));
  }

  applyBonds() {
    for (const side of ['A', 'B'] as const) {
      const ids = new Set(this.units.filter((u) => u.side === side).map((u) => u.heroId));
      const mine = this.units.filter((u) => u.side === side);
      for (const bond of this.cfg.noBonds ? [] : BONDS) {
        if (!bond.heroes.every((h) => ids.has(h))) continue;
        const members = mine.filter((u) => bond.heroes.includes(u.heroId));
        this.bondsOn[side].add(bond.name);
        if (bond.name === '桃园结义') for (const u of members) { this.scaleMaxHp(u, 1.2); u.atk = Math.round(u.atk * 1.2); u.def = Math.round(u.def * 1.2); }
        if (bond.name === '美人连环') for (const u of mine) if (u.heroId === 'qun_lvbuding') u.atk = Math.round(u.atk * 1.25);
        if (bond.name === '七擒七纵') for (const u of mine) if (u.faction === 'man') { this.scaleMaxHp(u, 1.15); }
        if (bond.name === '江东之虎') for (const u of mine) if (u.faction === 'wu') u.crit += 0.15;
        if (bond.name === '魏武之道') for (const u of mine) if (u.faction === 'wei') u.dmgMul *= 1.05;
      }
      // 同阵营基础加成
      const cnt = this.factionCount[side];
      for (const u of mine) {
        const n = cnt[u.faction] ?? 0;
        const k = n >= 5 ? 0.1 : n >= 3 ? 0.05 : 0;
        if (k) { u.atk = Math.round(u.atk * (1 + k)); this.scaleMaxHp(u, 1 + k); }
        if (u.faction === 'qun') u.critDmg += 0.1 * (Object.keys(cnt).length - 1);
        if (u.faction === 'shu' && n >= 2) u.crit += 0.02 * n; // 蜀·同心：蜀越多暴击越高
      }
    }
  }

  // ---------- 装备四件套特效 ----------
  has4(u: Unit, id: string) { return u.set4.includes(id); }
  onceBy(u: Unit, key: string, per: 'battle' | 'round' = 'battle'): boolean {
    const v = u.used[key];
    if (per === 'round' ? v === this.round : v) return false;
    u.used[key] = per === 'round' ? this.round : 1;
    return true;
  }
  addShieldPct(src: Unit, t: Unit, pct: number, turns: number) {
    if (!t.alive) return;
    const v = Math.round(src.maxHp * pct);
    t.shield.push({ v, turns });
    this.push({ t: 'shield', src: src.uid, dst: t.uid, amount: v, total: this.shieldOf(t) });
  }
  gearOnDamage(ctx: Ctx, caster: Unit, target: Unit, crit: boolean, killed: boolean, hitIdx: number) {
    // 受击方
    if (target.set4.length && target.alive) {
      if (this.has4(target, 'shu_peach_guard') && target.hp / target.maxHp < 0.3 && this.onceBy(target, 's_peach')) { this.addShieldPct(target, target, 0.15, 2); this.push({ t: 'text', uid: target.uid, text: '桃园守约' }); }
      if (this.has4(target, 'qun_box_lord') && crit && this.onceBy(target, 's_box')) { this.addShieldPct(target, target, 0.18, 2); this.push({ t: 'text', uid: target.uid, text: '合上箱盖' }); }
      if (this.has4(target, 'wu_warm_blanket') && ctx.melee && !ctx.counter && caster.alive && this.onceBy(target, 's_blanket', 'round')) {
        this.push({ t: 'text', uid: target.uid, text: '热毯反击' });
        this.dealDamage({ caster: target, targets: [caster], counter: true }, caster, { t: 'damage', scale: { atk: 0.4 }, elem: 'fire' }, 0, 1);
      }
    }
    // 攻击方
    if (caster.set4.length) {
      if (this.has4(caster, 'qun_moon_bell') && crit && this.onceBy(caster, 's_bell', 'round')) this.gainEnergy(caster, 8);
      if (this.has4(caster, 'wu_redwall') && !ctx.isBasic && !ctx.redwall && target.alive && this.has(target, 'wet')) {
        ctx.redwall = true;
        this.addStatus(caster, target, 'burn', 2, 1, 0, Math.round(caster.atk * 0.2));
        this.push({ t: 'text', uid: caster.uid, text: '琴火' });
      }
    }
    void killed; void hitIdx;
  }
  gearBattleStart() {
    for (const u of this.units) {
      if (!u.alive || !u.set4.length) continue;
      const mates = this.alive(u.side);
      if (this.has4(u, 'wei_tiger_guard')) {
        const t = mates.slice().sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.pos - c.pos)[0];
        if (t) { this.addShieldPct(u, t, 0.12, 2); this.push({ t: 'text', uid: u.uid, text: '虎卫玄甲' }); }
      }
      if (this.has4(u, 'wei_sleep_strategy')) {
        const t = mates.slice().sort((a, c) => a.energy - c.energy || a.pos - c.pos)[0];
        if (t) { this.gainEnergy(t, 15); this.push({ t: 'text', uid: u.uid, text: '静夜锦囊' }); }
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
  flag(u: Unit, f: 'stun' | 'silence' | 'taunt' | 'confuse' | 'dodge' | 'nine' | 'stealth'): boolean {
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
      case 'allyCount': { const n = this.alive(c.side === 'enemy' ? this.foe(ctx.caster) : ctx.caster.side).length; return n >= (c.atLeast ?? 0) && n <= (c.atMost ?? 99); }
      case 'teamCounter': return (this.teamCounter[`${ctx.caster.side}:${c.key}`] ?? 0) >= c.atLeast;
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
    if (sel.side === 'enemy' && sel.pick !== 'all' && sel.pick !== 'frontRow' && sel.pick !== 'backRow') { const visible = pool.filter((u) => !this.flag(u, 'stealth')); if (visible.length) pool = visible; } // 潜行：单体技能选不中（全体不受影响）
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
  scaleVal(s: Scale, caster: Unit, target?: Unit, amount = 0): number {
    let v = 0;
    if (s.atk) v += s.atk * this.stat(caster, 'atk');
    if (s.def) v += s.def * this.stat(caster, 'def');
    if (s.maxHp) v += s.maxHp * caster.maxHp;
    if (s.curHp) v += s.curHp * caster.hp;
    if (s.missingHp) v += s.missingHp * (caster.maxHp - caster.hp);
    if (s.targetMaxHp && target) v += s.targetMaxHp * target.maxHp;
    if (s.hurt) v += s.hurt * amount;
    return v;
  }

  counterMult(a: FactionId, d: FactionId): number {
    const i = COUNTER_RING.indexOf(a);
    if (COUNTER_RING[(i + 1) % 6] === d) return 1 + COUNTER_BONUS;
    const j = COUNTER_RING.indexOf(d);
    if (COUNTER_RING[(j + 1) % 6] === a) return 1 - COUNTER_BONUS;
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
    const dodgeP = target.dodge + (this.cfg.rules ? this.ruleDodge(target) : 0) - caster.hit - (this.cfg.rules ? this.ruleHit(caster) : 0);
    if (dodgeP > 0 && this.rng.chance(Math.min(0.6, dodgeP))) {
      this.push({ t: 'text', uid: target.uid, text: '闪避' });
      return;
    }
    let base = this.scaleVal(e.scale, caster, target, ctx.amount);
    const cm = this.mods(caster);
    const tm = this.mods(target);
    const effDef = this.stat(target, 'def') * (1 - (e.ignoreDef ?? 0));
    const red = elem === 'true' ? 0 : effDef / (effDef + 500 + target.level * 6);
    const critP = caster.crit + cm.critRate + tm.critRate + (e.critBonus ?? 0);
    const crit = !e.noCrit && this.rng.chance(critP);
    ctx.crit = crit;
    let mult = (1 + cm.dmgDealtPct) * caster.dmgMul * (1 + tm.dmgTakenPct) * this.counterMult(caster.faction, target.faction);
    if (crit) mult *= caster.critDmg;
    if (caster.faction === 'man' && (this.factionCount[caster.side].man ?? 0) >= 2) mult *= 1 + 0.5 * (1 - caster.hp / caster.maxHp); // 蛮·野性：生命越低攻击越高
    if (target.dmgReduce) mult *= 1 - target.dmgReduce;
    if (this.cfg.rules) mult *= this.ruleMul('dmgMul', caster, elem) * this.ruleMul('takenMul', target, elem);
    if ((elem === 'fire' || elem === 'thunder') && this.has(target, 'wet')) mult *= 1.25;
    if (this.hasBond(caster.side, '江东之虎') && this.has(target, 'burn')) mult *= 1.1;
    // 吴·赤壁：同阵营≥2 的火焰技能对淋湿目标额外伤害
    if (elem === 'fire' && caster.faction === 'wu' && this.has(target, 'wet')) mult *= 1 + 0.1 * (this.factionCount[caster.side].wu ?? 0);
    const cctx: Ctx = { ...ctx, targets: [target], crit };
    for (const bn of e.bonus ?? []) if (this.cond(bn.cond, cctx, target)) mult *= bn.mult;
    mult *= 0.95 + this.rng.next() * 0.1;
    const dmg = Math.max(1, Math.round(base * (1 - red) * mult));
    const hadShield = target.shield.length;
    const { absorbed, hpLoss } = this.absorb(target, dmg);
    const broke = hadShield > 0 && target.shield.length < hadShield;
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
    this.gearOnDamage(ctx, caster, target, crit, killed, hitIdx);
    if (this.cfg.rules) {
      if (ctx.isBasic && !ctx.counter) this.ruleEvent('basicHit', caster, target);
      if (crit) this.ruleEvent('crit', caster, target);
      this.ruleEvent('hurt', target, caster);
      if (absorbed > 0 && broke) this.ruleEvent('shieldBreak', target, caster);
    }
    cctx.killed = killed;
    ctx.killed = killed;
    if (killed) { if (caster.faction === 'qun' && (this.factionCount[caster.side].qun ?? 0) >= 2) { this.gainEnergy(caster, 15); } this.kill(target, caster); }
    // 触发
    this.depth++;
    if (this.depth < 6) {
      this.fire('onHit', { caster, targets: [target], crit, killed }, caster);
      if (crit) this.fire('onCrit', { caster, targets: [target], crit, killed }, caster);
      if (!killed) this.fire('onHurt', { caster: target, targets: [caster], source: caster, amount: dmg }, target);
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
    if (!t.alive || amount <= 0 || t.hp >= t.maxHp) return;
    const tm = this.mods(t);
    const shuN = src.faction === 'shu' ? (this.factionCount[src.side].shu ?? 0) : 0;
    const bondHeal = (this.hasBond(src.side, '杏林同盟') ? 1.2 : 1) * (1 + src.healBonus) * (shuN >= 2 ? 1 + 0.05 * shuN : 1) * (this.cfg.rules ? this.ruleHealMul(src, t) : 1);
    const real = Math.min(t.maxHp - t.hp, Math.round(amount * bondHeal * (1 + tm.healTakenPct)));
    if (real <= 0) return;
    t.hp += real;
    this.push({ t: 'heal', src: src.uid, dst: t.uid, amount: real, hp: t.hp });
    if (this.cfg.rules) this.ruleEvent('heal', src, t);
    if (this.depth < 4) { this.depth++; this.fire('onHealed', { caster: t, targets: [t], source: src }, t); this.depth--; }
  }

  gainEnergy(u: Unit, n: number) {
    if (!u.alive) return;
    const before = u.energy;
    if (n > 0 && u.heroId === 'wei_caomiaode' && this.hasBond(u.side, '魏武之道')) n = Math.round(n * 1.2);
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
    if (id === 'nip' && this.hasBond(src.side, '美人连环')) turns += 1;
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
    if (this.cfg.rules) this.ruleEvent('statusApply', src, t, { status: id, inst: this.has(t, id) });
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
        for (const t of tg) this.heal(caster, t, this.scaleVal(e.scale, caster, t, ctx.amount));
        break;
      case 'shield':
        for (const t of tg) {
          if (!t.alive) continue;
          let v = Math.round(this.scaleVal(e.scale, caster, t, ctx.amount));
          if (caster.faction === 'wei' && this.hasBond(caster.side, '魏武之道')) v = Math.round(v * 1.3);
          t.shield.push({ v, turns: e.turns });
          this.push({ t: 'shield', src: caster.uid, dst: t.uid, amount: v, total: this.shieldOf(t) });
        }
        break;
      case 'status':
        for (const t of tg) {
          const rule = STATUS_RULES[e.id];
          let p = e.p;
          if (rule?.cc && p !== undefined && this.has4(caster, 'xian_star_scroll') && this.onceBy(caster, 's_scroll')) p = Math.min(1, p + 0.15);
          if (p !== undefined && !this.rng.chance(p)) continue;
          if (rule?.cc && t.alive && (t.used['ccImmune'] ?? 0) >= this.round) {
            if (this.has4(caster, 'shu_eastwind') && this.onceBy(caster, 's_wind')) this.gainEnergy(caster, 20);
            continue;
          }
          if (e.id === 'yarn' && this.has4(t, 'xian_cloud_mat') && this.onceBy(t, 's_cloud')) { this.push({ t: 'text', uid: t.uid, text: '云台免疫' }); continue; }
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
              if (this.cfg.rules) this.ruleEvent('cleanse', caster, t, { status: s.id });
            }
          }
          if (this.hasBond(caster.side, '杏林同盟') && n !== (e.n ?? 99) && t.alive) this.addStatus(caster, t, 'purr', 1, 1, 0.05);
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
      case 'detonate': {
        for (const t of tg) {
          const st = this.has(t, e.id);
          if (!st || !t.alive) continue;
          const layers = Math.max(0, st.stacks - (e.keep ?? 0));
          if (layers <= 0) continue;
          st.stacks -= layers;
          if (st.stacks <= 0) { t.statuses = t.statuses.filter((x) => x !== st); this.push({ t: 'status', dst: t.uid, id: e.id, op: 'remove', stacks: 0, src: caster.uid }); }
          this.dealDamage(ctx, t, { t: 'damage', scale: { atk: e.per * layers }, elem: e.elem ?? 'fire', noCrit: true }, 0, 1);
        }
        break;
      }
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
    if (this.hasBond(dead.side, '桃园结义') && BONDS[0].heroes.includes(dead.heroId)) {
      for (const u of this.alive(dead.side).filter((x) => BONDS[0].heroes.includes(x.heroId))) this.addStatus(dead, u, 'fluff', 3, 1, 0.3);
      const any = this.alive(dead.side).find((x) => BONDS[0].heroes.includes(x.heroId));
      if (any) this.push({ t: 'text', uid: any.uid, text: '桃园·结义' });
    }
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
      if (this.teamCounter[`${u.side}:totem`] >= (this.hasBond(u.side, '七擒七纵') ? 5 : 6) && (cnt.man ?? 0) >= 2) {
        this.teamCounter[`${u.side}:totem`] = 0;
        const foes = this.alive(this.foe(u));
        if (foes.length) {
          const targets: Unit[] = [this.rng.pick(foes), this.rng.pick(foes), this.rng.pick(foes)];
          this.push({ t: 'summon', uid: u.uid, beast: 'tiger', count: 3, targets: targets.map((x) => x.uid) });
          targets.forEach((t, i) => this.dealDamage({ caster: u, targets: [t] }, t, { t: 'damage', scale: { atk: 0.8 } }, i, 3));
        }
      }
    }
    if (usedBasic && this.has4(u, 'man_beast_drum') && (this.teamCounter[`${u.side}:totem`] ?? 0) >= 3 && this.onceBy(u, 's_drum', 'round')) {
      const foes = this.alive(this.foe(u));
      if (foes.length) { this.push({ t: 'text', uid: u.uid, text: '百兽应声' }); this.dealDamage({ caster: u, targets: [], counter: true }, this.rng.pick(foes), { t: 'damage', scale: { atk: 0.2 } }, 0, 1); }
    }
    if (u.faction === 'xian' && (cnt.xian ?? 0) >= 2 && this.rng.chance(0.1 * (cnt.xian ?? 0) + (this.hasBond(u.side, '天机四象') ? 0.15 : 0))) {
      const allies = this.alive(u.side);
      if (allies.length) {
        const t = this.rng.pick(allies);
        this.push({ t: 'text', uid: t.uid, text: '天命' });
        const roll = this.rng.next();
        if (roll < 0.55) this.gainEnergy(t, 15);
        else if (roll < 0.85) { if (!this.flag(t, 'nine')) this.addStatus(u, t, 'nine', 2); else this.gainEnergy(t, 15); } // 抵挡一次致命伤害
        else if (this.onceBy(t, 'xian_extra', 'round')) { t.extraTurn = true; this.push({ t: 'text', uid: t.uid, text: '天命·再动' }); } // 额外行动
        else this.gainEnergy(t, 15);
      }
    }
  }

  // ---------- 主循环 ----------
  tickStart(u: Unit) {
    for (const s of u.statuses.slice()) {
      if (!u.statuses.includes(s)) continue; // 本轮结算中途被清除（睡着 / 被唤醒）的状态不再结算
      const r = STATUS_RULES[s.id];
      if (r?.dot && u.alive) {
        let dmg = Math.max(1, Math.round(s.snap * s.stacks));
        const srcSide = this.units.find((x) => x.uid === s.src)?.side ?? this.foe(u);
        if (s.id === 'burn' && this.hasBond(srcSide, '火烧赤壁')) dmg = Math.round(dmg * 1.3);
        const { hpLoss } = this.absorb(u, dmg);
        u.hp = Math.max(0, u.hp - hpLoss);
        const killed = u.hp <= 0;
        this.push({ t: 'dot', dst: u.uid, id: s.id, amount: dmg, hp: u.hp, killed });
        if (killed && this.flag(u, 'nine')) { // 九命也能挡持续伤害
          u.statuses = u.statuses.filter((x) => !STATUS_RULES[x.id]?.flags?.includes('nine'));
          u.hp = Math.max(1, Math.round(u.maxHp * 0.15));
          this.push({ t: 'status', dst: u.uid, id: 'nine', op: 'remove', stacks: 0, src: s.src });
          this.push({ t: 'text', uid: u.uid, text: '九命！' });
        } else if (killed) { const src = this.units.find((x) => x.uid === s.src) ?? u; this.kill(u, src); }
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
    if (u.set4.includes('man_rattan_nest')) for (const s of u.shield) if (s.turns <= 0 && s.v > 0) this.heal(u, u, Math.round(s.v * 0.2));
    if (this.cfg.rules) for (const s of u.shield) if (s.turns <= 0 && s.v > 0) this.ruleEvent('shieldExpire', u);
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
    let ult = u.energy >= 100 && !this.flag(u, 'silence');
    if (ult && this.cfg.rules && this.telegraphs(u)) ult = false;
    const skill = ult ? u.kit.ultimate : u.kit.basic;
    const ctx: Ctx = { caster: u, targets: [], isBasic: !ult, melee: !!skill.melee };
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
    if (!ult) { this.gainEnergy(u, 20); if (this.cfg.rules) { this.ruleFirstBasic(u); this.ruleEvent('basic', u, targets[0]); } }
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
    this.gearBattleStart();
    this.applyRuleStart();
    let winner: 'A' | 'B' | 'draw' | null = this.over();
    while (!winner && this.round < this.maxRounds) {
      this.round++;
      this.push({ t: 'round', n: this.round });
      this.factionRoundStart();
      this.applyRuleRound();
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
