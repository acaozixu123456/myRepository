import { describe, expect, it } from 'vitest';
import { bossRuleFx, CHAPTERS } from '../src/content/campaign';
import { HERO_BY_ID } from '../src/data/heroes';
import { baseStats } from '../src/data/systems';
import { simulate } from '../src/engine/battle';
import type { BattleResult } from '../src/engine/battle';
import type { BEvent, RuleFx, UnitSetup } from '../src/engine/types';
import { waveSetups } from '../src/game/stage';
import { towerFloor, TOWER_FLOORS } from '../src/game/tower';

const BOSSES = [
  'qun_dongzhuo', 'wei_caomiaode', 'wu_zhoumiaoyu',
  'man_mengmiaohuo', 'xian_zuoci', 'qun_lvbuding',
] as const;
const SEED = 42;
const BOSS_HP = 100_000;

// 真实技能保持原样。厚血、厚防与无觉醒隔离阶段；快速杂兵每轮先打一次，
// hpPct 让首次符合血线的直接伤害可重复出现，不把猫猫打睡着当成触发成功。
const attacker = (overrides: Partial<UnitSetup> = {}): UnitSetup => ({
  heroId: 'mob_shu_archer', level: 1, star: 1, skillLv: 1, pos: 3,
  gear: { hp: 100_000, def: 100_000, hit: 1, spd: 1_000 },
  ...overrides,
});
function bossSetup(heroId: string, hpPct = 1, energy = 0): UnitSetup {
  const hero = HERO_BY_ID[heroId];
  return {
    heroId, level: 1, star: 1, skillLv: 1,
    pos: ['守护', '先锋'].includes(hero.role) ? 1 : 3,
    hpPct, energy,
    // 让 70% / 35% 等等于阈值的 fixture 不受整数生命四舍五入影响。
    gear: { hp: BOSS_HP - baseStats(hero.role, hero.rarity).hp, def: 100_000, hit: 1 },
  };
}
function runBoss(heroId: string, options: {
  hpPct?: number;
  energy?: number;
  rounds?: number;
  rules?: RuleFx[];
  A?: UnitSetup[];
} = {}): BattleResult {
  return simulate({
    seed: SEED, noBonds: true,
    A: options.A ?? [attacker()],
    B: [bossSetup(heroId, options.hpPct, options.energy)],
    rules: options.rules ?? bossRuleFx(heroId), maxRounds: options.rounds ?? 3,
  });
}
function getBoss(result: BattleResult, heroId: string) {
  const unit = result.units.find((cat) => cat.side === 'B' && cat.heroId === heroId);
  expect(unit, heroId).toBeDefined();
  return unit!;
}
function phaseRule(heroId: string, hpBelow: number): RuleFx {
  const rule = bossRuleFx(heroId).find((effect) => effect.t === 'on' && effect.hpBelow === hpBelow);
  expect(rule, `${heroId}: ${hpBelow}`).toBeDefined();
  return rule!;
}
function damageTo(result: BattleResult, uid: number) {
  return result.events.filter((event): event is Extract<BEvent, { t: 'damage' }> => event.t === 'damage' && event.dst === uid);
}
function nineAdds(result: BattleResult, uid: number) {
  return result.events.filter((event): event is Extract<BEvent, { t: 'status' }> =>
    event.t === 'status' && event.dst === uid && event.id === 'nine' && event.op === 'add');
}

function isUltimateCost(events: BEvent[], index: number, uid: number): boolean {
  const event = events[index];
  const action = events[index + 1];
  return event.t === 'energy' && event.uid === uid && event.energy === 0
    && action?.t === 'act' && action.uid === uid && action.kind === 'ultimate';
}

// 只观察一次直接受击到下一次 act / damage 之前的回复。
// 普攻完成的元气、下次绝技清零和其他猫的回复不能冒充血线 +30。
function hitEnergyWindows(result: BattleResult, uid: number) {
  return result.events.flatMap((event, index) => {
    if (event.t !== 'damage' || event.dst !== uid) return [];
    const energy: number[] = [];
    for (let cursor = index + 1; cursor < result.events.length; cursor++) {
      const next = result.events[cursor];
      if (next.t === 'act' || next.t === 'damage' || isUltimateCost(result.events, cursor, uid)) break;
      if (next.t === 'energy' && next.uid === uid) energy.push(next.energy);
    }
    return [{ damage: event, energy }];
  });
}

describe('Boss 阶段的真实战斗效果', () => {
  it.each([[0.7, 0.69], [0.35, 0.34]])('董桌低于 %s 的盾只触发一次且额度准确', (threshold, hpPct) => {
    const rules = [phaseRule('qun_dongzhuo', threshold)];
    const result = runBoss('qun_dongzhuo', { hpPct, rules });
    const boss = getBoss(result, 'qun_dongzhuo');
    const amount = Math.round(boss.maxHp * 0.25);
    const shields = result.events.filter((event) => event.t === 'shield' && event.src === boss.uid && event.dst === boss.uid && event.amount === amount);
    expect(shields).toHaveLength(1);
    expect(damageTo(result, boss.uid)).toHaveLength(3);
    expect(damageTo(result, boss.uid).every((event) => !event.killed)).toBe(true);
    expect(boss.alive).toBe(true);
    // 25% 阶段盾在第三次自身行动结束到期，仅原拍桌的 5% 小盾可能留着。
    expect(boss.shield.every((shield) => shield.v <= Math.round(boss.maxHp * 0.05))).toBe(true);
    const baseline = runBoss('qun_dongzhuo', { hpPct, rules: [] });
    expect(baseline.events.some((event) => event.t === 'shield' && event.amount === amount)).toBe(false);
  });

  it.each([0.7, 0.35])('董桌生命恰好 %s 且伤害被盾吸收时不跨线', (threshold) => {
    const result = runBoss('qun_dongzhuo', {
      hpPct: threshold,
      rules: [
        { t: 'startShield', side: 'B', to: 'all', pct: 1, turns: 10 },
        phaseRule('qun_dongzhuo', threshold),
      ],
    });
    const boss = getBoss(result, 'qun_dongzhuo');
    expect(boss.hp / boss.maxHp).toBe(threshold);
    expect(damageTo(result, boss.uid)).toHaveLength(3);
    expect(damageTo(result, boss.uid).every((event) => event.absorbed > 0)).toBe(true);
    expect(result.events.some((event) => event.t === 'shield' && event.amount === Math.round(boss.maxHp * 0.25))).toBe(false);
  });

  it('董桌同次受击跨过两道血线，各生成独立 25% 盾且不再次生成', () => {
    const result = runBoss('qun_dongzhuo', { hpPct: 0.34 });
    const boss = getBoss(result, 'qun_dongzhuo');
    const amounts = result.events.filter((event): event is Extract<BEvent, { t: 'shield' }> =>
      event.t === 'shield' && event.dst === boss.uid && event.amount === Math.round(boss.maxHp * 0.25));
    expect(amounts).toHaveLength(2);
    expect(amounts.map((event) => event.total)).toEqual([25_000, 50_000]);
    expect(damageTo(result, boss.uid)).toHaveLength(3);
  });

  it('原董桌破盾规则对 A 方只扣一次 10 元气，后续破盾不再扣', () => {
    const rule = bossRuleFx('qun_dongzhuo').find((effect) => effect.t === 'on' && effect.ev === 'shieldBreak');
    expect(rule).toBeDefined();
    const result = runBoss('qun_dongzhuo', {
      A: [attacker({ energy: 50, gear: { hp: 100_000, def: 100_000, hit: 1, spd: 1_000, atk: 1_000_000 } })],
      rules: [{ t: 'startShield', side: 'B', to: 'all', pct: 0.0001, turns: 10 }, rule!],
    });
    const boss = getBoss(result, 'qun_dongzhuo');
    const source = result.units.find((unit) => unit.side === 'A')!;
    expect(damageTo(result, boss.uid).filter((event) => event.absorbed > 0 && event.shield === 0).length).toBeGreaterThanOrEqual(2);
    let previous = 50;
    const losses: number[] = [];
    for (const [index, event] of result.events.entries()) if (event.t === 'energy' && event.uid === source.uid) {
      if (event.energy < previous && !isUltimateCost(result.events, index, source.uid)) losses.push(event.energy - previous);
      previous = event.energy;
    }
    expect(losses).toEqual([-10]);
  });

  it('曹喵德首次低于 60% 的受击额外 +30，重复受击不再回', () => {
    const result = runBoss('wei_caomiaode', { hpPct: 0.59 });
    const boss = getBoss(result, 'wei_caomiaode');
    const windows = hitEnergyWindows(result, boss.uid);
    expect(windows).toHaveLength(3);
    expect(windows[0].damage.killed).toBe(false);
    expect(windows[0].energy).toEqual([10, 40]);
    expect(windows.slice(1).every((window) => window.energy.length <= 1)).toBe(true);
    const baseline = runBoss('wei_caomiaode', { hpPct: 0.59, rules: bossRuleFx('wei_caomiaode').filter((effect) => effect.t === 'telegraph') });
    expect(hitEnergyWindows(baseline, getBoss(baseline, 'wei_caomiaode').uid)[0].energy).toEqual([10]);
  });

  it('曹喵德 +30 遵守引擎 150 上限，截断后仍只使用一次血线触发', () => {
    const result = runBoss('wei_caomiaode', { hpPct: 0.59, energy: 130 });
    const boss = getBoss(result, 'wei_caomiaode');
    const windows = hitEnergyWindows(result, boss.uid);
    expect(windows).toHaveLength(3);
    expect(windows[0].energy).toEqual([140, 150]);
    expect(windows[2].energy).toEqual([10]); // 第二轮绝技清零，第三轮不重新领 +30。
    expect(result.events.filter((event) => event.t === 'energy' && event.uid === boss.uid)
      .every((event) => event.t === 'energy' && event.energy <= 150)).toBe(true);
  });

  it.each([[0.6, 0.59], [0.3, 0.29]])('孟喵获低于 %s 的九命只申请一次，期限按两次自身行动结束', (threshold, hpPct) => {
    const rules = [phaseRule('man_mengmiaohuo', threshold)];
    const first = runBoss('man_mengmiaohuo', { hpPct, rules, rounds: 1 });
    const boss = getBoss(first, 'man_mengmiaohuo');
    expect(nineAdds(first, boss.uid)).toHaveLength(1);
    expect(boss.statuses.find((status) => status.id === 'nine')).toMatchObject({ stacks: 1, turns: 1 });
    const repeated = runBoss('man_mengmiaohuo', { hpPct, rules });
    const repeatedBoss = getBoss(repeated, 'man_mengmiaohuo');
    expect(damageTo(repeated, repeatedBoss.uid)).toHaveLength(3);
    expect(nineAdds(repeated, repeatedBoss.uid)).toHaveLength(1);
    expect(repeatedBoss.statuses.some((status) => status.id === 'nine')).toBe(false);
  });

  it('孟喵获同时跨两道血线的九命不叠免死次数', () => {
    const result = runBoss('man_mengmiaohuo', {
      hpPct: 0.29, rounds: 2,
      A: [
        attacker(),
        attacker({ heroId: 'mob_shu_vanguard', pos: 0, gear: { hp: 100_000, def: 100_000, hit: 1, spd: 500, atk: 100_000_000 } }),
      ],
    });
    const boss = getBoss(result, 'man_mengmiaohuo');
    expect(nineAdds(result, boss.uid)).toHaveLength(2);
    expect(nineAdds(result, boss.uid).every((event) => event.stacks === 1)).toBe(true);
    expect(result.events.filter((event) => event.t === 'text' && event.uid === boss.uid && event.text === '九命！')).toHaveLength(1);
    expect(damageTo(result, boss.uid).some((event) => event.hp === Math.round(boss.maxHp * 0.15) && !event.killed)).toBe(true);
    expect(result.events.filter((event) => event.t === 'death' && event.uid === boss.uid)).toHaveLength(1);
    expect(boss.alive).toBe(false);
  });

  it('孟喵获阶段申请两次期限不缩短原本三次期限的九命', () => {
    const preexisting: RuleFx = { t: 'startStatus', side: 'B', to: 'all', id: 'nine', turns: 3 };
    const result = runBoss('man_mengmiaohuo', { hpPct: 0.29, rounds: 1, rules: [preexisting, ...bossRuleFx('man_mengmiaohuo')] });
    const boss = getBoss(result, 'man_mengmiaohuo');
    expect(nineAdds(result, boss.uid)).toHaveLength(3); // 开场一份 + 两道血线，仍只有一层。
    expect(boss.statuses.filter((status) => status.id === 'nine')).toHaveLength(1);
    expect(boss.statuses.find((status) => status.id === 'nine')).toMatchObject({ stacks: 1, turns: 2 });
  });

  it('孟喵获第 7 / 14 次受击 +30，第 21 次及以后不再给', () => {
    const result = runBoss('man_mengmiaohuo', { rounds: 30 });
    const boss = getBoss(result, 'man_mengmiaohuo');
    const windows = hitEnergyWindows(result, boss.uid);
    expect(windows.length).toBeGreaterThanOrEqual(21);
    expect(windows.every((window) => !window.damage.killed)).toBe(true);
    const extra = windows.flatMap((window, index) => window.energy.length > 1 ? [{ hit: index + 1, delta: window.energy[1] - window.energy[0] }] : []);
    expect(extra).toEqual([{ hit: 7, delta: 30 }, { hit: 14, delta: 30 }]);
    expect(boss.hp / boss.maxHp).toBeGreaterThan(0.6); // 不是血线阶段或觉醒在代替此条规则。
  });

  it.each(['wei_caomiaode', 'wu_zhoumiaoyu', 'xian_zuoci', 'qun_lvbuding'])('%s 预告先普攻、随后真实施放绝技，首 / 每次语义正确', (heroId) => {
    const result = runBoss(heroId, { energy: 100, rounds: 18 });
    const boss = getBoss(result, heroId);
    const sequence = result.events.flatMap((event) => {
      if (event.t === 'text' && event.uid === boss.uid && event.text === '预告：绝技！') return ['warn'];
      if (event.t === 'act' && event.uid === boss.uid) return [event.kind];
      return [];
    });
    const warnings = sequence.flatMap((value, index) => value === 'warn' ? [index] : []);
    const ultimates = sequence.flatMap((value, index) => value === 'ultimate' ? [index] : []);
    expect(ultimates.length).toBeGreaterThanOrEqual(2);
    expect(warnings.length).toBeGreaterThan(0);
    for (const index of warnings) expect(sequence.slice(index, index + 3)).toEqual(['warn', 'basic', 'ultimate']);
    if (heroId === 'wei_caomiaode') {
      expect(warnings).toHaveLength(1);
      expect(ultimates[1]).toBeGreaterThan(warnings[0] + 2);
    } else {
      expect(warnings).toHaveLength(ultimates.length);
      for (const index of ultimates) expect(sequence.slice(index - 2, index + 1)).toEqual(['warn', 'basic', 'ultimate']);
    }
  });

  it('阶段限定敌方该英雄，玩家同英雄和其他敌猫不会借用董桌血线盾', () => {
    const result = simulate({
      seed: SEED, noBonds: true,
      A: [bossSetup('qun_dongzhuo', 0.34)], B: [attacker({ pos: 0 })],
      rules: bossRuleFx('qun_dongzhuo'), maxRounds: 3,
    });
    expect(result.events.some((event) => event.t === 'damage' && event.amount > 0)).toBe(true);
    expect(result.events.some((event) => event.t === 'shield' && event.amount === BOSS_HP * 0.25)).toBe(false);
  });
});

describe('Boss 数据复用边界', () => {
  it.each(BOSSES)('%s 每次返回独立规则和 act，调用者修改不会污染内容', (heroId) => {
    const first = bossRuleFx(heroId);
    const second = bossRuleFx(heroId);
    const snapshot = JSON.parse(JSON.stringify(second));
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
    first.forEach((effect, index) => {
      const other = second[index];
      expect(effect).not.toBe(other);
      if (effect.t === 'on' && other.t === 'on') {
        expect(effect.act).not.toBe(other.act);
        effect.act = { k: 'energy', amount: 999, who: 'actor' };
      }
      effect.side = 'A';
    });
    expect(second).toEqual(snapshot);
    expect(bossRuleFx(heroId)).toEqual(snapshot);
  });

  it('未知英雄或未设计该阶段的英雄返回空数组', () => {
    expect(bossRuleFx('missing_cat')).toEqual([]);
    expect(bossRuleFx('shu_guanyunmiao')).toEqual([]);
  });

  it('六章第 24 关仅合并一份共用 Boss 规则，其他 23 关不添加 Boss 阶段', () => {
    CHAPTERS.forEach((chapter, index) => {
      const heroId = BOSSES[index];
      const bossStage = chapter.stages[23];
      const specific = (bossStage.ruleFx ?? []).filter((effect) => 'hero' in effect && effect.hero === heroId);
      expect(specific).toEqual(bossRuleFx(heroId));
      expect(new Set(specific.map((effect) => JSON.stringify(effect))).size).toBe(specific.length);
      expect(specific.filter((effect) => effect.t === 'telegraph').length).toBeLessThanOrEqual(1);
      for (const stage of chapter.stages.slice(0, 23)) {
        expect((stage.ruleFx ?? []).some((effect) => 'hero' in effect && BOSSES.some((id) => id === effect.hero)), stage.id).toBe(false);
      }
    });
  });

  it('塔仅给匹配首领合并同一接口，保留普通 / 精英层与现有轮换', () => {
    const matched: number[] = [];
    for (let floor = 1; floor <= TOWER_FLOORS; floor++) {
      const stage = towerFloor(floor);
      const hero = stage.waves[0].enemies.find((enemy) => HERO_BY_ID[enemy.unit]);
      const expected = stage.kind === 'boss' && hero ? bossRuleFx(hero.unit) : [];
      expect(stage.ruleFx ?? [], `第 ${floor} 层`).toEqual(expected);
      if (expected.length) matched.push(floor);
      if (stage.kind !== 'boss') expect(stage.ruleFx).toBeUndefined();
    }
    expect(matched).toEqual([30, 60, 90]);
  });

  it.each([30, 60, 90])('第 %s 层真实守塔左慈先预告并施放绝技', (floor) => {
    const stage = towerFloor(floor);
    const result = simulate({
      seed: SEED, noBonds: true, A: [attacker()], B: waveSetups(stage, 0),
      rules: stage.ruleFx, maxRounds: 18,
    });
    const boss = getBoss(result, 'xian_zuoci');
    const warning = result.events.findIndex((event) => event.t === 'text' && event.uid === boss.uid && event.text === '预告：绝技！');
    const ultimate = result.events.findIndex((event) => event.t === 'act' && event.uid === boss.uid && event.kind === 'ultimate');
    expect(warning).toBeGreaterThan(0);
    expect(ultimate).toBeGreaterThan(warning);
    const between = result.events.slice(warning + 1, ultimate).filter((event) => event.t === 'act' && event.uid === boss.uid);
    expect(between).toHaveLength(1);
    expect(between[0]).toMatchObject({ kind: 'basic' });
  });
});
