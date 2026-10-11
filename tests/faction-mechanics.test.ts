import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';

const team = (ids: string[], extra: Partial<UnitSetup> = {}): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: 40, pos: i, star: 3, skillLv: 3, ...extra }));
const FOE = ['wei_xuhuchi', 'wei_xiahoudun', 'wei_guojia', 'wu_huanggai', 'xian_guanlu'];
const dealt = (r: ReturnType<typeof simulate>, side: 'A' | 'B') => r.events.reduce((a, e) => a + (e.t === 'damage' && r.units.find((u) => u.uid === e.src)?.side === side ? e.amount : 0), 0);

describe('阵营机制（文案对应的实现）', () => {
  it('蛮·野性：生命越低攻击越高（≥2 只蛮）', () => {
    const man = ['man_mengmiaohuo', 'man_zhurong', 'man_mulu', 'man_wutugu', 'man_mengmiaohuo'];
    const hurt = simulate({ seed: 1, A: team(man.slice(0, 4), { hpPct: 0.3 }), B: team(FOE), maxRounds: 1 });
    const full = simulate({ seed: 1, A: team(man.slice(0, 4)), B: team(FOE), maxRounds: 1 });
    expect(dealt(hurt, 'A') / hurt.units.filter((u) => u.side === 'A').length).toBeGreaterThan(0);
    // 同样的出手，低血量那队单次伤害更高（总伤害以出手次数归一）
    const hits = (r: ReturnType<typeof simulate>) => r.events.filter((e) => e.t === 'damage' && r.units.find((u) => u.uid === e.src)?.side === 'A').length || 1;
    expect(dealt(hurt, 'A') / hits(hurt)).toBeGreaterThan(dealt(full, 'A') / hits(full));
  });
  it('蜀·同心：蜀越多暴击越高、治疗越强', () => {
    const shu = simulate({ seed: 1, A: team(['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei', 'shu_zhugemiaoliang', 'wei_guojia']), B: team(FOE), maxRounds: 1, noBonds: true });
    const mixed = simulate({ seed: 1, A: team(['shu_liumiaobei', 'wei_guanyunmiao' as never, 'wu_huanggai', 'qun_dongzhuo', 'man_wutugu'].filter((x) => x !== 'wei_guanyunmiao' as never).concat('xian_guanlu')), B: team(FOE), maxRounds: 1, noBonds: true });
    const crit = (r: ReturnType<typeof simulate>) => r.units.find((u) => u.heroId === 'shu_liumiaobei')!.crit;
    expect(crit(shu)).toBeGreaterThan(crit(mixed));
  });
  it('仙·天命有多种结果且战斗正常结束', () => {
    const xian = ['xian_zuoci', 'xian_zhangzhua', 'xian_shuijing', 'xian_guanlu', 'wei_guojia'];
    const texts = new Set<string>();
    for (let s = 1; s <= 30; s++) { const r = simulate({ seed: s, A: team(xian), B: team(FOE), maxRounds: 8 }); expect(r.events.at(-1)?.t).toBe('end'); for (const e of r.events) if (e.t === 'text') texts.add(e.text); }
    expect(texts.has('天命')).toBe(true);
  });
  it('多波战斗继承的残血不会被同阵营 / 羁绊加成回满', () => {
    const r = simulate({ seed: 1, A: team(['wei_caomiaode', 'wei_xiahoudun', 'wei_xuhuchi', 'wei_guojia', 'man_wutugu'], { hpPct: 0.4 }), B: team(FOE), maxRounds: 0 });
    for (const u of r.units.filter((x) => x.side === 'A')) expect(u.hp / u.maxHp).toBeLessThan(0.45);
  });
});
