import { HERO_BY_ID } from '../src/data/heroes';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';
import { getStage, paceLevel, stageOrdinal, waveSetups } from '../src/game/stage';

// 每章选三名克制阵营成员，再补前排与医者，固定0→4站位。
const REFERENCES = [
  ['wei_xiahoudun', 'wei_xuhuchi', 'wu_huanggai', 'wei_guojia', 'wu_sunxiangxiang'],
  ['wei_xuhuchi', 'wei_xiahoudun', 'xian_zuoci', 'xian_shuijing', 'xian_guanlu'],
  ['man_mengmiaohuo', 'wei_xiahoudun', 'man_zhurong', 'man_mulu', 'xian_shuijing'],
  ['shu_zhangmiaofei', 'shu_guanyunmiao', 'wu_huanggai', 'shu_zhugemiaoliang', 'wei_guojia'],
  ['wei_xuhuchi', 'wu_sunxiaoba', 'wu_sunxiangxiang', 'wu_zhoumiaoyu', 'xian_shuijing'],
  ['wei_xuhuchi', 'wei_xiahoudun', 'wu_sunxiangxiang', 'wei_caomiaode', 'wei_guojia'],
];
export interface BossProbe {
  chapter: number;
  stageId: string;
  level: number;
  star: number;
  skillLv: number;
  lineup: string[];
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export function probeBosses(games = 100, seed = 20261011): BossProbe[] {
  return REFERENCES.map((ids, i) => {
    const chapter = i + 1;
    const stage = getStage(chapter, 24)!;
    const level = paceLevel(stageOrdinal(chapter, 24));
    const star = level < 20 ? 1 : level < 40 ? 2 : level < 65 ? 3 : level < 90 ? 4 : 5;
    const skillLv = level < 20 ? 1 : level < 40 ? 3 : level < 65 ? 6 : level < 90 ? 9 : 10;
    const reference: UnitSetup[] = ids.map((heroId, pos) => ({
      heroId, pos, level, star, skillLv, ...(star === 5 ? { awaken: 'A' as const } : {}),
    }));
    const row: BossProbe = { chapter, stageId: stage.id, level, star, skillLv, lineup: ids.slice(), games, wins: 0, losses: 0, draws: 0 };
    for (let game = 0; game < games; game++) {
      let A = reference.map((unit) => ({ ...unit }));
      let result: 'A' | 'B' | 'draw' = 'A';
      for (let wave = 0; wave < stage.waves.length; wave++) {
        const battle = simulate({
          seed: seed + game * 17 + wave * 997,
          A, B: waveSetups(stage, wave), rules: stage.ruleFx, maxRounds: 40,
        });
        result = battle.winner;
        if (result !== 'A') break;
        A = reference.flatMap((setup) => {
          const survivor = battle.units.find((unit) => unit.side === 'A' && unit.heroId === setup.heroId);
          return survivor?.alive ? [{ ...setup, hpPct: survivor.hp / survivor.maxHp, energy: survivor.energy }] : [];
        });
      }
      if (result === 'A') row.wins++;
      else if (result === 'B') row.losses++;
      else row.draws++;
    }
    return row;
  });
}

export function renderBossComparison(before: BossProbe[], after: BossProbe[], baseline: string, seed: number): string {
  const lines = [
    '# Boss 阶段通关率对照（Issue #42）', '',
    '基线 campaign 提交：' + baseline + '。前后使用同一份当前引擎、英雄、技能、敌方数值与种子，仅替换 campaign 配置；基线已经落地的普通关卡规则和绝技预告保留。',
    '每关 ' + after[0].games + ' 个固定种子，起点 ' + seed + '；逐波模拟，保留存活猫的生命比例和元气，每波上限40轮。胜率指打完所有波，平局不算通关。', '',
    '参考队按该章克制环搭配三名同族，补前排与医者；这是固定阵容对照，含已招募的 SSR / UR，不是新手必得阵容保证。等级来自 paceLevel；星级1/2/3/4/5分界为20/40/65/90，技能等级1/3/6/9/10同分界；只有五星使用觉醒A。', '',
    '| Boss关 | 等级 / 星 / 技能 | 阵容（位置0→4） | 原规则胜/负/平 | 加阶段胜/负/平 | 原胜率 | 加阶段胜率 | 变化 |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const row of after) {
    const old = before.find((entry) => entry.stageId === row.stageId)!;
    const pct = (wins: number) => (wins / row.games * 100).toFixed(1) + '%';
    lines.push('| ' + row.stageId + ' | ' + row.level + ' / ' + row.star + ' / ' + row.skillLv + ' | ' +
      row.lineup.map((id) => HERO_BY_ID[id].name).join('、') + ' | ' +
      [old.wins, old.losses, old.draws].join('/') + ' | ' + [row.wins, row.losses, row.draws].join('/') + ' | ' +
      pct(old.wins) + ' | ' + pct(row.wins) + ' | ' + ((row.wins - old.wins) / row.games * 100).toFixed(1) + '个百分点 |');
  }
  lines.push('', '## 待 Claude 复核', '');
  let observations = 0;
  for (const row of after) {
    const old = before.find((entry) => entry.stageId === row.stageId)!;
    if (row.wins === 0 || old.wins - row.wins >= row.games * 0.15) {
      observations++;
      lines.push('- ' + row.stageId + '：' + (old.wins === 0 ? '基线已为0胜，需复核参考队和原有难度。' :
        row.wins === 0 ? '新增阶段后变为0胜。' : '该固定队胜率下降至少15个百分点。') + '未调整敌方或英雄数值。');
    }
  }
  if (!observations) lines.push('- 六支参考队均有通关样本，没有达到下降15个百分点的观察线。');
  lines.push('', '结果用于发现异常，不保证全部阵容都能通关。待实现的阶段见 BOSS_TODO.md，本报告只评估已经执行的规则。', '');
  return lines.join('\n');
}
