import { describe, expect, it } from 'vitest';
import { HERO_BY_ID } from '../src/data/heroes';
import { BLOCK, DAY, EPOCH, NPCS, NPC_BY_ID, npcLastSeenMin, npcLineup, npcOnline, npcProgress, onlineNpcs, repliesTo, worldFeed } from '../src/game/npc';

const at = (day: number, hour: number, min = 0) => new Date(2026, 9, 1 + day, hour, min).getTime();

describe('模拟玩家：名册', () => {
  it('恰好 20 个，id / 名字唯一，头像都是常规英雄', () => {
    expect(NPCS).toHaveLength(20);
    expect(new Set(NPCS.map((n) => n.id)).size).toBe(20);
    expect(new Set(NPCS.map((n) => n.name)).size).toBe(20);
    for (const n of NPCS) { expect(HERO_BY_ID[n.avatar]?.rarity).not.toBe('SP'); expect(n.chatty).toBeGreaterThan(0); expect(n.bio.length).toBeGreaterThan(4); }
  });
});

describe('模拟玩家：上线 / 下线', () => {
  it('确定性：同一时刻结果一致', () => {
    const t = at(3, 20, 10);
    expect(NPCS.map((n) => npcOnline(n, t))).toEqual(NPCS.map((n) => npcOnline(n, t)));
  });
  it('不会一直在线，也不会一直离线：每个人 7 天里都有上线与下线', () => {
    for (const n of NPCS) {
      let on = 0, total = 0;
      for (let t = at(5, 0); t < at(12, 0); t += BLOCK) { total++; if (npcOnline(n, t)) on++; }
      expect(on / total, n.name).toBeGreaterThan(0.02);
      expect(on / total, n.name).toBeLessThan(0.7);
    }
  });
  it('作息合理：晚高峰在线人数明显多于凌晨', () => {
    let night = 0, peak = 0;
    for (let d = 3; d < 13; d++) { night += onlineNpcs(at(d, 4)).length; peak += onlineNpcs(at(d, 21)).length; }
    expect(peak).toBeGreaterThan(night * 3);
    expect(peak / 10).toBeGreaterThanOrEqual(4);
    expect(peak / 10).toBeLessThanOrEqual(16);
  });
  it('夜猫子在凌晨比上班族更常在线', () => {
    const cnt = (id: string) => { let c = 0; for (let d = 3; d < 20; d++) for (let h = 0; h < 3; h++) if (npcOnline(NPC_BY_ID[id], at(d, h, 30))) c++; return c; };
    expect(cnt('n02')).toBeGreaterThan(cnt('n01'));
  });
  it('离线的人能算出“多久前在线”', () => {
    const t = at(4, 3, 30);
    const off = NPCS.find((n) => !npcOnline(n, t))!;
    const m = npcLastSeenMin(off, t);
    expect(m === null || m >= 1).toBe(true);
    const on = NPCS.find((n) => npcOnline(n, at(4, 21)));
    expect(on ? npcLastSeenMin(on, at(4, 21)) : 0).toBe(0);
  });
});

describe('模拟玩家：自由发展', () => {
  it('等级随天数单调不降（噪声外）、不超过 100，早入服的更靠前', () => {
    for (const n of NPCS) {
      let last = 0;
      for (let d = 0; d <= 60; d += 6) { const p = npcProgress(n, at(d, 12)); expect(p.level).toBeGreaterThanOrEqual(8); expect(p.level).toBeLessThanOrEqual(100); expect(p.level + 4).toBeGreaterThanOrEqual(last); last = Math.max(last, p.level); }
    }
    expect(npcProgress(NPC_BY_ID.n05, at(10, 12)).level).toBeGreaterThan(npcProgress(NPC_BY_ID.n19, at(10, 12)).level);
  });
  it('战力、关卡与等级一致，进度在六章范围内', () => {
    for (const n of NPCS) {
      const p = npcProgress(n, at(20, 12));
      expect(p.power).toBeGreaterThan(0); expect(p.chapter).toBeGreaterThanOrEqual(1); expect(p.chapter).toBeLessThanOrEqual(6); expect(p.index).toBeGreaterThanOrEqual(1); expect(p.index).toBeLessThanOrEqual(24);
    }
    const a = npcProgress(NPC_BY_ID.n05, at(5, 12)), b = npcProgress(NPC_BY_ID.n05, at(40, 12));
    expect(b.power).toBeGreaterThan(a.power);
  });
  it('阵容：5 个不重复英雄，前排 3（守护/先锋）后排 2；氪佬带着自己的至尊猫', () => {
    for (const n of NPCS) {
      const l = npcLineup(n, at(8, 12), 40);
      expect(l).toHaveLength(5); expect(new Set(l.map((x) => x.heroId)).size).toBe(5);
      l.forEach((u, i) => { expect(u.pos).toBe(i); const r = HERO_BY_ID[u.heroId].role; if (i < 3 && !n.sp) expect(['守护', '先锋']).toContain(r); });
      if (n.sp) expect(l.some((u) => u.heroId === n.sp)).toBe(true);
    }
  });
});

describe('世界聊天', () => {
  it('确定性、按时间排序、没有残留占位符', () => {
    const a = worldFeed(at(5, 8), at(5, 23)), b = worldFeed(at(5, 8), at(5, 23));
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) expect(a[i].t).toBeGreaterThanOrEqual(a[i - 1].t);
    for (const m of a) { expect(m.text.length).toBeGreaterThan(1); expect(m.text).not.toMatch(/\{\w+\}/); expect(m.t).toBeGreaterThanOrEqual(at(5, 8)); expect(m.t).toBeLessThanOrEqual(at(5, 23)); }
  });
  it('不同时段切片拼接与整段一致（离线追赶不会丢也不会重）', () => {
    const whole = worldFeed(at(6, 0), at(6, 23)).map((m) => m.id);
    const parts = [...worldFeed(at(6, 0), at(6, 11)), ...worldFeed(at(6, 11) + 1, at(6, 23))].map((m) => m.id);
    expect(parts).toEqual(whole);
    expect(new Set(whole).size).toBe(whole.length);
  });
  it('密度合理：晚高峰每小时 2~40 条，凌晨明显更少；只有在线的人会说话', () => {
    const per = (h: number) => { let c = 0; for (let d = 3; d < 13; d++) c += worldFeed(at(d, h), at(d, h, 59)).filter((m) => m.kind === 'chat').length; return c / 10; };
    expect(per(21)).toBeGreaterThanOrEqual(2); expect(per(21)).toBeLessThanOrEqual(40); expect(per(4)).toBeLessThan(per(21));
    for (const m of worldFeed(at(4, 18), at(4, 22)).filter((x) => x.kind === 'chat')) expect(npcOnline(NPC_BY_ID[m.from], m.t)).toBe(true);
  });
  it('语料丰富：一周内不同台词 ≥ 150 种', () => {
    const set = new Set(worldFeed(EPOCH + 3 * DAY, EPOCH + 10 * DAY).filter((m) => m.kind === 'chat').map((m) => m.text));
    expect(set.size).toBeGreaterThanOrEqual(150);
  });
  it('系统公告每天中午与晚上各一条', () => {
    const sys = worldFeed(at(3, 0), at(3, 23, 59)).filter((m) => m.id.startsWith('sys:daily'));
    expect(sys).toHaveLength(2);
  });
});

describe('NPC 回应玩家', () => {
  it('确定性，延迟递增在 3~40 秒内，@ 到玩家', () => {
    const msg = { id: 'me-1', t: at(5, 21, 5), text: '大家好，求推荐阵容？' };
    const a = repliesTo(msg, '铲屎官'), b = repliesTo(msg, '铲屎官');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(1);
    let last = msg.t;
    for (const r of a) { expect(r.t - last).toBeGreaterThanOrEqual(3000); expect(r.t - last).toBeLessThanOrEqual(30000); last = r.t; expect(r.text).not.toMatch(/\{\w+\}/); }
    expect(a[0].text).toContain('@铲屎官');
  });
  it('凌晨没人在线时可以没人理', () => {
    let quiet = 0;
    for (let d = 3; d < 30; d++) if (repliesTo({ id: `m${d}`, t: at(d, 4), text: '有人吗' }, '我').length === 0) quiet++;
    expect(quiet).toBeGreaterThan(0);
  });
});
