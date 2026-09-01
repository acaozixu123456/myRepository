import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  primaryNhkTrainingSentence,
  shiftDateKey,
  type NhkMorningSession,
  type NhkRecallRating,
} from './nhkMorning';

export const NHK_RECOVERY_QUEUE_VERSION = 'nhk-recovery-queue-v1';
export const NHK_RECOVERY_DAILY_LIMIT = 3;

export type NhkRecoveryReason =
  | 'boss-weak'
  | 'recall-miss'
  | 'recall-close'
  | 'world-transfer'
  | 'shadow-omission'
  | 'recap-content';

export type NhkRecoveryRegister = 'daily' | 'polite' | 'business';

export type NhkRecoveryScenario = {
  version: 1;
  scenarioId: string;
  register: NhkRecoveryRegister;
  situationZh: string;
  promptJa: string;
  cueZh: string;
  referenceAnswerJa: string;
};

export type NhkRecoveryAttempt = {
  recoveryId: string;
  dateKey: string;
  scenarioId: string;
  reason: NhkRecoveryReason;
  rating: NhkRecallRating;
  reviewId?: string;
  targetExpressionUsed?: boolean;
  contentScore?: number;
  completedAt: number;
};

export type NhkRecoveryQueueItem = {
  recoveryId: string;
  sourceSessionId: string;
  sourceDateKey: string;
  sourceTitle: string;
  targetExpression: string;
  reason: NhkRecoveryReason;
  reasonZh: string;
  priority: number;
  scenario: NhkRecoveryScenario;
};

type ScenarioDraft = Omit<NhkRecoveryScenario, 'version' | 'scenarioId'>;

const clean = (value: unknown, max = 420): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const asSentence = (value: string): string => {
  const normalized = clean(value);
  return normalized && !/[。！？]$/.test(normalized) ? `${normalized}。` : normalized;
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const attemptsForExpression = (session: NhkMorningSession): NhkRecoveryAttempt[] =>
  (session.recoveryAttempts || []) as NhkRecoveryAttempt[];

const crossRegister = (attemptCount: number): NhkRecoveryRegister =>
  (['daily', 'business', 'polite'] as const)[attemptCount % 3];

const restrictionScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '安全检查时，新成员准备把个人 USB 插入公司电脑。',
  promptJa: '個人のUSBを会社のパソコンで使ってもいいですか。',
  cueZh: '先明确阻止，再用完整规则句说明。',
  referenceAnswerJa: '会社のパソコンでは、個人のUSBを使ってはいけません。',
} : {
  register: 'daily',
  situationZh: '晚上十点后，朋友想在公寓里练乐器。',
  promptJa: '今から楽器を練習しても大丈夫ですか。',
  cueZh: '像真实生活中一样，简洁说明这里不能做什么。',
  referenceAnswerJa: 'この建物では、夜10時以降に楽器を演奏してはいけません。',
};

const unavailableScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '项目晨会上，需要说明旧系统下个月停止使用。',
  promptJa: '旧システムは、来月も使えますか。',
  cueZh: '把时间和“以后不能使用”的结果放进同一句。',
  referenceAnswerJa: '来月から、旧システムを使うことができなくなります。',
} : {
  register: 'daily',
  situationZh: '车站售票机更新后，旧交通卡将不能再充值。',
  promptJa: 'この古いカードは、来月もチャージできますか。',
  cueZh: '不要只回答“不行”，完整说明变化。',
  referenceAnswerJa: '来月から、この古いカードにチャージすることができなくなります。',
};

const responseScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '客户修改了规格，你需要说明团队采取了什么行动。',
  promptJa: '仕様変更のあと、何を対応しましたか。',
  cueZh: '先说触发原因，再说已经采取的动作。',
  referenceAnswerJa: '仕様変更を受けて、テストケースを見直しました。',
} : {
  register: 'daily',
  situationZh: '天气预报说会下大雨，你改变了周末计划。',
  promptJa: 'どうして週末の予定を変えたんですか。',
  cueZh: '使用“受到某个消息影响后……”来连接原因和行动。',
  referenceAnswerJa: '大雨の予報を受けて、週末の予定を変更しました。',
};

const habitScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '为了防止测试遗漏，你在晨会上说明新的确认习惯。',
  promptJa: '確認漏れを防ぐために、最近何をしていますか。',
  cueZh: '说出团队现在持续坚持的一项具体动作。',
  referenceAnswerJa: '確認漏れが起きないように、テスト前にチェックリストを見るようにしています。',
} : {
  register: 'daily',
  situationZh: '最近睡眠不足，你开始调整睡前习惯。',
  promptJa: 'よく眠るために、何か気をつけていますか。',
  cueZh: '用“尽量做到……”说明正在持续的习惯。',
  referenceAnswerJa: '寝る前は、スマートフォンを見すぎないようにしています。',
};

const ruleScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '新成员询问正式上线前的确认流程。',
  promptJa: '本番リリースの前に、どのような確認をしますか。',
  cueZh: '用正式表达说明既定流程。',
  referenceAnswerJa: '本番リリースの前に、担当者がチェックリストを確認することになっています。',
} : {
  register: 'polite',
  situationZh: '邻居第一次来问公寓的垃圾投放时间。',
  promptJa: 'ごみは、いつ出せばいいですか。',
  cueZh: '礼貌说明这里固定的规则。',
  referenceAnswerJa: 'このマンションでは、ごみは朝8時までに出すことになっています。',
};

const opinionScenario = (variant: number): ScenarioDraft => variant % 2 === 0 ? {
  register: 'business',
  situationZh: '会议上被问到是否应增加一次上线前检查。',
  promptJa: 'リリース前の確認をもう一回増やす必要がありますか。',
  cueZh: '先明确判断，再给一个项目上的理由。',
  referenceAnswerJa: '影響範囲が広いため、確認を一回増やす必要があると考えています。',
} : {
  register: 'polite',
  situationZh: '初次见面的人问你是否支持给儿童设置网络使用规则。',
  promptJa: '子どものインターネット利用にルールは必要だと思いますか。',
  cueZh: '礼貌表达立场，并给出一个简单原因。',
  referenceAnswerJa: '子どもを守るために、年齢に合ったルールが必要だと考えています。',
};

const genericScenario = (
  register: NhkRecoveryRegister,
  dailyVersion: string,
  workVersion: string,
  sourceSentence: string,
): ScenarioDraft => {
  if (register === 'business') {
    return {
      register,
      situationZh: '晨会上需要把这条表达迁移成与当前工作有关的一句话。',
      promptJa: 'この表現を使って、今の仕事で確認すべきことを一つ説明してください。',
      cueZh: '不要复述新闻，直接说项目中真实可能发生的情况。',
      referenceAnswerJa: asSentence(workVersion || dailyVersion || sourceSentence),
    };
  }
  if (register === 'polite') {
    return {
      register,
      situationZh: '第一次见面的人问起类似问题，你需要礼貌表达自己的看法。',
      promptJa: 'この表現を使って、あなたの考えを丁寧に説明してください。',
      cueZh: '用两句以内完成：结论加一个理由。',
      referenceAnswerJa: asSentence(dailyVersion || workVersion || sourceSentence),
    };
  }
  return {
    register,
    situationZh: '朋友问起最近生活中相似的情况。',
    promptJa: 'この表現を使って、あなたの生活に近い例を一つ話してください。',
    cueZh: '选一个身边例子，先独立说，再查看参考。',
    referenceAnswerJa: asSentence(dailyVersion || sourceSentence || workVersion),
  };
};

const scenarioFor = (
  session: NhkMorningSession,
  targetExpression: string,
  attemptCount: number,
): NhkRecoveryScenario => {
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  const sourceSentence = clean(primary?.sourceSentence || session.selectedSentences?.[0] || session.shadowText);
  const value = `${targetExpression}\n${sourceSentence}`;
  const variant = attemptCount % 2;
  let draft: ScenarioDraft;
  if (/(てはいけない|ではいけない)/.test(value)) draft = restrictionScenario(variant);
  else if (/(ことができなく|利用できなく|使えなく)/.test(value)) draft = unavailableScenario(variant);
  else if (/を受けて/.test(value)) draft = responseScenario(variant);
  else if (/(ようにする|ようにしています|ようにしている)/.test(value)) draft = habitScenario(variant);
  else if (/(ことになって|決まりになって)/.test(value)) draft = ruleScenario(variant);
  else if (/(と考えて|必要だと思|必要があると思)/.test(value)) draft = opinionScenario(variant);
  else draft = genericScenario(
    crossRegister(attemptCount),
    primary?.dailyVersion || session.dailyVersion,
    primary?.workVersion || session.workVersion,
    sourceSentence,
  );
  return {
    version: 1,
    scenarioId: `${NHK_RECOVERY_QUEUE_VERSION}-${session.id}-${stableHash(`${targetExpression}|${attemptCount}|${draft.promptJa}`)}`,
    ...draft,
    referenceAnswerJa: asSentence(draft.referenceAnswerJa),
  };
};

const mostRecentRecallRating = (session: NhkMorningSession): NhkRecallRating | null => {
  const attempts = [...(session.recallAttempts || [])].sort((left, right) => right.completedAt - left.completedAt);
  return attempts[0]?.rating || null;
};

const candidateReason = (
  session: NhkMorningSession,
  bossWeakExpressions: Set<string>,
): {reason: NhkRecoveryReason; reasonZh: string; priority: number} | null => {
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  const expression = clean(session.keyExpression || primary?.expression, 180);
  if (!expression) return null;
  if (bossWeakExpressions.has(expression)) {
    return {reason: 'boss-weak', reasonZh: '本周 Boss 里还没有稳定说出来', priority: 140};
  }
  const rating = mostRecentRecallRating(session);
  if (rating === 'miss') return {reason: 'recall-miss', reasonZh: '最近一次延迟回忆没有想起', priority: 120};
  if (rating === 'close') return {reason: 'recall-close', reasonZh: '最近一次延迟回忆只差一点', priority: 85};
  const world = session.speechReviews?.world;
  if (world && !world.metrics.targetExpressionUsed) {
    return {reason: 'world-transfer', reasonZh: '进入世界时没有主动用出目标表达', priority: 75};
  }
  const shadow = session.speechReviews?.shadow;
  if (shadow && shadow.metrics.omissionRate >= 18) {
    return {
      reason: 'shadow-omission',
      reasonZh: `核心句漏词率仍有 ${shadow.metrics.omissionRate}%`,
      priority: Math.min(74, 45 + shadow.metrics.omissionRate),
    };
  }
  const recap = session.speechReviews?.recap;
  if (recap && recap.metrics.contentScore < 60) {
    return {
      reason: 'recap-content',
      reasonZh: `新闻复述完成度为 ${recap.metrics.contentScore}/100`,
      priority: Math.min(65, 35 + (60 - recap.metrics.contentScore)),
    };
  }
  return null;
};

const suppressedUntil = (attempt: NhkRecoveryAttempt): string =>
  shiftDateKey(attempt.dateKey, attempt.rating === 'good' ? 7 : attempt.rating === 'close' ? 2 : 1);

export const buildNhkRecoveryQueue = (
  sessions: NhkMorningSession[],
  todayKey: string,
  bossWeakExpressions: string[] = [],
): NhkRecoveryQueueItem[] => {
  const bossWeak = new Set(bossWeakExpressions.map(value => clean(value, 180)).filter(Boolean));
  const bestByExpression = new Map<string, NhkRecoveryQueueItem>();

  for (const session of sessions) {
    if (!session.completedAt || !session.dailyInput) continue;
    const primary = primaryNhkTrainingSentence(session.dailyInput);
    const targetExpression = clean(session.keyExpression || primary?.expression, 180);
    if (!targetExpression) continue;
    const attempts = attemptsForExpression(session);
    if (attempts.some(attempt => attempt.dateKey === todayKey)) continue;
    const latest = [...attempts].sort((left, right) => right.completedAt - left.completedAt)[0];
    if (latest && suppressedUntil(latest) > todayKey) continue;
    const candidate = candidateReason(session, bossWeak);
    if (!candidate) continue;
    const scenario = scenarioFor(session, targetExpression, attempts.length);
    const item: NhkRecoveryQueueItem = {
      recoveryId: `${NHK_RECOVERY_QUEUE_VERSION}-${session.id}-${todayKey}`,
      sourceSessionId: session.id,
      sourceDateKey: session.dateKey,
      sourceTitle: clean(session.dailyInput.title || session.title, 180),
      targetExpression,
      reason: candidate.reason,
      reasonZh: candidate.reasonZh,
      priority: candidate.priority,
      scenario,
    };
    const current = bestByExpression.get(targetExpression);
    if (!current || item.priority > current.priority
      || (item.priority === current.priority && item.sourceDateKey > current.sourceDateKey)) {
      bestByExpression.set(targetExpression, item);
    }
  }

  return [...bestByExpression.values()]
    .sort((left, right) => right.priority - left.priority || right.sourceDateKey.localeCompare(left.sourceDateKey))
    .slice(0, NHK_RECOVERY_DAILY_LIMIT);
};

export const recoveryRatingForReview = (review?: NhkSpeechReview): NhkRecallRating => {
  if (!review) return 'miss';
  if (review.metrics.targetExpressionUsed && review.metrics.contentScore >= 60) return 'good';
  if (review.metrics.targetExpressionUsed || review.metrics.contentScore >= 50) return 'close';
  return 'miss';
};

export const recordNhkRecoveryAttempt = (
  session: NhkMorningSession,
  item: NhkRecoveryQueueItem,
  todayKey: string,
  review?: NhkSpeechReview,
  fallbackRating?: NhkRecallRating,
  completedAt = Date.now(),
): NhkMorningSession => {
  const attempt: NhkRecoveryAttempt = {
    recoveryId: item.recoveryId,
    dateKey: todayKey,
    scenarioId: item.scenario.scenarioId,
    reason: item.reason,
    rating: fallbackRating || recoveryRatingForReview(review),
    ...(review ? {
      reviewId: review.id,
      targetExpressionUsed: review.metrics.targetExpressionUsed,
      contentScore: review.metrics.contentScore,
    } : {}),
    completedAt,
  };
  const attempts = (session.recoveryAttempts || []) as NhkRecoveryAttempt[];
  return {
    ...session,
    recoveryAttempts: [...attempts.filter(current => current.recoveryId !== item.recoveryId), attempt]
      .sort((left, right) => left.completedAt - right.completedAt),
  };
};
