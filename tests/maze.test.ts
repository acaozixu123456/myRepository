import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import { Rng } from '../src/engine/rng';
import { HERO_BY_ID } from '../src/data/heroes';
import { itemCount } from '../src/game/inventory';
import {
  BUFFS, BUFF_BY_ID, MAZE_EXTRA_MAX, clearedFloors, MAZE_FLOORS, abandonRun, buffChoices, buyRun, chooseBuff, ensureMaze, finishFloor, freeRuns, mazeRewardFor, mazeSetups, mazeStage, runsLeft, startRun,
} from '../src/game/maze';
import { paceLevel, waveSetups } from '../src/game/stage';
import { newPlayer } from '../src/game/state';

const at = (day: number) => new Date(2026, 9, 5 + day, 12).getTime();

describe('纸箱迷宫：数据', () => {
  it('加成 id 唯一、每档稀有度都有足够多、效果非空', () => {
    expect(new Set(BUFFS.map((b) => b.id)).size).toBe(BUFFS.length);
    for (const r of ['common', 'rare', 'epic'] as const) expect(BUFFS.filter((b) => b.rarity === r).length).toBeGreaterThanOrEqual(3);
    for (const b of BUFFS) { expect(Object.keys(b.e).length).toBeGreaterThan(0); expect(b.desc.length).toBeGreaterThan(0); }
  });
  it('选项：每层 3 个互不相同，同一局同一层永远一样，层数越高越容易出稀有', () => {
    const run = { id: 1, floor: 1, pending: 'choose' as const, buffs: [], carry: {} };
    const a = buffChoices(run, 100, 3), b = buffChoices(run, 100, 3);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(3);
    const rate = (floor: number) => { let epic = 0, n = 0; for (let r = 1; r <= 300; r++) for (const x of buffChoices({ ...run, id: r }, 7, floor)) { n++; if (x.rarity !== 'common') epic++; } return epic / n; };
    expect(rate(7)).toBeGreaterThan(rate(1));
  });
});

describe('纸箱迷宫：一局的流程', () => {
  it('次数：免费 1 次（VIP 加成），可买最多 2 次，次日重置；有进行中的一局不能再开', () => {
    const s = newPlayer(0); s.res.bells = 1000;
    expect(freeRuns(0)).toBe(1); expect(freeRuns(3)).toBe(2); expect(freeRuns(8)).toBe(3);
    expect(startRun(s, at(0)).ok).toBe(true);
    expect(startRun(s, at(0)).ok).toBe(false); // 进行中
    abandonRun(s, at(0));
    expect(runsLeft(s, at(0))).toBe(0);
    expect(startRun(s, at(0)).ok).toBe(false);
    for (let i = 0; i < MAZE_EXTRA_MAX; i++) expect(buyRun(s, at(0)).ok).toBe(true);
    expect(buyRun(s, at(0)).ok).toBe(false);
    expect(runsLeft(s, at(0))).toBe(MAZE_EXTRA_MAX);
    expect(runsLeft(s, at(1))).toBe(1);
    const poor = newPlayer(0); poor.res.bells = 0; expect(buyRun(poor, at(0)).ok).toBe(false);
  });
  it('打赢一层 → 选加成 → 进下一层；加成的回血 / 元气会写进带到下层的状态', () => {
    const s = newPlayer(0); startRun(s, at(0));
    const run = ensureMaze(s, at(0)).active!;
    expect(run.floor).toBe(1); expect(run.pending).toBe('fight');
    expect(chooseBuff(s, 'atk1', at(0)).ok).toBe(false); // 还没打完
    const ids = Object.keys(run.carry);
    const surv = Object.fromEntries(ids.map((id) => [id, { hpPct: 0.4, energy: 10 }]));
    const r = finishFloor(s, true, surv, at(0));
    expect(r.done).toBe(false); expect(run.pending).toBe('choose');
    const opts = buffChoices(run, ensureMaze(s, at(0)).day);
    expect(chooseBuff(s, 'nope', at(0)).ok).toBe(false);
    const healer = opts.find((o) => o.e.heal) ?? null;
    const pick = healer ?? opts[0];
    expect(chooseBuff(s, pick.id, at(0)).ok).toBe(true);
    expect(run.floor).toBe(2); expect(run.pending).toBe('fight'); expect(run.buffs).toEqual([pick.id]);
    if (pick.e.heal) expect(run.carry[ids[0]].hpPct).toBeCloseTo(Math.min(1, 0.4 + pick.e.heal));
    if (pick.e.energy) expect(run.carry[ids[0]].energy).toBe(10 + pick.e.energy);
  });
  it('倒下的猫不会被加成救活；输了本局结束，只按已通过层数结算，最高层记录更新', () => {
    const s = newPlayer(0); startRun(s, at(0));
    const run = ensureMaze(s, at(0)).active!;
    const ids = Object.keys(run.carry);
    finishFloor(s, true, Object.fromEntries(ids.map((id, i) => [id, { hpPct: i === 0 ? 0 : 0.5, energy: 0 }])), at(0));
    run.buffs.push('rest'); // 假装已经选了回血
    const first = buffChoices(run, ensureMaze(s, at(0)).day)[0];
    chooseBuff(s, first.id, at(0));
    expect(run.carry[ids[0]].hpPct).toBe(0);
    const fish = s.res.fish;
    const r = finishFloor(s, false, null, at(0));
    expect(r.done).toBe(true); expect(r.victory).toBe(false); expect(r.cleared).toBe(1);
    expect(s.res.fish - fish).toBe(mazeRewardFor(1).fish);
    expect(ensureMaze(s, at(0)).active).toBeNull(); expect(ensureMaze(s, at(0)).best).toBe(1);
  });
  it('在“选加成”阶段放弃，要把刚打赢的那一层也算进去', () => {
    const s = newPlayer(0); startRun(s, at(0));
    const run = ensureMaze(s, at(0)).active!;
    finishFloor(s, true, null, at(0));
    expect(run.pending).toBe('choose'); expect(clearedFloors(run)).toBe(1);
    const fish = s.res.fish;
    const r = abandonRun(s, at(0));
    expect(r?.fish).toBe(mazeRewardFor(1).fish); expect(s.res.fish - fish).toBe(mazeRewardFor(1).fish); expect(ensureMaze(s, at(0)).best).toBe(1);
  });
  it('奖励随通过层数单调递增，第 4 层和通关有额外宝箱', () => {
    for (let f = 1; f <= MAZE_FLOORS; f++) expect(mazeRewardFor(f).fish).toBeGreaterThan(mazeRewardFor(f - 1).fish);
    expect(mazeRewardFor(3).bells).toBe(0); expect(mazeRewardFor(4).bells).toBeGreaterThan(0);
    expect(mazeRewardFor(MAZE_FLOORS).tickets).toBeGreaterThan(mazeRewardFor(MAZE_FLOORS - 1).tickets);
    const s = newPlayer(0); startRun(s, at(0));
    const run = ensureMaze(s, at(0)).active!; run.floor = MAZE_FLOORS;
    const tickets = s.res.tickets;
    const r = finishFloor(s, true, null, at(0));
    expect(r.done && r.victory).toBe(true); expect(r.cleared).toBe(MAZE_FLOORS);
    expect(s.res.tickets - tickets).toBe(2); expect(itemCount(s, 'fishbone_medium')).toBe(2);
  });
  it('旧存档 / 刷新：进行中的一局存在 s.maze.active 里，可以 JSON 往返', () => {
    const s = newPlayer(0); startRun(s, at(0));
    const back = JSON.parse(JSON.stringify(s.maze));
    expect(back.active.floor).toBe(1); expect(back.active.pending).toBe('fight');
  });
});

describe('纸箱迷宫：战斗配置与平衡', () => {
  it('出战配置带上加成与上一层的血量；敌方配置：杂兵 + 首领层有首领', () => {
    const s = newPlayer(0); startRun(s, at(0));
    const run = ensureMaze(s, at(0)).active!;
    const base = mazeSetups(s, run).find((u) => u.heroId === 'wei_xiahoudun')!;
    run.buffs = ['atk3', 'crit2', 'red2']; run.carry.wei_xiahoudun = { hpPct: 0.3, energy: 20 };
    const buffed = mazeSetups(s, run).find((u) => u.heroId === 'wei_xiahoudun')!;
    expect((buffed.gear?.atk ?? 0)).toBeGreaterThan(base.gear?.atk ?? 0);
    expect(buffed.gear?.crit).toBeCloseTo(0.12); expect(buffed.gear?.dmgReduce).toBeCloseTo(0.12);
    expect(buffed.hpPct).toBe(0.3); expect(buffed.energy).toBe(20);
    const st = mazeStage(s, run, 1), foes = waveSetups(st, 0);
    expect(foes.length).toBeGreaterThanOrEqual(4); expect(st.kind).toBe('normal');
    run.floor = MAZE_FLOORS;
    const boss = mazeStage(s, run, 1);
    expect(boss.kind).toBe('boss');
    expect(boss.waves[0].enemies.some((e) => HERO_BY_ID[e.unit] && e.hpMul === 1.6)).toBe(true);
  });
  it('平衡检查：中期队伍（Lv.45）带着随机加成，平均能通过 4~8 层；极弱队伍过不了几层', () => {
    const play = (level: number, seed: number) => {
      const s = newPlayer(0); s.best = { chapter: 3, index: 24 };
      for (const h of Object.values(s.heroes)) { h.lv = level; h.star = 3; h.skillLv = 5; }
      const rng = new Rng(seed);
      startRun(s, at(seed));
      let cleared = 0;
      for (let guard = 0; guard < 20; guard++) {
        const m = ensureMaze(s, at(seed)), run = m.active;
        if (!run) break;
        const sim = simulate({ seed: 100 + guard + seed * 31, A: mazeSetups(s, run), B: waveSetups(mazeStage(s, run, m.day), 0) });
        const carry: Record<string, { hpPct: number; energy: number }> = {};
        for (const u of sim.units) if (u.side === 'A') carry[u.heroId] = { hpPct: u.alive ? u.hp / u.maxHp : 0, energy: u.energy };
        const win = sim.winner === 'A' && Object.values(carry).some((c) => c.hpPct > 0);
        const r = finishFloor(s, win, win ? carry : null, at(seed));
        if (r.done) { cleared = r.cleared; break; }
        const opts = buffChoices(ensureMaze(s, at(seed)).active!, m.day);
        chooseBuff(s, opts[Math.floor(rng.next() * 3)].id, at(seed));
      }
      return cleared;
    };
    const avg = (level: number) => { let t = 0; const N = 12; for (let i = 0; i < N; i++) t += play(level, i + 1); return t / N; };
    const mid = avg(45), weak = avg(8);
    console.log('maze avg cleared:', [8, 25, 35, 45, 55, 70].map((l) => `Lv${l}=${avg(l).toFixed(2)}`).join(' '), 'paceLevel', paceLevel(72));
    expect(mid).toBeGreaterThan(weak);
    expect(avg(70)).toBeGreaterThan(mid); // 队伍越强走得越深
    expect(weak).toBeLessThan(4);
    expect(mid).toBeGreaterThanOrEqual(3);
  });
});
