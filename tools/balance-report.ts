import type { BalanceReport, HeroBalanceStats, WinStats } from '../src/game/balance';
import { BALANCE_MIN_SAMPLES, BALANCE_SKILL_LEVEL } from '../src/game/balance';
import { FACTIONS } from '../src/data/factions';
import { HERO_BY_ID } from '../src/data/heroes';
import { KITS } from '../src/data/kits';

type Cell = string | number;
const cell = (value: Cell): string => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const table = (head: string[], rows: Cell[][]): string => [head, head.map(() => '---'), ...rows].map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n');
const num = (value: number | null, digits = 2): string => value === null ? '—（无样本）' : value.toFixed(digits);
const pct = (value: number | null): string => value === null ? '—（无样本）' : `${(value * 100).toFixed(2)}%`;
const pp = (value: number | null): string => value === null ? '—（无样本）' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)} 个百分点`;
const sample = (stats: WinStats): string => `${stats.samples}${stats.lowSample ? '（低样本）' : ''}`;
const record = (stats: WinStats): string => `${stats.wins} / ${stats.losses} / ${stats.draws}`;
const heroName = (id: string): string => HERO_BY_ID[id]?.name ?? id;

function rankingRows(heroes: HeroBalanceStats[], descending: boolean): Cell[][] {
  return heroes.filter((hero) => hero.winRate !== null).sort((a, b) => {
    const gap = a.winRate! - b.winRate!;
    return (descending ? -gap : gap) || a.heroId.localeCompare(b.heroId);
  }).slice(0, 5).map((hero, index) => [index + 1, hero.name, sample(hero), pct(hero.winRate), pp(hero.deviation), pct(hero.avgDamageShare), pct(hero.avgHealingShare)]);
}

function proposalRows(report: BalanceReport): Cell[][] {
  return report.anomalies.filter((anomaly) => anomaly.kind === 'hero').map((anomaly) => {
    const hero = report.heroes.find((entry) => entry.heroId === anomaly.id);
    if (!hero) return [anomaly.name, anomaly.samples, '核对英雄引用与统计来源后再提出数值实验。'];
    if (!KITS[hero.heroId]) return [hero.name, hero.samples, '先补齐手工技能组并重跑；暂不据通用技能表现调整最终设计。'];
    const source = hero.role === '守护' ? '绝技护盾' : (hero.avgHealingShare ?? 0) > (hero.avgDamageShare ?? 0) ? '绝技治疗' : '绝技主要伤害';
    const change = anomaly.direction === 'high' ? '降低10%' : '提高10%';
    return [hero.name, hero.samples, `候选实验：只将${source}倍率${change}，保持阵容与种子，对比胜率、超时和贡献；由 Claude 决定是否开展。`];
  });
}

/** 纯 Markdown 渲染；时间由 CLI 提供，不读取时钟、文件、环境变量或 argv。 */
export function renderBalanceReport(report: BalanceReport, generatedAt: string): string {
  const { options, summary } = report;
  const handcrafted = report.heroes.filter((hero) => KITS[hero.heroId]).length;
  const generic = report.heroes.filter((hero) => !KITS[hero.heroId]).map((hero) => hero.name);
  const parts = [
    '# 猫国志 · 数值平衡报告',
    `生成时间：${cell(generatedAt)}`,
    table(['随机主样本局数', '等级', '星级', '随机觉醒', '种子', '技能等级', '整轮上限'], [[options.games, options.level, options.star, options.randomAwakening ? '开启' : '关闭', options.seed, BALANCE_SKILL_LEVEL, 30]]),
    `当前英雄目录中，${handcrafted} 只使用手工技能组，${generic.length} 只使用通用技能组${generic.length ? `：${generic.join('、')}` : ''}。本报告衡量此版本实际技能与阵容组合。`,
    '## 样本与统计口径',
    table(['样本来源', '实际对局数', '用途'], [
      ['随机主样本', summary.randomGames, '英雄、主阵营、随机羁绊、回合与事件统计'],
      ['克制环探针', summary.counterProbeGames, '六个方向的定向对阵；独立统计'],
      ['羁绊探针', summary.bondProbeGames, '完整成员与替换一成员的对照；独立统计'],
      ['合计', summary.totalSimulations, `每个克制方向、每个羁绊对照分支各 ${summary.probePairs} 组换边配对`],
    ]),
    [
      '- 随机主样本按同一阵容、同一战斗种子交换 A / B 各打一局；同英雄的站位与觉醒跟随阵容。相邻配对相关，不能把它们当作完全独立观测。',
      '- 胜率 =（胜场 + 0.5 × 平局）/ 样本数。英雄样本是出场次数，阵营样本是队内至少三只同族的队伍次数；相同阵营在双方出现时各计一次。',
      '- 伤害取对敌事件 amount，包含护盾吸收与过量伤害；absorbed 已包含在 amount 中，不重复加。排除自损和对友方的伤害。',
      '- 持续伤害（DOT）沿状态首次建立的来源归因；当前引擎刷新同名状态不改变来源，即使其他猫增加了层数或强度。移除或睡着后清除归属；无法归因的 DOT 单独列示，不硬分给英雄。',
      '- 治疗取实际 heal.amount，按 src 归因；「呼噜」事件的 src 是被治疗猫，因此算其自疗，不算原施加者治疗。护盾施加量不当作治疗。',
      '- 伤害 / 治疗占比先按每次出场在本队已归因总量中求比例，再按出场次数平均；队伍没有相应事件时该场占比为零。',
      '- 阵亡率统计每次出场是否至少出现一次 death；复活不会抹去该次阵亡，反复睡着也只计一次。表中终局睡着率另列，便于识别复活机制。',
      '- 首个绝技回合读取 round 事件，只对出现过 ultimate 行动的主样本取均值；没有绝技的局数另列。达到30轮且双方仍有醒着的猫算超时，最终仍可由引擎按剩余生命判胜，超时不等于平局。',
      `- 无样本显示「—（无样本）」；低于 ${BALANCE_MIN_SAMPLES} 个样本标注「低样本」。排名与阈值异常是复核线索，不代表因果结论或统计显著性。`,
      '- 克制探针保持相同的中立队友、等级与觉醒规则，目标克制方胜率为55%～65%；不同阵营的英雄、职业与技能仍会混入结果，不能单凭胜率判定伤害倍率。',
      '- 羁绊随机提升是成员齐全队伍与未齐全队伍的观察差；探针提升是替换一名英雄后的对照差。英雄替换、职业和阵营构成变化仍有混杂，并未关闭引擎羁绊后重跑。',
    ].join('\n'),
    ...(report.notes.length ? ['补充约定：\n\n' + report.notes.map((note) => `- ${cell(note)}`).join('\n')] : []),
    '## 随机主样本 · 战斗节奏',
    table(['指标', '数值', '样本 / 分母'], [
      ['平均战斗整轮数', num(summary.avgRounds), summary.randomGames],
      ['达到30轮且双方存活', `${summary.timeoutGames}（${pct(summary.timeoutRate)}）`, summary.randomGames],
      ['引擎判定平局', `${summary.drawGames}（${pct(summary.drawRate)}）`, summary.randomGames],
      ['首个绝技平均回合', num(summary.avgFirstUltimateRound), summary.gamesWithUltimate],
      ['没有绝技的对局', summary.gamesWithoutUltimate, summary.randomGames],
      ['已归因对敌伤害（含护盾）', summary.enemyDamage, summary.randomGames],
      ['实际治疗', summary.healing, summary.randomGames],
      ['无法归因的持续伤害', summary.unattributedDotDamage, summary.randomGames],
      ['排除的自损 / 友伤', summary.excludedFriendlyDamage, summary.randomGames],
    ]),
    '## 随机主样本 · 全部英雄',
    table(['英雄', '阵营 / 稀有度 / 职业', '出场', '胜 / 负 / 平', '胜率', '偏离50%', '平均伤害占比', '平均治疗占比', '绝技总次数 / 次均', '曾睡着次数 / 率', '终局睡着率'], report.heroes.map((hero) => [
      `${hero.name}（${hero.heroId}）`, `${FACTIONS[hero.faction].name} / ${hero.rarity} / ${hero.role}`, sample(hero), record(hero), pct(hero.winRate), pp(hero.deviation), pct(hero.avgDamageShare), pct(hero.avgHealingShare), `${hero.ultimateCasts} / ${num(hero.avgUltimateCasts)}`, `${hero.sleepAppearances} / ${pct(hero.sleepRate)}`, pct(hero.finalSleepRate),
    ])),
    '## 随机主样本 · 主阵营',
    table(['主阵营（至少三只）', '出场样本', '胜 / 负 / 平', '胜率', '偏离50%'], report.factions.map((faction) => [faction.name, sample(faction), record(faction), pct(faction.winRate), pp(faction.deviation)])),
    '## 克制环探针',
    table(['方向', '探针局数', '胜 / 负 / 平', '克制方胜率', '目标区间', '判读'], report.counters.map((counter) => [
      `${FACTIONS[counter.advantagedFaction].name} → ${FACTIONS[counter.disadvantagedFaction].name}`, sample(counter), record(counter), pct(counter.winRate), `${pct(counter.expectedMin)}～${pct(counter.expectedMax)}`, counter.winRate === null ? '无样本' : counter.winRate < counter.expectedMin ? '克制方偏低，待复核' : counter.winRate > counter.expectedMax ? '克制方偏高，待复核' : '落在目标区间',
    ])),
    '## 羁绊 · 随机观察与独立探针',
    table(['羁绊 / 成员', '随机齐全样本 / 胜率', '随机未齐全样本 / 胜率', '随机观察提升', '探针齐全样本 / 胜率', '探针替换样本 / 胜率', '探针对照提升'], report.bonds.map((bond) => [
      `${bond.name}（${bond.heroes.map(heroName).join('、')}）`, `${sample(bond.randomWithBond)} / ${pct(bond.randomWithBond.winRate)}`, `${sample(bond.randomWithoutBond)} / ${pct(bond.randomWithoutBond.winRate)}`, pp(bond.randomLift), `${sample(bond.probeWithBond)} / ${pct(bond.probeWithBond.winRate)}`, `${sample(bond.probeControl)} / ${pct(bond.probeControl.winRate)}`, pp(bond.probeLift),
    ])),
    '## Top 5 · 胜率偏高与偏低',
    '以下按随机主样本参与胜率排名；低样本仍保留标记，不等同于已确认过强或过弱。',
    '### 胜率最高五只',
    table(['排序', '英雄', '样本', '胜率', '偏离50%', '伤害占比', '治疗占比'], rankingRows(report.heroes, true)),
    '### 胜率最低五只',
    table(['排序', '英雄', '样本', '胜率', '偏离50%', '伤害占比', '治疗占比'], rankingRows(report.heroes, false)),
    '## 异常摘要',
    `仅样本达到 ${BALANCE_MIN_SAMPLES} 的对象进入异常清单：英雄偏离50%超过±12个百分点，主阵营超过±8个百分点；克制探针超出55%～65%也列入复核。低样本只列提示，暂不标失衡。`,
    report.anomalies.length ? table(['类别', '对象', '样本', '胜率', '预期区间', '方向', '说明'], report.anomalies.map((anomaly) => [
      anomaly.kind === 'hero' ? '英雄' : anomaly.kind === 'faction' ? '主阵营' : '克制环', anomaly.name, anomaly.samples, pct(anomaly.winRate), `${pct(anomaly.expectedMin)}～${pct(anomaly.expectedMax)}`, anomaly.direction === 'high' ? '偏高' : '偏低', anomaly.message,
    ])) : '本次样本足够的对象中，没有超过设定阈值的异常；低样本对象尚不能据此判断。',
    report.lowSamples.length ? `低样本提示（最低 ${BALANCE_MIN_SAMPLES}）：\n\n` + table(['对象', '样本', '所需最低样本'], report.lowSamples.map((entry) => [entry.name, entry.samples, entry.required])) : `所有已统计对象均达到 ${BALANCE_MIN_SAMPLES} 个样本。`,
    '## 待 Claude 裁决的调整建议',
    ...(proposalRows(report).length ? [table(['英雄', '样本', '单项实验草案'], proposalRows(report))] : []),
    [
      '先按异常样本量、伤害 / 治疗占比与战斗节奏选单个机制做对照模拟；本工具没有修改任何技能或引擎数值。',
      '- 英雄偏高：优先检查高占比来源；可提案单独试验绝技主要伤害、治疗或护盾倍率降低10%，与原版同阵容、同种子、交换双方比较。低占比却高胜率时先复核控制、回能、复活与羁绊，不宜直接减伤害。',
      '- 英雄偏低：先检查是否仍用通用技能、首绝技能否及时出现及职业配置；机制完整后，可提案单独试验绝技主要倍率提高10%，或回能增加5点，两项分别模拟。',
      '- 主阵营 / 克制方向异常：先排查阵容职业、关键英雄及羁绊的组合强弱，再讨论克制倍率；未经配对验证，不把所有方向统一改值。',
      '- 羁绊提升较大或接近零：先核对当前引擎实际实现与设计文本，再固定英雄成员测试羁绊开关；现有替换成员探针无法代替这一因果实验。',
      '以上都是候选实验，由 Claude 决定是否开新 Issue；本报告不自动给技能加减数值。',
    ].join('\n\n'),
  ];
  return parts.join('\n\n') + '\n';
}
