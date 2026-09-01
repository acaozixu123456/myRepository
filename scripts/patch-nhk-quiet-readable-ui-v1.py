from pathlib import Path
import re


def replace_one(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def regex_one(path: Path, pattern: str, replacement: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(updated, encoding='utf-8')


morning = Path('src/nhkMorning.ts')
replace_one(
    morning,
    "import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';",
    "import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';\nimport type {NhkStudyMode} from './nhkStudyMode';",
    'study mode type import',
)
replace_one(
    morning,
    "  recordingSeconds: number;\n  completedAt: number;\n  review?: NhkSpeechReview;",
    "  recordingSeconds: number;\n  completionMode?: NhkStudyMode;\n  completedAt: number;\n  review?: NhkSpeechReview;",
    'recall completion mode',
)
replace_one(
    morning,
    "  contentScore?: number;\n  completedAt?: number;",
    "  contentScore?: number;\n  responseMode?: NhkStudyMode;\n  completedAt?: number;",
    'callback response mode',
)
replace_one(
    morning,
    "    contentScore?: number;\n    characterReaction?: string;",
    "    contentScore?: number;\n    responseMode?: NhkStudyMode;\n    characterReaction?: string;",
    'world response mode',
)
replace_one(
    morning,
    "  speechReviews: Partial<Record<NhkSpeechMode, NhkSpeechReview>>;\n  completedAt?: number;",
    "  speechReviews: Partial<Record<NhkSpeechMode, NhkSpeechReview>>;\n  completionMode?: NhkStudyMode;\n  completedAt?: number;",
    'session completion mode',
)
replace_one(
    morning,
    "const clean = (value: unknown, max = 400): string => typeof value === 'string'\n  ? value.replace(/\\s+/g, ' ').trim().slice(0, max)\n  : '';",
    "const clean = (value: unknown, max = 400): string => typeof value === 'string'\n  ? value.replace(/\\s+/g, ' ').trim().slice(0, max)\n  : '';\nconst normalizeStudyMode = (value: unknown): NhkStudyMode | undefined =>\n  value === 'voice' || value === 'quiet' ? value : undefined;",
    'study mode normalizer',
)
replace_one(
    morning,
    "            contentScore: review.metrics.contentScore,\n            ...(combinedReaction ? {characterReaction: combinedReaction} : {}),",
    "            contentScore: review.metrics.contentScore,\n            responseMode: 'voice',\n            ...(combinedReaction ? {characterReaction: combinedReaction} : {}),",
    'voice world response mode',
)
marker = "export const applyNhkWorldCallbackReview = (\n"
text = morning.read_text(encoding='utf-8')
if marker not in text:
    raise SystemExit('quiet world insertion marker missing')
quiet_helper = """export const recordNhkQuietWorldAnswer = (
  session: NhkMorningSession,
  answer: string,
  answeredAt = Date.now(),
): NhkMorningSession => {
  const value = clean(answer, 1200);
  const synced = syncNhkDailyInputUserFields({
    ...session,
    worldAnswer: value,
    completionMode: 'quiet',
  });
  if (!synced.dailyInput || !value) return synced;
  return {
    ...synced,
    dailyInput: {
      ...synced.dailyInput,
      world: {
        ...synced.dailyInput.world,
        answer: value,
        usedInWorld: true,
        enteredAt: synced.dailyInput.world.enteredAt || answeredAt,
        answeredAt,
        responseMode: 'quiet',
      },
    },
  };
};

"""
morning.write_text(text.replace(marker, quiet_helper + marker, 1), encoding='utf-8')
replace_one(
    morning,
    "          contentScore: review.metrics.contentScore,\n          review,",
    "          contentScore: review.metrics.contentScore,\n          responseMode: 'voice',\n          review,",
    'voice callback response mode',
)
replace_one(
    morning,
    "  completedAt = Date.now(),\n): NhkMorningSession => {\n  const reviewed = review ? applyNhkWorldCallbackReview(session, review, recordingSeconds) : session;",
    "  completedAt = Date.now(),\n  responseMode: NhkStudyMode = review ? 'voice' : 'quiet',\n): NhkMorningSession => {\n  const reviewed = review ? applyNhkWorldCallbackReview(session, review, recordingSeconds) : session;",
    'callback mode argument',
)
replace_one(
    morning,
    "          answeredAt: reviewed.dailyInput.world.callback.answeredAt || completedAt,\n          completedAt,",
    "          answeredAt: reviewed.dailyInput.world.callback.answeredAt || completedAt,\n          responseMode,\n          completedAt,",
    'callback completion mode write',
)
replace_one(
    morning,
    "    recordingSeconds: session.recall.recordingSeconds,\n    completedAt: session.recall.completedAt,",
    "    recordingSeconds: session.recall.recordingSeconds,\n    completionMode: 'voice',\n    completedAt: session.recall.completedAt,",
    'legacy recall mode',
)
replace_one(
    morning,
    "      recordingSeconds: Number(item.recordingSeconds) || 0,\n      completedAt: item.completedAt,",
    "      recordingSeconds: Number(item.recordingSeconds) || 0,\n      completionMode: normalizeStudyMode(item.completionMode) || (review || Number(item.recordingSeconds) > 0 ? 'voice' : 'quiet'),\n      completedAt: item.completedAt,",
    'normalize recall mode',
)
replace_one(
    morning,
    "    ...(typeof callback.contentScore === 'number' ? {contentScore: callback.contentScore} : {}),\n    ...(typeof callback.completedAt === 'number' ? {completedAt: callback.completedAt} : {}),",
    "    ...(typeof callback.contentScore === 'number' ? {contentScore: callback.contentScore} : {}),\n    ...(normalizeStudyMode(callback.responseMode) ? {responseMode: normalizeStudyMode(callback.responseMode)} : {}),\n    ...(typeof callback.completedAt === 'number' ? {completedAt: callback.completedAt} : {}),",
    'normalize callback mode',
)
replace_one(
    morning,
    "      ...(typeof world?.contentScore === 'number' ? {contentScore: world.contentScore} : {}),\n      ...(clean(world?.characterReaction, 600) ? {characterReaction: clean(world.characterReaction, 600)} : {}),",
    "      ...(typeof world?.contentScore === 'number' ? {contentScore: world.contentScore} : {}),\n      ...(normalizeStudyMode(world?.responseMode) ? {responseMode: normalizeStudyMode(world?.responseMode)} : {}),\n      ...(clean(world?.characterReaction, 600) ? {characterReaction: clean(world.characterReaction, 600)} : {}),",
    'normalize world mode',
)
replace_one(
    morning,
    "    speechFallback: Boolean(session.speechFallback),\n    speechReviews: normalizeSpeechReviews(session.speechReviews),",
    "    speechFallback: Boolean(session.speechFallback),\n    speechReviews: normalizeSpeechReviews(session.speechReviews),\n    completionMode: normalizeStudyMode(session.completionMode),",
    'normalize session mode',
)
replace_one(
    morning,
    "  completedAt = Date.now(),\n  review?: NhkSpeechReview,\n): NhkMorningSession => {",
    "  completedAt = Date.now(),\n  review?: NhkSpeechReview,\n  completionMode: NhkStudyMode = review || recordingSeconds > 0 ? 'voice' : 'quiet',\n): NhkMorningSession => {",
    'recall mode argument',
)
replace_one(
    morning,
    "    recordingSeconds,\n    completedAt,\n    ...(review ? {review} : {}),",
    "    recordingSeconds,\n    completionMode,\n    completedAt,\n    ...(review ? {review} : {}),",
    'recall mode write',
)
replace_one(
    morning,
    "export const isNhkSessionReadyToComplete = (session: NhkMorningSession): boolean => {\n  const recapSpoken = session.recapRecordingSeconds > 0 || session.speechFallback;\n  const worldSpoken = session.worldRecordingSeconds > 0 || session.speechFallback;\n  return Boolean(session.shadowText.trim()\n    && session.recapText.trim()\n    && session.keyExpression.trim()\n    && session.worldAnswer.trim()\n    && recapSpoken\n    && worldSpoken);\n};",
    "export const isNhkSessionReadyToComplete = (\n  session: NhkMorningSession,\n  mode: NhkStudyMode = 'voice',\n): boolean => {\n  const textComplete = Boolean(session.shadowText.trim()\n    && session.recapText.trim()\n    && session.keyExpression.trim()\n    && session.worldAnswer.trim());\n  if (!textComplete) return false;\n  if (mode === 'quiet') return true;\n  const recapSpoken = session.recapRecordingSeconds > 0 || session.speechFallback;\n  const worldSpoken = session.worldRecordingSeconds > 0 || session.speechFallback;\n  return recapSpoken && worldSpoken;\n};",
    'quiet completion gate',
)

page = Path('src/NhkMorningPage.tsx')
replace_one(
    page,
    "import NhkEvidencePage from './NhkEvidencePage';\nimport {buildNhkWeeklyEvidence} from './nhkEvidence';",
    "import NhkEvidencePage from './NhkEvidencePage';\nimport {buildNhkWeeklyEvidence} from './nhkEvidence';\nimport NhkQuietWorld from './NhkQuietWorld';\nimport NhkReviewPage from './NhkReviewPage';\nimport NhkStudyModeToggle from './NhkStudyModeToggle';\nimport {loadNhkStudyMode, saveNhkStudyMode, type NhkStudyMode} from './nhkStudyMode';",
    'quiet UI imports',
)
replace_one(
    page,
    "  recordNhkRecallAttempt,\n  saveNhkSessions,",
    "  recordNhkQuietWorldAnswer,\n  recordNhkRecallAttempt,\n  saveNhkSessions,",
    'quiet world helper import',
)
replace_one(
    page,
    "import './nhkMorning.css';",
    "import './nhkMorning.css';\nimport './nhkReadable.css';",
    'readable CSS import',
)
replace_one(
    page,
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence' | 'boss';",
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence' | 'boss' | 'review';",
    'review page view',
)
replace_one(
    page,
    "  const [view, setView] = useState<PageView>('home');\n  const [step, setStep] = useState(0);",
    "  const [view, setView] = useState<PageView>('home');\n  const [studyMode, setStudyMode] = useState<NhkStudyMode>(() => loadNhkStudyMode());\n  const [step, setStep] = useState(0);",
    'study mode state',
)
replace_one(
    page,
    "  const [recallFallback, setRecallFallback] = useState(false);\n  const [worldSessionId, setWorldSessionId] = useState('');",
    "  const [recallFallback, setRecallFallback] = useState(false);\n  const [quietRecallAnswer, setQuietRecallAnswer] = useState('');\n  const [quietRecallConfirmed, setQuietRecallConfirmed] = useState(false);\n  const [worldSessionId, setWorldSessionId] = useState('');",
    'quiet recall state',
)
replace_one(
    page,
    "  useEffect(() => saveNhkSessions(sessions), [sessions]);\n  useEffect(() => saveNhkBossSessions(bossSessions), [bossSessions]);",
    "  useEffect(() => saveNhkSessions(sessions), [sessions]);\n  useEffect(() => saveNhkBossSessions(bossSessions), [bossSessions]);\n  useEffect(() => saveNhkStudyMode(studyMode), [studyMode]);",
    'study mode persistence',
)
replace_one(
    page,
    "  const openBoss = () => {\n    const next = weeklyBoss || (bossCandidate.eligible ? createNhkBossSession(bossCandidate, sessions) : null);",
    "  const openBoss = () => {\n    if (studyMode === 'quiet') {\n      setView('review');\n      return;\n    }\n    const next = weeklyBoss || (bossCandidate.eligible ? createNhkBossSession(bossCandidate, sessions) : null);",
    'quiet boss route',
)
replace_one(
    page,
    "  const completeToday = () => {\n    const next = syncNhkDailyInputUserFields({...draftRef.current, completedAt: Date.now()});\n    persist(next);\n    setView('home');\n  };",
    "  const completeToday = () => {\n    const completedAt = Date.now();\n    const base = syncNhkDailyInputUserFields({\n      ...draftRef.current,\n      completionMode: studyMode,\n      completedAt,\n    });\n    const next = studyMode === 'quiet'\n      ? recordNhkQuietWorldAnswer(base, base.worldAnswer, completedAt)\n      : base;\n    persist(next);\n    setView('home');\n  };",
    'quiet daily completion',
)
replace_one(
    page,
    "    setRecallReview(undefined);\n    setRecallFallback(false);\n    setView('recall');",
    "    setRecallReview(undefined);\n    setRecallFallback(false);\n    setQuietRecallAnswer('');\n    setQuietRecallConfirmed(false);\n    setView('recall');",
    'quiet recall reset',
)
replace_one(
    page,
    "    const next = recordNhkRecallAttempt(recallSession, recallTarget, todayKey, rating, recallSeconds, Date.now(), recallReview);",
    "    const next = recordNhkRecallAttempt(\n      recallSession,\n      recallTarget,\n      todayKey,\n      rating,\n      studyMode === 'voice' ? recallSeconds : 0,\n      Date.now(),\n      studyMode === 'voice' ? recallReview : undefined,\n      studyMode,\n    );",
    'quiet recall write',
)
replace_one(
    page,
    "  if (view === 'boss' && activeBoss) {",
    "  if (view === 'review') {\n    return (\n      <NhkReviewPage\n        sessions={sessions}\n        todayKey={todayKey}\n        studyMode={studyMode}\n        recallTarget={recallTarget}\n        callbackTarget={worldCallbackTarget}\n        onBack={() => setView('home')}\n        onOpenRecall={openRecall}\n        onOpenCallback={session => openWorldSession(session, 'callback')}\n      />\n    );\n  }\n\n  if (view === 'boss' && activeBoss) {",
    'review render',
)
old_world = """  if (view === 'world' && activeWorldSession?.dailyInput) {
    return (
      <NhkWorldEvent
        session={activeWorldSession}
        mode={worldMode}
        worldTitle={worldStory?.series?.seasonTitle}
        onBack={closeWorldSession}
        onUpdate={persistWorldSession}
        onContinueStory={() => {
          closeWorldSession();
          onEnterWorld();
        }}
      />
    );
  }
"""
new_world = """  if (view === 'world' && activeWorldSession?.dailyInput) {
    const worldProps = {
      session: activeWorldSession,
      mode: worldMode,
      worldTitle: worldStory?.series?.seasonTitle,
      onBack: closeWorldSession,
      onUpdate: persistWorldSession,
      onContinueStory: () => {
        closeWorldSession();
        onEnterWorld();
      },
    };
    return studyMode === 'quiet'
      ? <NhkQuietWorld {...worldProps} />
      : <NhkWorldEvent {...worldProps} />;
  }
"""
replace_one(page, old_world, new_world, 'quiet world render')
recall_pattern = r"  if \(view === 'recall' && recallSession && recallTarget\) \{[\s\S]*?\n  \}\n\n  if \(view === 'today'\) \{"
recall_replacement = """  if (view === 'recall' && recallSession && recallTarget) {
    const recallReady = studyMode === 'voice'
      ? Boolean(recallSeconds || recallReview || recallFallback)
      : Boolean(quietRecallAnswer.trim() || quietRecallConfirmed);
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={20} /></button>
          <div><small>第{recallTarget.intervalDay}天 · {recallRegisterLabel(recallTarget)}</small><strong>先回忆，再看参考</strong></div>
          <span />
        </header>
        <NhkStudyModeToggle compact mode={studyMode} onChange={setStudyMode} />
        <div className={`nhk-recall-stage nhk-recall-${recallTarget.scenarioKind}`}>
          <small>{formatDate(recallSession.dateKey)} · {recallSession.title || 'NHK日语听力'}</small>
          <div className="nhk-recall-task">
            <span>{recallRegisterLabel(recallTarget)}</span>
            <h1>{recallTarget.titleZh}</h1>
            <p>{recallTarget.promptZh}</p>
            <blockquote>{recallTarget.promptJa}</blockquote>
          </div>
          {studyMode === 'voice' ? (
            <NhkRecordingCoach
              label={recallRecorderLabel(recallTarget)}
              mode="recall"
              referenceText={recallTarget.referenceJa || recallSession.keyExpression}
              summary={recallSession.dailyInput?.coach.summaryJa || recallSession.title}
              question={recallTarget.promptJa}
              targetExpression={recallSession.keyExpression}
              review={recallReview}
              onDuration={setRecallSeconds}
              onReview={setRecallReview}
              onUnavailable={() => setRecallFallback(true)}
            />
          ) : (
            <div className="nhk-quiet-recall">
              <label>
                在心里回答，或写下几个关键词
                <textarea
                  value={quietRecallAnswer}
                  onChange={event => setQuietRecallAnswer(event.target.value)}
                  rows={4}
                  placeholder="可选：写下你想到的日语"
                />
              </label>
              <button
                className={`nhk-quiet-confirm ${quietRecallConfirmed ? 'active' : ''}`}
                onClick={() => setQuietRecallConfirmed(value => !value)}
              >
                {quietRecallConfirmed ? '已在心里回答' : '不打字，我已经在心里回答了'}
              </button>
            </div>
          )}
          {!recallRevealed ? (
            <button
              className="nhk-secondary-action"
              disabled={!recallReady}
              onClick={() => setRecallRevealed(true)}
            >
              查看参考表达
            </button>
          ) : (
            <div className="nhk-recall-answer">
              <small>{recallTarget.revealLabelZh}</small>
              <strong>{recallTarget.referenceJa}</strong>
              {recallTarget.referenceJa !== recallSession.keyExpression && (
                <p><b>核心表达：</b>{recallSession.keyExpression}</p>
              )}
              <div className="nhk-rating">
                <button onClick={() => finishRecall('miss')}>没想起</button>
                <button onClick={() => finishRecall('close')}>差一点</button>
                <button onClick={() => finishRecall('good')}>想起来了</button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (view === 'today') {"""
regex_one(page, recall_pattern, recall_replacement, 'quiet recall UI')
replace_one(
    page,
    "        </header>\n        <div className=\"nhk-step-dots three\">",
    "        </header>\n        <NhkStudyModeToggle compact mode={studyMode} onChange={setStudyMode} />\n        <div className=\"nhk-step-dots three\">",
    'today mode toggle',
)
shadow_recorder = """                <NhkRecordingCoach
                  label="跟读后再说一次"
                  mode="shadow"
                  referenceText={primaryRecommendation.sentence}
                  summary={coach?.summaryJa || ''}
                  targetExpression={primaryRecommendation.expression}
                  review={draft.speechReviews.shadow}
                  onDuration={seconds => patch({shadowRecordingSeconds: seconds})}
                  onReview={saveSpeechReview}
                  onUnavailable={() => patch({speechFallback: true})}
                />"""
shadow_quiet = """                {studyMode === 'voice' ? (
                  <NhkRecordingCoach
                    label="跟读后再说一次"
                    mode="shadow"
                    referenceText={primaryRecommendation.sentence}
                    summary={coach?.summaryJa || ''}
                    targetExpression={primaryRecommendation.expression}
                    review={draft.speechReviews.shadow}
                    onDuration={seconds => patch({shadowRecordingSeconds: seconds})}
                    onReview={saveSpeechReview}
                    onUnavailable={() => patch({speechFallback: true})}
                  />
                ) : (
                  <div className="nhk-quiet-guide">
                    <Headphones size={20} />
                    <div><strong>默读或戴耳机听</strong><p>按切分在心里跟一遍，不需要打开麦克风。之后用日语写下你记住的内容。</p></div>
                  </div>
                )}"""
replace_one(page, shadow_recorder, shadow_quiet, 'quiet shadow UI')
recap_recorder = """            <NhkRecordingCoach
              label="20～40秒脱稿复述"
              mode="recap"
              referenceText={draft.shadowText || primaryRecommendation?.sentence || draft.keyExpression}
              summary={coach?.summaryJa || ''}
              targetExpression={draft.keyExpression}
              review={draft.speechReviews.recap}
              onDuration={seconds => patch({recapRecordingSeconds: seconds})}
              onReview={saveSpeechReview}
              onUnavailable={() => patch({speechFallback: true})}
            />"""
recap_quiet = """            {studyMode === 'voice' ? (
              <NhkRecordingCoach
                label="20～40秒脱稿复述"
                mode="recap"
                referenceText={draft.shadowText || primaryRecommendation?.sentence || draft.keyExpression}
                summary={coach?.summaryJa || ''}
                targetExpression={draft.keyExpression}
                review={draft.speechReviews.recap}
                onDuration={seconds => patch({recapRecordingSeconds: seconds})}
                onReview={saveSpeechReview}
                onUnavailable={() => patch({speechFallback: true})}
              />
            ) : (
              <div className="nhk-quiet-guide">
                <Headphones size={20} />
                <div><strong>现在改成书面复述</strong><p>先关掉原文，在心里组织一次，再写下一到三句。系统不会把它计入口语成绩。</p></div>
              </div>
            )}"""
replace_one(page, recap_recorder, recap_quiet, 'quiet recap UI')
replace_one(
    page,
    "            <label>系统转写（可修正）<textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder=\"录音分析后自动填写；不能录音时可手动输入\" rows={5} /></label>",
    "            <label>{studyMode === 'voice' ? '系统转写（可修正）' : '用日语写下你的脱稿复述'}<textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder={studyMode === 'voice' ? '录音分析后自动填写；也可以手动修正' : '不要照抄原文，写下你真正记住的内容'} rows={5} /></label>",
    'recap label',
)
replace_one(
    page,
    "<button disabled={!draft.recapText.trim() || (!draft.recapRecordingSeconds && !draft.speechFallback)} onClick={() => setStep(2)}>用进世界</button>",
    "<button disabled={!draft.recapText.trim() || (studyMode === 'voice' && !draft.recapRecordingSeconds && !draft.speechFallback)} onClick={() => setStep(2)}>用进世界</button>",
    'quiet recap next gate',
)
world_recorder = """            <NhkRecordingCoach
              label="用日语回答田中"
              mode="world"
              referenceText={coach?.worldPromptJa || 'このニュースについて、どう思いますか。'}
              summary={coach?.summaryJa || ''}
              question={coach?.worldPromptJa || ''}
              targetExpression={draft.keyExpression}
              review={draft.speechReviews.world}
              onDuration={seconds => patch({worldRecordingSeconds: seconds})}
              onReview={saveSpeechReview}
              onUnavailable={() => patch({speechFallback: true})}
            />"""
world_quiet = """            {studyMode === 'voice' ? (
              <NhkRecordingCoach
                label="用日语回答田中"
                mode="world"
                referenceText={coach?.worldPromptJa || 'このニュースについて、どう思いますか。'}
                summary={coach?.summaryJa || ''}
                question={coach?.worldPromptJa || ''}
                targetExpression={draft.keyExpression}
                review={draft.speechReviews.world}
                onDuration={seconds => patch({worldRecordingSeconds: seconds})}
                onReview={saveSpeechReview}
                onUnavailable={() => patch({speechFallback: true})}
              />
            ) : (
              <div className="nhk-quiet-guide">
                <Headphones size={20} />
                <div><strong>安静回答也会进入连续世界</strong><p>写下你的日语回答。田中会记住内容，但本次不会产生口语分数。</p></div>
              </div>
            )}"""
replace_one(page, world_recorder, world_quiet, 'quiet world answer UI')
replace_one(
    page,
    "            <label>系统转写（可修正）<textarea value={draft.worldAnswer} onChange={event => patch({worldAnswer: event.target.value})} placeholder=\"录音分析后自动填写；不能录音时可手动输入\" rows={4} /></label>",
    "            <label>{studyMode === 'voice' ? '系统转写（可修正）' : '用日语回答田中'}<textarea value={draft.worldAnswer} onChange={event => patch({worldAnswer: event.target.value})} placeholder={studyMode === 'voice' ? '录音分析后自动填写；也可以手动修正' : '写一到三句，尽量用上今天的表达'} rows={4} /></label>",
    'world answer label',
)
replace_one(
    page,
    "disabled={!isNhkSessionReadyToComplete(draft)}",
    "disabled={!isNhkSessionReadyToComplete(draft, studyMode)}",
    'quiet complete gate',
)
home_marker = """  return (
    <section className="nhk-page">
      <header className="nhk-home-header">"""
text = page.read_text(encoding='utf-8')
start = text.rfind(home_marker)
if start < 0:
    raise SystemExit('home return marker not found')
home = """  return (
    <section className="nhk-page nhk-home">
      <header className="nhk-home-header">
        <div><small>NHK → MY WORLD</small><h1>今朝の日本語</h1></div>
        <span>{streak ? `${streak}天` : '今天开始'}</span>
      </header>

      <NhkStudyModeToggle mode={studyMode} onChange={setStudyMode} />

      <button className={`nhk-main-card ${todaySession?.completedAt ? 'done' : ''}`} onClick={openToday}>
        <div className="nhk-main-icon">{todaySession?.completedAt ? <Check size={24} /> : <Headphones size={25} />}</div>
        <div>
          <small>{todaySession?.completedAt ? 'TODAY COMPLETE' : studyMode === 'quiet' ? 'QUIET STUDY' : '8 MINUTES AFTER NHK'}</small>
          <strong>{todaySession?.completedAt ? (todaySession.title || '今天的 NHK 已转化') : studyMode === 'quiet' ? '不方便开口，也能完成今天的学习' : '把刚听过的日语，变成你能说的日语'}</strong>
          <span>{todaySession?.completedAt ? todaySession.keyExpression : studyMode === 'quiet' ? '默读 · 书面复述 · 安静进入世界' : '分享文章 · 自动推荐 · 脱稿表达'}</span>
        </div>
        <ChevronRight size={20} />
      </button>

      {(recallTarget || worldCallbackTarget) && (
        <button className="nhk-home-focus" onClick={() => setView('review')}>
          <RotateCcw size={21} />
          <div>
            <small>现在最值得做</small>
            <strong>{worldCallbackTarget ? '田中又提起了前几天的话题' : `${recallTarget?.titleZh || '到期复习'}`}</strong>
            <span>{studyMode === 'quiet' ? '可以在心里回答或写下关键词' : '先回忆，再决定是否录音'}</span>
          </div>
          <ChevronRight size={19} />
        </button>
      )}

      <div className="nhk-home-tools">
        <button className="nhk-home-tool" onClick={() => setView('review')}>
          <RotateCcw size={22} />
          <div><small>REVIEW</small><strong>随时复习</strong><span>{recent.length ? `${recent.length} 条最近内容` : '回看核心表达'}</span></div>
        </button>
        <button className="nhk-home-tool" onClick={() => setView('evidence')}>
          <TrendingUp size={22} />
          <div><small>THIS WEEK</small><strong>本周进步</strong><span>{evidence.completedInputs} 篇输入 · {evidence.analyzedResponses} 次口语分析</span></div>
        </button>
        <button
          className={`nhk-home-tool ${bossCandidate.eligible || weeklyBoss ? 'highlight' : ''}`}
          disabled={studyMode === 'voice' && !weeklyBoss && !bossCandidate.eligible}
          onClick={openBoss}
        >
          <Trophy size={22} />
          <div>
            <small>{studyMode === 'quiet' ? 'WEEKLY EXPRESSIONS' : 'WEEKLY BOSS'}</small>
            <strong>{studyMode === 'quiet' ? '本周表达' : weeklyBoss ? `继续 ${bossProgress}/5` : bossCandidate.eligible ? '开始五轮对话' : '收集 5 个表达'}</strong>
            <span>{studyMode === 'quiet' ? '安静预习，不计口语成绩' : bossCandidate.eligible ? '日常 · 礼貌 · 工作' : `${bossCandidate.expressions.length}/${bossCandidate.requiredExpressionCount}`}</span>
          </div>
        </button>
        <button className="nhk-home-tool" onClick={() => setShowShareHelp(value => !value)}>
          <Share2 size={22} />
          <div><small>IMPORT</small><strong>从 MOJi 导入</strong><span>分享菜单或粘贴链接</span></div>
        </button>
      </div>

      {showShareHelp && (
        <div className="nhk-share-help">
          <div><Smartphone size={20} /><strong>{isIOS ? 'iPhone 设置一次即可' : '安装后即可直接分享'}</strong></div>
          {isIOS ? (
            <>
              <p>iPhone Safari 需要用快捷指令桥接。之后在 MOJi 分享菜单里点「日语世界」即可。</p>
              <ol>
                <li>新建快捷指令，开启“在共享表单中显示”，接收 URL。</li>
                <li>添加“URL”动作：粘贴接收地址，并在末尾插入“快捷指令输入”。</li>
                <li>添加“打开 URL”，命名为「日语世界」。</li>
              </ol>
              <div className="nhk-share-help-actions">
                <a href="shortcuts://create-shortcut">打开快捷指令</a>
                <button onClick={copyShortcutBase}><Copy size={14} />复制接收地址</button>
              </div>
              {shareCopyStatus && <small>{shareCopyStatus}</small>}
            </>
          ) : (
            <p>把本页安装到主屏幕后，支持 Web Share Target 的浏览器会在系统分享菜单中显示「日语世界」。</p>
          )}
        </div>
      )}

      {todaySession?.completedAt && (
        <button className="nhk-home-world-link" onClick={() => openWorldSession(todaySession, 'event')}>
          <Sparkles size={21} />
          <div><small>{studyMode === 'quiet' ? '安静进入世界' : todaySession.dailyInput?.world.usedInWorld ? '今天的事件' : '让这件事发生'}</small><strong>{todaySession.dailyInput?.world.setupZh || todaySession.workVersion || todaySession.keyExpression}</strong></div>
          <ChevronRight size={19} />
        </button>
      )}

      {recent.length > 0 && (
        <div className="nhk-home-recent">
          <header><strong>最近学过</strong><button onClick={() => setView('review')}>查看全部</button></header>
          {recent.slice(0, 3).map(session => (
            <div key={session.id}><span>{formatDate(session.dateKey)}</span><strong>{session.title || session.keyExpression}</strong><b>{session.completionMode === 'quiet' ? '安静' : `${session.recapRecordingSeconds || 0}s`}</b></div>
          ))}
        </div>
      )}
    </section>
  );
}
"""
page.write_text(text[:start] + home, encoding='utf-8')

# Replace the provisional test with tests built from the existing public builders.
test = Path('src/nhkStudyMode.test.ts')
test.write_text("""import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  buildNhkRecallSchedule,
  completeNhkWorldCallback,
  createNhkSession,
  isNhkSessionReadyToComplete,
  recordNhkQuietWorldAnswer,
  recordNhkRecallAttempt,
} from './nhkMorning';
import {loadNhkStudyMode, saveNhkStudyMode} from './nhkStudyMode';

const sentences = [
  '仕様変更を受けて、確認方法を見直します。',
  '来月から新しい手順を使うことになりました。',
];

const completeInputSession = () => {
  const base = {
    ...createNhkSession('2026-09-02'),
    sourceUrl: 'https://www.mojidict.com/article/quiet-world',
    title: '仕様変更',
  };
  const coach = buildFallbackCoach(base.title, sentences);
  return applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: [sentences[0]],
    candidateSentences: sentences,
  }));
};

describe('NHK quiet study mode', () => {
  it('persists the learner preference and falls back to voice for invalid values', () => {
    let value: string | null = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
    };
    expect(loadNhkStudyMode(storage)).toBe('voice');
    saveNhkStudyMode('quiet', storage);
    expect(loadNhkStudyMode(storage)).toBe('quiet');
    value = 'unknown';
    expect(loadNhkStudyMode(storage)).toBe('voice');
  });

  it('allows a complete written learning loop without pretending speech happened', () => {
    const session = {
      ...completeInputSession(),
      recapText: '仕様変更について説明しました。',
      worldAnswer: '変更を受けて、影響を確認したほうがいいと思います。',
    };
    expect(isNhkSessionReadyToComplete(session, 'voice')).toBe(false);
    expect(isNhkSessionReadyToComplete(session, 'quiet')).toBe(true);
  });

  it('stores a quiet world answer without creating a speech review', () => {
    const base = {...completeInputSession(), worldAnswer: '変更を受けて、先に影響を確認します。'};
    const next = recordNhkQuietWorldAnswer(base, base.worldAnswer, 100);
    expect(next.completionMode).toBe('quiet');
    expect(next.dailyInput?.world).toMatchObject({
      answer: base.worldAnswer,
      usedInWorld: true,
      enteredAt: 100,
      answeredAt: 100,
      responseMode: 'quiet',
    });
    expect(next.speechReviews.world).toBeUndefined();
  });

  it('records quiet recall and callback completion with zero recording seconds', () => {
    const plan = buildNhkRecallSchedule('2026-09-02', {
      sourceSentence: sentences[0],
      expression: '〜を受けて',
      dailyVersion: '変更を受けて、予定を見直します。',
      workVersion: '仕様変更を受けて、影響を確認します。',
    })[1];
    const recalled = recordNhkRecallAttempt(
      completeInputSession(),
      plan,
      '2026-09-05',
      'good',
      0,
      20,
      undefined,
      'quiet',
    );
    expect(recalled.recallAttempts[0]).toMatchObject({completionMode: 'quiet', recordingSeconds: 0});

    const withAnswer = recordNhkQuietWorldAnswer(completeInputSession(), '賛成です。', 10);
    const callback = completeNhkWorldCallback(withAnswer, '今も賛成です。', 0, undefined, 30, 'quiet');
    expect(callback.dailyInput?.world.callback).toMatchObject({
      answer: '今も賛成です。',
      recordingSeconds: 0,
      completedAt: 30,
      responseMode: 'quiet',
    });
  });
});
""", encoding='utf-8')
