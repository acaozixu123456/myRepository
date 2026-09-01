import {
  primaryNhkTrainingSentence,
  type NhkMorningSession,
  type NhkRecallIntervalDay,
} from './nhkMorning';

export const NHK_UNSEEN_RECALL_VERSION = 'nhk-unseen-recall-v1';

export type NhkRecallRegister = 'same-theme' | 'daily' | 'business';

export type NhkRecallScenario = {
  version: 1;
  scenarioId: string;
  intervalDay: NhkRecallIntervalDay;
  register: NhkRecallRegister;
  labelZh: string;
  situationZh: string;
  promptJa: string;
  cueZh: string;
  sampleAnswerJa: string;
  targetExpression: string;
  source: 'pattern-library' | 'stored-transfer';
};

type ScenarioDraft = Omit<NhkRecallScenario, 'version' | 'scenarioId' | 'intervalDay' | 'targetExpression'>;
type ScenarioSet = Record<NhkRecallIntervalDay, ScenarioDraft>;

const clean = (value: unknown, max = 320): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const sentence = (value: string): string => {
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

const restrictionScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '朋友来你家时，问阳台上能不能吸烟。',
    promptJa: 'ベランダでたばこを吸ってもいいですか。',
    cueZh: '不要照着昨天的原句，直接说明这里的规则。',
    sampleAnswerJa: 'このマンションでは、ベランダでたばこを吸ってはいけません。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '你在图书馆提醒朋友遵守馆内规定。',
    promptJa: 'ここで電話しても大丈夫ですか。',
    cueZh: '先回答对方，再用完整句说明不能做什么。',
    sampleAnswerJa: '図書館の中では、電話で話してはいけません。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '新成员准备把生产数据复制到测试环境，你需要立刻说明规则。',
    promptJa: '本番データをそのままテスト環境で使ってもいいですか。',
    cueZh: '像在项目现场一样，简洁但明确地阻止。',
    sampleAnswerJa: 'テスト環境では、本番データをそのまま使ってはいけません。',
    source: 'pattern-library',
  },
};

const unavailableScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '常用的交通卡即将停止支持一项服务。',
    promptJa: '来月から何が変わりますか。',
    cueZh: '用“以后不能……”的结构说明变化。',
    sampleAnswerJa: '来月から、このカードで定期券を買うことができなくなります。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '停车场 App 更新后，旧手机将不再受支持。',
    promptJa: '古いスマートフォンでも、このアプリを使えますか。',
    cueZh: '说明更新后的限制，不要只回答“不能”。',
    sampleAnswerJa: '更新後は、古いスマートフォンでこのアプリを使うことができなくなります。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '会议上需要说明旧接口下个月停止使用。',
    promptJa: '旧APIは、いつまで利用できますか。',
    cueZh: '用完整句说明时间和不能继续使用的结果。',
    sampleAnswerJa: '来月から、旧APIを利用することができなくなります。',
    source: 'pattern-library',
  },
};

const responseScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '看到天气预警后，你改变了周末安排。',
    promptJa: 'どうして予定を変更したんですか。',
    cueZh: '先说明触发原因，再说你采取了什么行动。',
    sampleAnswerJa: '大雨の予報を受けて、週末の予定を変更しました。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '小区收到噪音投诉后，修改了公共空间的使用时间。',
    promptJa: 'どうして利用時間が変わったんですか。',
    cueZh: '把“收到某个情况后”自然地放在句首。',
    sampleAnswerJa: '近所からの苦情を受けて、共用スペースの利用時間が変わりました。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '规格发生变化，你需要在晨会上说明测试案例为什么被调整。',
    promptJa: 'テストケースを見直した理由を教えてください。',
    cueZh: '先说原因，再说已经采取的项目行动。',
    sampleAnswerJa: '仕様変更を受けて、テストケースを見直しました。',
    source: 'pattern-library',
  },
};

const habitScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '你想改善日语口语练习习惯。',
    promptJa: '最近、日本語のために意識していることはありますか。',
    cueZh: '用“尽量做到……”说明自己的新习惯。',
    sampleAnswerJa: '毎日、短くても日本語を声に出すようにしています。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '最近睡眠不足，你开始调整晚上的生活习惯。',
    promptJa: 'よく眠るために、何か気をつけていますか。',
    cueZh: '说出一个现在持续注意的具体行动。',
    sampleAnswerJa: '寝る前は、スマートフォンを見すぎないようにしています。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '为了避免测试遗漏，你向团队说明新的确认习惯。',
    promptJa: '同じ確認漏れを防ぐために、何をしていますか。',
    cueZh: '用工作语气说明团队现在坚持做什么。',
    sampleAnswerJa: '確認漏れが起きないように、テスト前にチェックリストを見るようにしています。',
    source: 'pattern-library',
  },
};

const ruleScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '你向朋友说明公寓垃圾投放规则。',
    promptJa: 'ごみはいつ出せばいいですか。',
    cueZh: '用“规定是……”说明固定安排。',
    sampleAnswerJa: 'このマンションでは、ごみは朝8時までに出すことになっています。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '社区活动要求参加者提前登记。',
    promptJa: '当日、そのまま参加できますか。',
    cueZh: '礼貌说明既定流程，而不是只说“不行”。',
    sampleAnswerJa: '参加する場合は、前日までに登録することになっています。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '新成员问正式发布前需要经过哪些确认。',
    promptJa: '本番リリースの前に、何を確認しますか。',
    cueZh: '用正式工作表达说明团队流程。',
    sampleAnswerJa: '本番リリースの前に、担当者がチェックリストを確認することになっています。',
    source: 'pattern-library',
  },
};

const opinionScenarios: ScenarioSet = {
  1: {
    register: 'same-theme',
    labelZh: '第 1 天 · 同结构回忆',
    situationZh: '朋友问你是否赞成给儿童设置网络使用规则。',
    promptJa: '子どものインターネット利用にルールは必要だと思いますか。',
    cueZh: '先明确立场，再给一个简单原因。',
    sampleAnswerJa: '子どもを守るために、年齢に合ったルールが必要だと考えています。',
    source: 'pattern-library',
  },
  3: {
    register: 'daily',
    labelZh: '第 3 天 · 陌生日常场景',
    situationZh: '邻居讨论是否应限制深夜使用公共空间。',
    promptJa: '夜遅くまで共用スペースを使えるほうがいいと思いますか。',
    cueZh: '自然表达自己的判断，不需要照搬新闻。',
    sampleAnswerJa: '周りの人への影響を考えると、利用時間を決めたほうがいいと考えています。',
    source: 'pattern-library',
  },
  7: {
    register: 'business',
    labelZh: '第 7 天 · 陌生工作场景',
    situationZh: '会议上被问到是否应该增加一次上线前检查。',
    promptJa: 'リリース前の確認をもう一度増やす必要がありますか。',
    cueZh: '用会议语气表达判断，并补充项目原因。',
    sampleAnswerJa: '影響範囲が広いため、リリース前の確認を一回増やす必要があると考えています。',
    source: 'pattern-library',
  },
};

const scenarioSetFor = (expression: string, sourceSentence: string): ScenarioSet | null => {
  const value = `${expression}\n${sourceSentence}`;
  if (/(てはいけない|ではいけない)/.test(value)) return restrictionScenarios;
  if (/(ことができなく|利用できなく|使えなく)/.test(value)) return unavailableScenarios;
  if (/を受けて/.test(value)) return responseScenarios;
  if (/(ようにする|ようにしています|ようにしている)/.test(value)) return habitScenarios;
  if (/(ことになって|決まりになって)/.test(value)) return ruleScenarios;
  if (/(と考えて|必要だと思|必要があると思)/.test(value)) return opinionScenarios;
  return null;
};

const fallbackScenario = (
  intervalDay: NhkRecallIntervalDay,
  dailyVersion: string,
  workVersion: string,
  sourceSentence: string,
): ScenarioDraft => {
  if (intervalDay === 1) {
    return {
      register: 'same-theme',
      labelZh: '第 1 天 · 主动回忆',
      situationZh: '不看昨天的原句，把核心表达换成和自己有关的一句话。',
      promptJa: '昨日の表現を使って、あなた自身の生活について一文話してください。',
      cueZh: '先独立说，再查看参考表达。',
      sampleAnswerJa: sentence(dailyVersion || sourceSentence),
      source: 'stored-transfer',
    };
  }
  if (intervalDay === 3) {
    return {
      register: 'daily',
      labelZh: '第 3 天 · 新日常情景',
      situationZh: '朋友问起最近生活中需要注意的新变化。',
      promptJa: '最近、生活の中で変わったことや気をつけていることはありますか。',
      cueZh: '用目标表达组织完整回答，不提前看参考句。',
      sampleAnswerJa: sentence(dailyVersion || sourceSentence),
      source: 'stored-transfer',
    };
  }
  return {
    register: 'business',
    labelZh: '第 7 天 · 新工作情景',
    situationZh: '会议中需要说明这件事可能对项目产生的影响。',
    promptJa: 'この内容が仕事に与える影響を、会議で短く説明してください。',
    cueZh: '用工作语气主动组织，不照着新闻原句复述。',
    sampleAnswerJa: sentence(workVersion || dailyVersion || sourceSentence),
    source: 'stored-transfer',
  };
};

export const buildNhkRecallScenario = (
  session: NhkMorningSession,
  intervalDay: NhkRecallIntervalDay,
): NhkRecallScenario => {
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  const targetExpression = clean(primary?.expression || session.keyExpression, 160);
  const sourceSentence = clean(primary?.sourceSentence || session.selectedSentences[0] || session.shadowText, 320);
  const scenarios = scenarioSetFor(targetExpression, sourceSentence);
  const draft = scenarios?.[intervalDay] || fallbackScenario(
    intervalDay,
    primary?.dailyVersion || session.dailyVersion,
    primary?.workVersion || session.workVersion,
    sourceSentence,
  );
  return {
    version: 1,
    scenarioId: `${NHK_UNSEEN_RECALL_VERSION}-${session.id}-d${intervalDay}-${stableHash(`${targetExpression}|${sourceSentence}`)}`,
    intervalDay,
    targetExpression,
    ...draft,
    sampleAnswerJa: sentence(draft.sampleAnswerJa),
  };
};
