import { afterEach, describe, expect, it } from 'vitest';
import { HERO_BY_ID } from '../src/data/heroes';
import type { HeroDef } from '../src/data/heroes';
import type { FactionId } from '../src/data/factions';
import { KITS } from '../src/data/kits';
import { enemy, self, status } from '../src/data/kits/helpers';
import { COUNTER_BONUS } from '../src/data/systems';
import { simulate } from '../src/engine/battle';
import type { BattleResult } from '../src/engine/battle';
import type { BEvent, BattleConfig, Effect, Kit, PassiveDef, TargetSel, UnitSetup } from '../src/engine/types';

// 同一载体保持职业、稀有度和面板一致；只有待测规则不同。
// 不调用引擎内部方法，不复制伤害公式；倍率用同种子对照的实际事件验证。
let sequence = 0;
const originals = new Map<string, { hero: HeroDef | undefined; kit: Kit | undefined }>();
type ProbeKit = { basic?: Effect[]; ultimate?: Effect[]; target?: TargetSel; passive?: PassiveDef[] };

function install(id: string, faction: FactionId, kit: ProbeKit = {}): string {
  if (!originals.has(id)) originals.set(id, { hero: HERO_BY_ID[id], kit: KITS[id] });
  HERO_BY_ID[id] = { ...(HERO_BY_ID[id] ?? HERO_BY_ID.shu_guanyunmiao), id, faction };
  const skill = (name: string, effects: Effect[]) => ({
    id: `${id}_${name}`, name, desc: '仅测试用技能', fx: 'melee.slash',
    target: kit.target ?? enemy('all'), effects,
  });
  KITS[id] = {
    heroId: id,
    basic: skill('普攻', kit.basic ?? []),
    ultimate: skill('绝技', kit.ultimate ?? kit.basic ?? []),
    passive: { id: `${id}_passive`, name: '规则探针', desc: '仅测试用被动', passive: kit.passive ?? [] },
    awaken: {
      A: { name: '测试 A', desc: '不加觉醒效果', patches: [] },
      B: { name: '测试 B', desc: '不加觉醒效果', patches: [] },
    },
  };
  return id;
}

const probe = (faction: FactionId = 'wei', kit: ProbeKit = {}) => install(`__engine_rules_${++sequence}`, faction, kit);
const setup = (heroId: string, extra: Partial<UnitSetup> = {}): UnitSetup => ({ heroId, level: 1, star: 1, skillLv: 1, pos: 0, ...extra });
const lineup = (ids: string[]): UnitSetup[] => ids.map((id, pos) => setup(id, { pos }));
const run = (cfg: Pick<BattleConfig, 'A' | 'B'> & Partial<BattleConfig>): BattleResult => simulate({ seed: 31, maxRounds: 1, noBonds: true, ...cfg });
const duel = (a: string, b: string): BattleResult => run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b)] });
const damage = (scale: Extract<Effect, { t: 'damage' }>['scale'], extra: Partial<Extract<Effect, { t: 'damage' }>> = {}): Effect => ({ t: 'damage', scale, elem: 'true', noCrit: true, ...extra });
const opening = (effects: Effect[], target?: TargetSel): PassiveDef[] => [{ on: 'battleStart', effects, target }];
const events = <T extends BEvent['t']>(r: BattleResult, t: T): Extract<BEvent, { t: T }>[] => r.events.filter((e): e is Extract<BEvent, { t: T }> => e.t === t);
const unit = (r: BattleResult, heroId: string) => {
  const found = r.units.find((u) => u.heroId === heroId);
  if (!found) throw new Error(`missing test unit ${heroId}`);
  return found;
};
const hits = (r: BattleResult, a: string, b: string) => events(r, 'damage').filter((e) => e.src === unit(r, a).uid && e.dst === unit(r, b).uid);
function roundsOf(r: BattleResult, predicate: (e: BEvent) => boolean): number[] {
  let round = 0;
  const result: number[] = [];
  for (const e of r.events) {
    if (e.t === 'round') round = e.n;
    if (predicate(e)) result.push(round);
  }
  return result;
}

afterEach(() => {
  // 断言失败时也还原正式英雄和技能表；临时载体不能污染后续测试。
  for (const [id, original] of originals) {
    if (original.hero) HERO_BY_ID[id] = original.hero;
    else delete HERO_BY_ID[id];
    if (original.kit) KITS[id] = original.kit;
    else delete KITS[id];
  }
  originals.clear();
});

describe('规则：六向克制环', () => {
  const directions: [FactionId, FactionId, FactionId, FactionId[]][] = [
    ['wei', 'qun', 'xian', ['shu', 'man', 'wu']],
    ['qun', 'shu', 'wei', ['man', 'wu', 'xian']],
    ['shu', 'man', 'qun', ['wei', 'wu', 'xian']],
    ['man', 'wu', 'shu', ['wei', 'qun', 'xian']],
    ['wu', 'xian', 'man', ['wei', 'qun', 'shu']],
    ['xian', 'wei', 'wu', ['qun', 'shu', 'man']],
  ];
  it.each(directions)('%s：顺向加成、逆向减成，同族及其余三族中立', (from, forward, reverse, neutrals) => {
    const a = probe(from, { basic: [damage({ atk: 3 })] });
    const strike = (to: FactionId) => {
      const b = probe(to);
      const r = duel(a, b);
      const hit = hits(r, a, b)[0];
      expect(hit.crit).toBe(false);
      expect(hit.absorbed).toBe(0);
      expect(hit.hp).toBe(unit(r, b).maxHp - hit.amount);
      return hit.amount;
    };
    const neutral = strike(from);
    expect(Math.abs(strike(forward) - neutral * (1 + COUNTER_BONUS))).toBeLessThanOrEqual(1);
    expect(Math.abs(strike(reverse) - neutral * (1 - COUNTER_BONUS))).toBeLessThanOrEqual(1);
    for (const faction of neutrals) expect(strike(faction)).toBe(neutral);
  });
});

describe('规则：护盾先于生命，按获得顺序吸收', () => {
  it('耗尽第一层后，只扣第二层的残量，并保留第二层时长', () => {
    const a = probe('wei', { basic: [damage({ atk: 1.5 })] });
    const b = probe('wei', { passive: opening([
      { t: 'shield', scale: { atk: 1 }, turns: 99 },
      { t: 'shield', scale: { atk: 2 }, turns: 3 },
    ]) });
    const r = duel(a, b);
    const shields = events(r, 'shield');
    const hit = hits(r, a, b)[0];
    expect(shields.map((e) => e.amount)).toEqual([130, 260]);
    expect(hit.amount).toBeGreaterThan(shields[0].amount);
    expect(hit.amount).toBeLessThan(shields[1].total);
    expect(hit.absorbed).toBe(hit.amount);
    expect(hit.hp).toBe(unit(r, b).maxHp);
    expect(unit(r, b).shield).toEqual([{ v: shields[1].total - hit.amount, turns: 2 }]);
  });

  it('伤害溢出多层护盾后，仅溢出部分扣生命', () => {
    const a = probe('wei', { basic: [damage({ atk: 4 })] });
    const b = probe('wei', { passive: opening([
      { t: 'shield', scale: { atk: 1 }, turns: 99 },
      { t: 'shield', scale: { atk: 1 }, turns: 99 },
    ]) });
    const r = duel(a, b);
    const hit = hits(r, a, b)[0];
    const total = events(r, 'shield').at(-1)!.total;
    expect(hit.amount).toBeGreaterThan(total);
    expect(hit.absorbed).toBe(total);
    expect(hit.shield).toBe(0);
    expect(hit.hp).toBe(unit(r, b).maxHp - (hit.amount - total));
    expect(unit(r, b).shield).toEqual([]);
  });

  it('恰好吸完护盾时生命不变，零值护盾被移除', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 })] });
    const b = probe();
    const plain = duel(a, b);
    const amount = hits(plain, a, b)[0].amount;
    KITS[b].passive.passive = opening([{ t: 'shield', scale: { atk: amount / unit(plain, b).atk }, turns: 99 }]);
    const r = duel(a, b);
    const hit = hits(r, a, b)[0];
    expect(hit.amount).toBe(amount);
    expect(hit.absorbed).toBe(amount);
    expect(hit.hp).toBe(unit(r, b).maxHp);
    expect(hit.shield).toBe(0);
    expect(unit(r, b).shield).toEqual([]);
  });

  it('普攻直击与随后灼烧共用剩余护盾，不能各取一份初始护盾', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 }), status('burn', 9, { snapAtk: 1 })] });
    const b = probe('wei', { passive: opening([{ t: 'shield', scale: { atk: 3 }, turns: 99 }]) });
    const r = duel(a, b);
    const hit = hits(r, a, b)[0];
    const dot = events(r, 'dot')[0];
    const total = events(r, 'shield')[0].total;
    expect(dot.amount).toBe(130);
    expect(hit.absorbed).toBe(hit.amount);
    expect(hit.hp).toBe(unit(r, b).maxHp);
    expect(dot.hp).toBe(unit(r, b).maxHp);
    expect(unit(r, b).shield[0].v).toBe(total - hit.amount - dot.amount);
  });
});

describe('规则：九命与致命伤害、净化', () => {
  it('同一多段攻击首次致命保留15%生命，第二次致命才睡着', () => {
    const a = probe('wei', { basic: [damage({ targetMaxHp: 2 }, { hits: 2 })] });
    const b = probe('wei', { passive: opening([status('nine', 99)]) });
    const r = duel(a, b);
    const strikes = hits(r, a, b);
    expect(strikes).toHaveLength(2);
    expect(strikes[0]).toMatchObject({ hp: Math.round(unit(r, b).maxHp * 0.15), killed: false, hit: 0, hits: 2 });
    expect(strikes[1]).toMatchObject({ hp: 0, killed: true, hit: 1, hits: 2 });
    expect(events(r, 'death').map((e) => e.uid)).toEqual([unit(r, b).uid]);
    expect(events(r, 'act').some((e) => e.uid === unit(r, b).uid)).toBe(false);
    expect(events(r, 'status').filter((e) => e.id === 'nine' && e.op === 'remove')).toHaveLength(1);
    expect(events(r, 'text').filter((e) => e.text === '九命！')).toHaveLength(1);
  });

  it('非致命伤害不消耗九命，后续致命伤害仍能保护', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 }), damage({ targetMaxHp: 2 })] });
    const b = probe('wei', { passive: opening([status('nine', 99)]) });
    const r = duel(a, b);
    const strikes = hits(r, a, b);
    expect(strikes[0].hp).toBe(unit(r, b).maxHp - strikes[0].amount);
    expect(strikes[1]).toMatchObject({ hp: Math.round(unit(r, b).maxHp * 0.15), killed: false });
    expect(events(r, 'death')).toEqual([]);
    expect(unit(r, b).alive).toBe(true);
    expect(events(r, 'text').filter((e) => e.text === '九命！')).toHaveLength(1);
  });

  it('首次致命 DOT 后仍能行动；持续状态未消失，第二跳才真正睡着', () => {
    const a = probe('wei', { passive: opening([
      { t: 'status', id: 'burn', turns: 99, snap: { targetMaxHp: 2 } },
    ], enemy('all')) });
    const b = probe('wei', { passive: opening([status('nine', 99)]) });
    const cfg = { A: [setup(a, { gear: { spd: 500 } })], B: [setup(b)] };
    const firstRound = run(cfg);
    expect(unit(firstRound, b)).toMatchObject({ hp: Math.round(unit(firstRound, b).maxHp * 0.15), alive: true });
    expect(events(firstRound, 'death')).toEqual([]);
    expect(unit(firstRound, b).statuses.some((s) => s.id === 'nine')).toBe(false);
    expect(unit(firstRound, b).statuses.some((s) => s.id === 'burn')).toBe(true);
    const r = run({ ...cfg, maxRounds: 2 });
    const uid = unit(r, b).uid;
    expect(roundsOf(r, (e) => e.t === 'dot' && e.dst === uid)).toEqual([1, 2]);
    expect(roundsOf(r, (e) => e.t === 'act' && e.uid === uid)).toEqual([1]);
    expect(roundsOf(r, (e) => e.t === 'death' && e.uid === uid)).toEqual([2]);
    expect(events(r, 'text').filter((e) => e.text === '九命！')).toHaveLength(1);
    expect(events(r, 'status').filter((e) => e.id === 'nine' && e.op === 'remove')).toHaveLength(1);
    expect(unit(r, b)).toMatchObject({ hp: 0, alive: false });
    // 首跳 dot 的 hp/killed 事件口径待 Claude 确认，不能把错误死亡标志锁成契约：
    // https://github.com/acaozixu123456/myRepository/issues/45#issuecomment-6106655429
  });

  it.each(['debuff', 'buff'] as const)('净化 %s 时，只有净化增益会在致命伤害前移除九命', (kind) => {
    const a = probe('wei', { basic: [
      status('fright', 9, { power: 0.2 }), { t: 'cleanse', kind }, damage({ targetMaxHp: 2 }),
    ] });
    const b = probe('wei', { passive: opening([status('nine', 99)]) });
    const r = duel(a, b);
    const hit = hits(r, a, b)[0];
    const protectedByNine = kind === 'debuff';
    expect(hit.killed).toBe(!protectedByNine);
    expect(hit.hp).toBe(protectedByNine ? Math.round(unit(r, b).maxHp * 0.15) : 0);
    expect(events(r, 'text').filter((e) => e.text === '九命！')).toHaveLength(protectedByNine ? 1 : 0);
    expect(events(r, 'death')).toHaveLength(protectedByNine ? 0 : 1);
    expect(events(r, 'status').some((e) => e.id === 'fright' && e.op === 'remove')).toBe(protectedByNine);
  });
});

describe('规则：控制免疫仅挡控制，不提供闪避', () => {
  it('眩晕结束后的下一整轮免控，窗口过后可再次眩晕', () => {
    const a = probe('wei', { basic: [damage({ atk: 0.1 }), status('dizzy', 1)] });
    const b = probe();
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b)], maxRounds: 4 });
    const uid = unit(r, b).uid;
    expect(roundsOf(r, (e) => e.t === 'status' && e.dst === uid && e.id === 'dizzy' && e.op === 'add')).toEqual([1, 3]);
    expect(roundsOf(r, (e) => e.t === 'skip' && e.uid === uid && e.reason === 'dizzy')).toEqual([1, 3]);
    expect(roundsOf(r, (e) => e.t === 'act' && e.uid === uid)).toEqual([2, 4]);
    expect(hits(r, a, b)).toHaveLength(4);
    expect(events(r, 'text').some((e) => e.text === '闪避')).toBe(false);
  });

  it('免控轮拒绝眩晕、毛线与薄荷醉，但接受受惊、淋湿、符咒和灼烧', () => {
    const a = probe('wei', { basic: [
      damage({ atk: 0.1 }), status('dizzy', 1), status('yarn', 1), status('nip', 1),
      status('fright', 1, { power: 0.2 }), status('wet', 1), status('charm', 1), status('burn', 1, { snapAtk: 0.1 }),
    ] });
    const b = probe();
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b)], maxRounds: 2 });
    const uid = unit(r, b).uid;
    for (const id of ['dizzy', 'yarn', 'nip']) {
      expect(roundsOf(r, (e) => e.t === 'status' && e.dst === uid && e.id === id && e.op === 'add')).toEqual([1]);
    }
    for (const id of ['fright', 'wet', 'charm', 'burn']) {
      expect(roundsOf(r, (e) => e.t === 'status' && e.dst === uid && e.id === id && e.op === 'add')).toEqual([1, 2]);
    }
    expect(roundsOf(r, (e) => e.t === 'act' && e.uid === uid)).toEqual([2]);
    expect(hits(r, a, b)).toHaveLength(2);
    const loss = hits(r, a, b).reduce((n, e) => n + e.amount, 0) + events(r, 'dot').reduce((n, e) => n + e.amount, 0);
    expect(unit(r, b).hp).toBe(unit(r, b).maxHp - loss);
    expect(events(r, 'text').some((e) => e.text === '闪避')).toBe(false);
  });

  it('毛线只封绝技：仍普攻且保留满元气，解除后的免控轮能放绝技', () => {
    const a = probe('wei', { basic: [status('yarn', 1)] });
    const b = probe();
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b, { energy: 100 })], maxRounds: 2 });
    const uid = unit(r, b).uid;
    expect(events(r, 'act').filter((e) => e.uid === uid).map((e) => e.kind)).toEqual(['basic', 'ultimate']);
    expect(events(r, 'skip').filter((e) => e.uid === uid)).toEqual([]);
    expect(events(r, 'energy').filter((e) => e.uid === uid).map((e) => e.energy)).toEqual([120, 0]);
    expect(roundsOf(r, (e) => e.t === 'status' && e.id === 'yarn' && e.op === 'add')).toEqual([1]);
  });
});

describe('规则：灼烧层数、淋湿倍率与移除', () => {
  it('刷新灼烧叠到五层，较低快照不会覆盖较高快照，实际 DOT 按五层结算', () => {
    const a = probe('wei', { basic: [
      status('burn', 9, { stacks: 2, snapAtk: 0.1 }),
      status('burn', 9, { stacks: 2, snapAtk: 0.2 }),
      status('burn', 9, { stacks: 4, snapAtk: 0.15 }),
    ] });
    const b = probe();
    const r = duel(a, b);
    expect(events(r, 'status').filter((e) => e.id === 'burn' && e.op === 'add').map((e) => e.stacks)).toEqual([2, 4, 5]);
    expect(events(r, 'dot')).toEqual([{ t: 'dot', dst: unit(r, b).uid, id: 'burn', amount: 130, hp: 770, killed: false }]);
    expect(unit(r, b).statuses.find((s) => s.id === 'burn')).toMatchObject({ stacks: 5, snap: 26, turns: 8 });
  });

  it('行动中净化整个灼烧状态，后续行动不再结算遗留层数', () => {
    const a = probe('wei', { passive: opening([status('burn', 9, { stacks: 3, snapAtk: 0.1 })], enemy('all')) });
    const b = probe('wei', { basic: [{ t: 'cleanse', to: self }] });
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b)], maxRounds: 3 });
    expect(roundsOf(r, (e) => e.t === 'dot' && e.id === 'burn')).toEqual([1]);
    expect(events(r, 'dot')[0].amount).toBe(39);
    expect(events(r, 'status').filter((e) => e.id === 'burn' && e.op === 'remove')).toHaveLength(1);
    expect(unit(r, b).statuses.some((s) => s.id === 'burn')).toBe(false);
    expect(unit(r, b).hp).toBe(unit(r, b).maxHp - 39);
  });

  it('群体引爆按各目标自己的层数造成伤害，消耗后不再产生 DOT', () => {
    const a = probe('wei', { basic: [
      status('burn', 9, { stacks: 3, snapAtk: 0.1, to: enemy('front', 1) }),
      status('burn', 9, { stacks: 2, snapAtk: 0.1, to: enemy('back', 1) }),
      { t: 'detonate', id: 'burn', per: 0.5, elem: 'true', to: enemy('all') },
    ] });
    const front = probe('qun');
    const back = probe('qun');
    const cfg = { A: [setup(a, { gear: { spd: 500 } })], B: [setup(front), setup(back, { pos: 3 })] };
    const r = run(cfg);
    KITS[a].basic.effects = [damage({ atk: 1.5 }, { to: enemy('front', 1) }), damage({ atk: 1 }, { to: enemy('back', 1) })];
    const reference = run(cfg);
    expect(hits(r, a, front)[0].amount).toBe(hits(reference, a, front)[0].amount);
    expect(hits(r, a, back)[0].amount).toBe(hits(reference, a, back)[0].amount);
    expect(events(r, 'dot')).toEqual([]);
    for (const id of [front, back]) {
      const uid = unit(r, id).uid;
      const removal = r.events.findIndex((e) => e.t === 'status' && e.dst === uid && e.id === 'burn' && e.op === 'remove');
      const strike = r.events.findIndex((e) => e.t === 'damage' && e.dst === uid);
      expect(removal).toBeGreaterThanOrEqual(0);
      expect(removal).toBeLessThan(strike);
      expect(unit(r, id).statuses.some((s) => s.id === 'burn')).toBe(false);
    }
  });

  it('引爆 keep:1 只消耗两层，保留的一层仍按原快照结算', () => {
    const a = probe('wei', { basic: [
      status('burn', 9, { stacks: 3, snapAtk: 0.1 }), { t: 'detonate', id: 'burn', per: 0.5, elem: 'true', keep: 1 },
    ] });
    const b = probe();
    const r = duel(a, b);
    KITS[a].basic.effects = [damage({ atk: 1 })];
    const reference = duel(a, b);
    expect(hits(r, a, b)[0].amount).toBe(hits(reference, a, b)[0].amount);
    expect(events(r, 'dot')[0].amount).toBe(13);
    expect(unit(r, b).statuses.find((s) => s.id === 'burn')).toMatchObject({ stacks: 1, snap: 13 });
    expect(events(r, 'status').some((e) => e.id === 'burn' && e.op === 'remove')).toBe(false);
  });

  it.each(['fire', 'thunder', 'phys', 'magic', 'water', 'true'] as const)('淋湿对 %s 直击的元素倍率准确，不借防御变化冒充加成', (elem) => {
    // 完全忽略防御以隔离淋湿元素倍率；魏载体排除吴的额外阵营火焰倍率。
    const a = probe('wei', { basic: [damage({ atk: 3 }, { elem, ignoreDef: 1 })] });
    const b = probe();
    const dry = duel(a, b);
    KITS[b].passive.passive = opening([status('wet', 99)]);
    const wet = duel(a, b);
    const factor = elem === 'fire' || elem === 'thunder' ? 1.25 : 1;
    expect(Math.abs(hits(wet, a, b)[0].amount - hits(dry, a, b)[0].amount * factor)).toBeLessThanOrEqual(factor === 1 ? 0 : 1);
  });
});

describe('规则：蜀的桃园同心阵营机制', () => {
  it('至少两只蜀：蜀猫睡着后，仅醒着的蜀同伴获得炸毛与实际治疗', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 })], target: enemy('front', 1) });
    const fallen = probe('shu');
    const mate = probe('shu');
    const other = probe('wu');
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [
      setup(fallen, { hpPct: 0.05 }), setup(mate, { pos: 3, hpPct: 0.4 }), setup(other, { pos: 4, hpPct: 0.4 }),
    ] });
    expect(events(r, 'death').map((e) => e.uid)).toEqual([unit(r, fallen).uid]);
    expect(events(r, 'heal')).toEqual([{ t: 'heal', src: unit(r, fallen).uid, dst: unit(r, mate).uid, amount: 158, hp: 518 }]);
    expect(unit(r, mate).statuses.find((s) => s.id === 'fluff')).toMatchObject({ stacks: 1, power: 0.15, turns: 1 });
    expect(unit(r, mate).crit).toBeCloseTo(0.09);
    expect(unit(r, other).hp).toBe(360);
    expect(unit(r, other).statuses).toEqual([]);
    expect(events(r, 'text').filter((e) => e.text === '桃园·同心')).toHaveLength(1);
    expect(events(r, 'text').some((e) => e.text === '桃园·结义')).toBe(false);
  });

  it('队内已有两只蜀时，非蜀猫睡着仍不会触发桃园同心', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 })], target: enemy('front', 1) });
    const fallen = probe('wu');
    const left = probe('shu');
    const right = probe('shu');
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [
      setup(fallen, { hpPct: 0.05 }), setup(left, { pos: 3, hpPct: 0.4 }), setup(right, { pos: 4, hpPct: 0.4 }),
    ] });
    expect(events(r, 'death')).toHaveLength(1);
    expect(events(r, 'heal')).toEqual([]);
    expect(events(r, 'status').filter((e) => e.id === 'fluff')).toEqual([]);
    expect(events(r, 'text').some((e) => e.text === '桃园·同心')).toBe(false);
    expect(unit(r, left).hp).toBe(360);
    expect(unit(r, right).hp).toBe(360);
  });

  it('只有一只蜀时，即使蜀猫睡着也不触发阵营死亡奖励', () => {
    const a = probe('wei', { basic: [damage({ atk: 1 })], target: enemy('front', 1) });
    const fallen = probe('shu');
    const other = probe('wu');
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(fallen, { hpPct: 0.05 }), setup(other, { pos: 3, hpPct: 0.4 })] });
    expect(events(r, 'death')).toHaveLength(1);
    expect(events(r, 'heal')).toEqual([]);
    expect(events(r, 'status').filter((e) => e.id === 'fluff')).toEqual([]);
    expect(unit(r, other).hp).toBe(360);
  });
});

describe('规则：命名羁绊与 noBonds 的范围', () => {
  const peach = ['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei'];
  it('桃园20%加成仅给三成员，关闭命名羁绊仍保留四蜀同族属性及残血比例', () => {
    const ids = [...peach, 'shu_zhugemiaoliang', 'wu_huanggai'];
    ids.forEach((id) => install(id, HERO_BY_ID[id].faction));
    const foe = probe('qun');
    const cfg = { A: lineup(ids).map((s) => ({ ...s, hpPct: 0.4 })), B: [setup(foe)], maxRounds: 0 };
    const on = run({ ...cfg, noBonds: false });
    const off = run({ ...cfg, noBonds: true });
    for (const id of peach) {
      const yes = unit(on, id);
      const no = unit(off, id);
      expect(Math.abs(yes.maxHp - no.maxHp * 1.2)).toBeLessThanOrEqual(1);
      expect(Math.abs(yes.atk - no.atk * 1.2)).toBeLessThanOrEqual(1);
      expect(yes.def).toBe(Math.round(no.def * 1.2));
      expect(Math.abs(yes.hp - yes.maxHp * 0.4)).toBeLessThanOrEqual(1);
      expect(Math.abs(no.hp - no.maxHp * 0.4)).toBeLessThanOrEqual(1);
      expect(yes.crit).toBe(no.crit);
    }
    for (const id of ids.slice(3)) {
      expect(unit(on, id).maxHp).toBe(unit(off, id).maxHp);
      expect(unit(on, id).atk).toBe(unit(off, id).atk);
      expect(unit(on, id).def).toBe(unit(off, id).def);
    }
    const solo = run({ A: [setup('shu_guanyunmiao')], B: [setup(foe)], maxRounds: 0 });
    expect(unit(off, 'shu_guanyunmiao').atk).toBe(Math.round(unit(solo, 'shu_guanyunmiao').atk * 1.05));
    expect(unit(off, 'shu_guanyunmiao').maxHp).toBe(Math.round(unit(solo, 'shu_guanyunmiao').maxHp * 1.05));
    expect(unit(off, 'shu_guanyunmiao').crit - unit(solo, 'shu_guanyunmiao').crit).toBeCloseTo(0.08);
  });

  it('命名魏武加成关闭后，魏的每轮铁壁护盾与三魏同族属性仍生效', () => {
    const ids = ['wei_caomiaode', 'wei_xiahoudun', 'wei_xuhuchi'];
    ids.forEach((id) => install(id, 'wei'));
    const foe = probe('qun');
    const cfg = { A: lineup(ids).map((s, i) => i === 0 ? { ...s, hpPct: 0.4 } : s), B: [setup(foe)] };
    const on = run({ ...cfg, noBonds: false });
    const off = run(cfg);
    expect(unit(on, ids[0]).dmgMul).toBeCloseTo(1.05);
    expect(unit(off, ids[0]).dmgMul).toBe(1);
    expect(events(off, 'shield')).toHaveLength(1);
    expect(events(off, 'shield')[0]).toMatchObject({ dst: unit(off, ids[0]).uid, amount: Math.round(unit(off, ids[0]).maxHp * 0.15) });
    expect(events(off, 'shield')).toEqual(events(on, 'shield'));
    const solo = run({ A: [setup(ids[0])], B: [setup(foe)], maxRounds: 0 });
    expect(unit(off, ids[0]).atk).toBe(Math.round(unit(solo, ids[0]).atk * 1.05));
    expect(unit(off, ids[0]).maxHp).toBe(Math.round(unit(solo, ids[0]).maxHp * 1.05));
  });

  it('缺少指定成员不会用同阵营替补激活桃园，开关对该阵容完全无影响', () => {
    const ids = ['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhugemiaoliang', 'wu_huanggai'];
    ids.forEach((id) => install(id, HERO_BY_ID[id].faction));
    const foe = probe('qun');
    const cfg = { A: lineup(ids), B: [setup(foe)] };
    expect(run({ ...cfg, noBonds: false }).events).toEqual(run({ ...cfg, noBonds: true }).events);
  });
});

describe('规则：extraTurn 限次、触发链与睡着边界', () => {
  it('多段 onHit、重复效果和 afterAct 反复申请再动，每轮仍只有一次额外行动', () => {
    const a = probe('wei', {
      basic: [damage({ atk: 0.1 }, { hits: 4 }), { t: 'repeat', n: 3, effects: [{ t: 'extraTurn' }] }],
      passive: [
        { on: 'onHit', effects: [{ t: 'extraTurn' }, { t: 'counter', key: 'hits', add: 1, to: self }] },
        { on: 'afterAct', effects: [{ t: 'extraTurn' }] },
      ],
    });
    const b = probe('qun');
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [setup(b, { gear: { hp: 10000 } })], maxRounds: 2 });
    const uid = unit(r, a).uid;
    expect(roundsOf(r, (e) => e.t === 'act' && e.uid === uid)).toEqual([1, 1, 2, 2]);
    expect(roundsOf(r, (e) => e.t === 'text' && e.uid === uid && e.text === '再动！')).toEqual([1, 2]);
    expect(hits(r, a, b)).toHaveLength(16);
    expect(unit(r, a).counters.hits).toBe(16);
    expect(unit(r, a).extraTurn).toBe(false);
  });

  it('群体多段连续让两只猫睡着，只触发一次每轮 onKill 再动；睡着目标不再吃后续段', () => {
    const a = probe('wei', {
      basic: [damage({ atk: 1 }, { hits: 3 })], target: enemy('frontRow'),
      passive: [{ on: 'onKill', limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] }],
    });
    const left = probe('qun');
    const right = probe('qun');
    const spare = probe('qun');
    const r = run({ A: [setup(a, { gear: { spd: 500 } })], B: [
      setup(left, { hpPct: 0.01 }), setup(right, { pos: 1, hpPct: 0.01 }), setup(spare, { pos: 3, gear: { hp: 10000 } }),
    ] });
    const uid = unit(r, a).uid;
    expect(events(r, 'death').map((e) => e.uid).sort()).toEqual([unit(r, left).uid, unit(r, right).uid].sort());
    expect(hits(r, a, left)).toHaveLength(1);
    expect(hits(r, a, right)).toHaveLength(1);
    expect(hits(r, a, spare)).toHaveLength(3);
    expect(events(r, 'act').filter((e) => e.uid === uid)).toHaveLength(2);
    expect(events(r, 'passive').filter((e) => e.uid === uid)).toHaveLength(1);
    expect(events(r, 'text').filter((e) => e.text === '再动！')).toHaveLength(1);
  });

  it('已申请再动的猫在反弹触发链中睡着，不能再行动', () => {
    const a = probe('wei', { basic: [{ t: 'extraTurn' }, damage({ atk: 1 })] });
    const b = probe('qun', { passive: [{ on: 'onHurt', target: enemy('attacker'), effects: [damage({ targetMaxHp: 2 })] }] });
    const r = duel(a, b);
    expect(events(r, 'death').map((e) => e.uid)).toEqual([unit(r, a).uid]);
    expect(events(r, 'act').filter((e) => e.uid === unit(r, a).uid)).toHaveLength(1);
    expect(events(r, 'text').some((e) => e.text === '再动！')).toBe(false);
    expect(unit(r, a)).toMatchObject({ alive: false, hp: 0, extraTurn: false });
    expect(r.winner).toBe('B');
  });

  it('最后一名对手睡着后立即结束，不执行已申请的额外行动', () => {
    const a = probe('wei', { basic: [{ t: 'extraTurn' }, damage({ targetMaxHp: 2 })] });
    const b = probe();
    const r = duel(a, b);
    expect(events(r, 'act')).toHaveLength(1);
    expect(events(r, 'death').map((e) => e.uid)).toEqual([unit(r, b).uid]);
    expect(events(r, 'text').some((e) => e.text === '再动！')).toBe(false);
    expect(unit(r, a).extraTurn).toBe(false);
    expect(r.winner).toBe('A');
  });

  it('行动开始时被 DOT 哄睡，即使开场已申请再动也不执行普通或额外行动', () => {
    const a = probe('wei', { passive: opening([{ t: 'extraTurn' }]) });
    const b = probe('qun', { passive: opening([
      { t: 'status', id: 'burn', turns: 99, snap: { targetMaxHp: 2 } },
    ], enemy('all')) });
    const r = duel(a, b);
    expect(events(r, 'act')).toEqual([]);
    expect(events(r, 'death').map((e) => e.uid)).toEqual([unit(r, a).uid]);
    expect(events(r, 'text').some((e) => e.text === '再动！')).toBe(false);
    expect(unit(r, a).extraTurn).toBe(false);
    expect(r.winner).toBe('B');
  });
});
