import {type ClipboardEvent, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Headphones,
  Link2,
  LoaderCircle,
  RotateCcw,
  Share2,
  Smartphone,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {api} from './api';
import type {Story} from './content';
import NhkBossPage from './NhkBossPage';
import {
  buildNhkBossCandidate,
  createNhkBossSession,
  findNhkBossSession,
  loadNhkBossSessions,
  saveNhkBossSessions,
  upsertNhkBossSession,
  type NhkBossSession,
} from './nhkBoss';
import NhkEvidencePage from './NhkEvidencePage';
import {buildNhkWeeklyEvidence} from './nhkEvidence';
import NhkWorldEvent, {type NhkWorldEventMode} from './NhkWorldEvent';
import {
  NhkRecordingCoach,
  NhkSentencePlayer,
  type NhkSpeechReview,
} from './NhkSpeechCoach';
import {
  buildFallbackCoach,
  isNhkCoachResult,
  pickCoachRecommendation,
  type NhkCoachRecommendation,
  type NhkCoachResult,
} from './nhkCoach';
import {
  applyNhkDailyInput,
  applyNhkSpeechReview,
  buildNhkDailyInput,
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  markNhkDailyInputUsedInWorld,
  NhkMorningSession,
  NhkRecallRating,
  type NhkRecallPlan,
  pickNhkWorldCallbackTarget,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  syncNhkDailyInputUserFields,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';
import {
  clearCapturedSharedMojiUrl,
  readCapturedSharedMojiUrl,
} from './shareTarget';
import './nhkMorning.css';

type ArticleParseStatus = 'idle' | 'loading' | 'ready' | 'error';
type CoachStatus = 'idle' | 'loading' | 'ready' | 'fallback';

type MojiArticleResponse = {
  ok?: boolean;
  sourceUrl?: string;
  title?: string;
  sentences?: string[];
  reason?: string;
};

type NhkCoachResponse = {
  ok?: boolean;
  coach?: unknown;
  model?: string;
  cached?: boolean;
  reason?: string;
};

const sessionSentences = (session: NhkMorningSession): string[] => {
  if (session.selectedSentences?.length) return session.selectedSentences.slice(0, 3);
  return session.shadowText.split(/\n+/).map(value => value.trim()).filter(Boolean).slice(0, 3);
};

const formatDate = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

const recallRegisterLabel = (plan: NhkRecallPlan): string => {
  if (plan.register === 'work') return '工作场景';
  if (plan.register === 'daily') return '日常场景';
  return '核心重建';
};

const recallRecorderLabel = (plan: NhkRecallPlan): string => {
  if (plan.scenarioKind === 'work-transfer') return '两句工作表达';
  if (plan.scenarioKind === 'daily-transfer') return '日常口语回答';
  return '30秒重建核心';
};

const resetSessionForSource = (session: NhkMorningSession, sourceUrl: string): NhkMorningSession => ({
  ...session,
  sourceUrl,
  title: '',
  shadowText: '',
  selectedSentences: [],
  dailyInput: undefined,
  recapText: '',
  keyExpression: '',
  dailyVersion: '',
  workVersion: '',
  opinion: '',
  worldAnswer: '',
  shadowRecordingSeconds: 0,
  recapRecordingSeconds: 0,
  worldRecordingSeconds: 0,
  speechFallback: false,
  speechReviews: {},
  recallAttempts: [],
  recall: undefined,
  completedAt: undefined,
});

type NhkMorningPageProps = {
  worldStory: Story | null;
  onEnterWorld: () => void;
};

type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence' | 'boss';

export default function NhkMorningPage({worldStory, onEnterWorld}: NhkMorningPageProps) {
  const todayKey = toDateKey();
  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());
  const [bossSessions, setBossSessions] = useState<NhkBossSession[]>(() => loadNhkBossSessions());
  const [activeBossId, setActiveBossId] = useState('');
  const [draft, setDraft] = useState<NhkMorningSession>(() => findTodayNhkSession(loadNhkSessions(), todayKey) || createNhkSession(todayKey));
  const initialSentences = sessionSentences(draft);
  const initialInput = draft.dailyInput;
  const initialCandidates = initialInput?.candidateSentences?.length ? initialInput.candidateSentences : initialSentences;
  const [view, setView] = useState<PageView>('home');
  const [step, setStep] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [recallSeconds, setRecallSeconds] = useState(0);
  const [recallReview, setRecallReview] = useState<NhkSpeechReview | undefined>();
  const [recallFallback, setRecallFallback] = useState(false);
  const [worldSessionId, setWorldSessionId] = useState('');
  const [worldMode, setWorldMode] = useState<NhkWorldEventMode>('event');
  const [articleSentences, setArticleSentences] = useState<string[]>(initialCandidates);
  const [selectedSentences, setSelectedSentences] = useState<string[]>(initialSentences);
  const [parseStatus, setParseStatus] = useState<ArticleParseStatus>(initialCandidates.length ? 'ready' : 'idle');
  const [parseError, setParseError] = useState('');
  const [coach, setCoach] = useState<NhkCoachResult | null>(initialInput?.coach || null);
  const [coachStatus, setCoachStatus] = useState<CoachStatus>(initialInput ? 'ready' : 'idle');
  const [coachModel, setCoachModel] = useState(initialInput?.coachModel || '');
  const [showShareHelp, setShowShareHelp] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState('');
  const draftRef = useRef(draft);
  const selectedRef = useRef(selectedSentences);
  const parseRequestRef = useRef(0);
  const coachRequestRef = useRef(0);
  const selectionTouchedRef = useRef(false);
  const sharedHandledRef = useRef('');

  useEffect(() => saveNhkSessions(sessions), [sessions]);
  useEffect(() => saveNhkBossSessions(bossSessions), [bossSessions]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { selectedRef.current = selectedSentences; }, [selectedSentences]);

  const todaySession = useMemo(() => findTodayNhkSession(sessions, todayKey), [sessions, todayKey]);
  const recallTarget = useMemo(() => pickRecallTarget(sessions, todayKey), [sessions, todayKey]);
  const recallSession = recallTarget?.session || null;
  const worldCallbackTarget = useMemo(() => pickNhkWorldCallbackTarget(sessions, todayKey), [sessions, todayKey]);
  const activeWorldSession = useMemo(() => sessions.find(session => session.id === worldSessionId) || null, [sessions, worldSessionId]);
  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);
  const evidence = useMemo(() => buildNhkWeeklyEvidence(sessions, todayKey), [sessions, todayKey]);
  const bossCandidate = useMemo(() => buildNhkBossCandidate(sessions, todayKey), [sessions, todayKey]);
  const weeklyBoss = useMemo(
    () => findNhkBossSession(bossSessions, bossCandidate.weekKey),
    [bossSessions, bossCandidate.weekKey],
  );
  const activeBoss = useMemo(
    () => bossSessions.find(session => session.id === activeBossId) || null,
    [bossSessions, activeBossId],
  );
  const bossProgress = weeklyBoss?.turns.filter(turn => turn.completedAt).length || 0;
  const recent = useMemo(() => sessions.filter(session => session.completedAt).slice(0, 3), [sessions]);
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);

  const persist = (next: NhkMorningSession) => {
    draftRef.current = next;
    setDraft(next);
    setSessions(current => upsertNhkSession(current, next));
  };

  const persistBossSession = (next: NhkBossSession) => {
    setBossSessions(current => upsertNhkBossSession(current, next));
  };

  const openBoss = () => {
    const next = weeklyBoss || (bossCandidate.eligible ? createNhkBossSession(bossCandidate, sessions) : null);
    if (!next) return;
    persistBossSession(next);
    setActiveBossId(next.id);
    setView('boss');
  };

  const closeBoss = () => {
    setActiveBossId('');
    setView('home');
  };

  const persistWorldSession = (next: NhkMorningSession) => {
    if (draftRef.current.id === next.id) {
      draftRef.current = next;
      setDraft(next);
    }
    setSessions(current => upsertNhkSession(current, next));
  };

  const openWorldSession = (session: NhkMorningSession, mode: NhkWorldEventMode) => {
    const next = mode === 'event' ? markNhkDailyInputUsedInWorld(session) : session;
    persistWorldSession(next);
    setWorldSessionId(next.id);
    setWorldMode(mode);
    setView('world');
  };

  const closeWorldSession = () => {
    setWorldSessionId('');
    setView('home');
  };

  const patch = (values: Partial<NhkMorningSession>) =>
    persist(syncNhkDailyInputUserFields({...draftRef.current, ...values}));

  const saveSpeechReview = (review: NhkSpeechReview) =>
    persist(applyNhkSpeechReview(draftRef.current, review));

  const recommendationFor = (sentence: string): NhkCoachRecommendation | undefined =>
    coach?.recommendations.find(item => item.sentence === sentence);

  const primaryRecommendation = useMemo(
    () => pickCoachRecommendation(coach, selectedSentences, articleSentences),
    [coach, selectedSentences, articleSentences],
  );

  const applyCoachFields = (
    session: NhkMorningSession,
    result: NhkCoachResult | null,
    selected: string[],
    candidates: string[] = articleSentences,
    model = coachModel,
  ): NhkMorningSession => {
    if (!selected.length) {
      return {...session, selectedSentences: [], shadowText: '', dailyInput: undefined, keyExpression: '', dailyVersion: '', workVersion: ''};
    }
    const resolvedCoach = result || buildFallbackCoach(session.title || 'NHK日语听力', candidates.length ? candidates : selected);
    return applyNhkDailyInput(session, buildNhkDailyInput({
      session,
      coach: resolvedCoach,
      selectedSentences: selected,
      candidateSentences: candidates.length ? candidates : selected,
      coachModel: model || 'local-fallback',
    }));
  };

  const loadCoach = async (
    title: string,
    sentences: string[],
    baseSession: NhkMorningSession,
    autoSelect: boolean,
  ) => {
    const request = ++coachRequestRef.current;
    const fallback = buildFallbackCoach(title, sentences);
    setCoach(fallback);
    setCoachModel('local-fallback');
    setCoachStatus('loading');

    if (autoSelect && !selectionTouchedRef.current) {
      const recommended = fallback.recommendations.map(item => item.sentence).slice(0, 3);
      selectedRef.current = recommended;
      setSelectedSentences(recommended);
      persist(applyCoachFields(baseSession, fallback, recommended, sentences, 'local-fallback'));
    }

    try {
      const {data} = await api.post<NhkCoachResponse>('/api/nhk-coach', {title, sentences});
      if (request !== coachRequestRef.current) return;
      if (!data?.ok || !isNhkCoachResult(data.coach)) throw new Error(data?.reason || 'coach_failed');
      const generated = data.coach;
      const generatedModel = data.model || 'openai-coach';
      setCoach(generated);
      setCoachModel(generatedModel);
      setCoachStatus('ready');

      if (draftRef.current.sourceUrl === baseSession.sourceUrl) {
        const recommended = generated.recommendations.map(item => item.sentence).slice(0, 3);
        const nextSelected = autoSelect && !selectionTouchedRef.current ? recommended : selectedRef.current;
        if (autoSelect && !selectionTouchedRef.current) {
          selectedRef.current = recommended;
          setSelectedSentences(recommended);
        }
        if (nextSelected.length) persist(applyCoachFields(draftRef.current, generated, nextSelected, sentences, generatedModel));
      }
    } catch {
      if (request !== coachRequestRef.current) return;
      setCoach(fallback);
      setCoachModel('local-fallback');
      setCoachStatus('fallback');
      if (selectedRef.current.length && draftRef.current.sourceUrl === baseSession.sourceUrl) {
        persist(applyCoachFields(draftRef.current, fallback, selectedRef.current, sentences, 'local-fallback'));
      }
    }
  };

  const openToday = () => {
    const next = todaySession || createNhkSession(todayKey);
    const selected = sessionSentences(next);
    const storedInput = next.dailyInput;
    const candidates = storedInput?.candidateSentences?.length ? storedInput.candidateSentences : selected;
    draftRef.current = next;
    selectedRef.current = selected;
    selectionTouchedRef.current = Boolean(selected.length);
    setDraft(next);
    setSelectedSentences(selected);
    setArticleSentences(candidates);
    setParseStatus(candidates.length ? 'ready' : 'idle');
    setParseError('');
    setCoach(storedInput?.coach || null);
    setCoachModel(storedInput?.coachModel || '');
    setCoachStatus(storedInput ? 'ready' : 'idle');
    setStep(0);
    setShowOriginal(false);
    setView('today');
    if (!storedInput && next.title && selected.length) void loadCoach(next.title, selected, next, false);
  };

  const changeSourceUrl = (sourceUrl: string) => {
    parseRequestRef.current += 1;
    coachRequestRef.current += 1;
    selectionTouchedRef.current = false;
    const next = resetSessionForSource(draftRef.current, sourceUrl);
    draftRef.current = next;
    selectedRef.current = [];
    setDraft(next);
    setArticleSentences([]);
    setSelectedSentences([]);
    setParseStatus('idle');
    setParseError('');
    setCoach(null);
    setCoachModel('');
    setCoachStatus('idle');
  };

  const parseArticle = async (inputUrl = draftRef.current.sourceUrl, baseSession = draftRef.current) => {
    const sourceUrl = inputUrl.trim();
    if (!sourceUrl) {
      setParseStatus('error');
      setParseError('先粘贴 MOJi 文章链接。');
      return;
    }

    const request = ++parseRequestRef.current;
    coachRequestRef.current += 1;
    selectionTouchedRef.current = false;
    const cleanSession = resetSessionForSource(baseSession, sourceUrl);
    draftRef.current = cleanSession;
    selectedRef.current = [];
    setDraft(cleanSession);
    setArticleSentences([]);
    setSelectedSentences([]);
    setCoach(null);
    setCoachModel('');
    setCoachStatus('idle');
    setParseStatus('loading');
    setParseError('');

    try {
      const {data} = await api.post<MojiArticleResponse>('/api/moji-article', {url: sourceUrl});
      if (request !== parseRequestRef.current) return;
      if (!data?.ok || !data.title || !Array.isArray(data.sentences) || !data.sentences.length) {
        throw new Error(data?.reason || 'parse_failed');
      }
      const next = {
        ...cleanSession,
        sourceUrl: data.sourceUrl || sourceUrl,
        title: data.title,
      };
      persist(next);
      setArticleSentences(data.sentences);
      setParseStatus('ready');
      void loadCoach(data.title, data.sentences, next, true);
    } catch {
      if (request !== parseRequestRef.current) return;
      setParseStatus('error');
      setParseError('没有解析出正文。请确认这是 MOJi 的 NHK 文章链接，再重试。');
    }
  };

  const pasteAndParse = (event: ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData('text').trim();
    if (!value) return;
    event.preventDefault();
    const next = resetSessionForSource(draftRef.current, value);
    void parseArticle(value, next);
  };

  const toggleSentence = (sentence: string) => {
    const selected = selectedRef.current.includes(sentence);
    if (!selected && selectedRef.current.length >= 3) return;
    selectionTouchedRef.current = true;
    const nextSelected = selected
      ? selectedRef.current.filter(value => value !== sentence)
      : [...selectedRef.current, sentence];
    selectedRef.current = nextSelected;
    setSelectedSentences(nextSelected);
    const resetOutput: NhkMorningSession = {
      ...draftRef.current,
      recapText: '',
      opinion: '',
      worldAnswer: '',
      shadowRecordingSeconds: 0,
      recapRecordingSeconds: 0,
      worldRecordingSeconds: 0,
      speechFallback: false,
      speechReviews: {},
      recallAttempts: [],
      completedAt: undefined,
    };
    persist(applyCoachFields(resetOutput, coach, nextSelected, articleSentences, coachModel));
  };

  const nextFromInput = () => {
    const next = applyCoachFields(draftRef.current, coach, selectedRef.current, articleSentences, coachModel);
    persist(next);
    setStep(1);
  };

  const completeToday = () => {
    const next = syncNhkDailyInputUserFields({...draftRef.current, completedAt: Date.now()});
    persist(next);
    setView('home');
  };

  const openRecall = () => {
    setRecallRevealed(false);
    setRecallSeconds(0);
    setRecallReview(undefined);
    setRecallFallback(false);
    setView('recall');
  };

  const finishRecall = (rating: NhkRecallRating) => {
    if (!recallSession || !recallTarget) return;
    const next = recordNhkRecallAttempt(recallSession, recallTarget, todayKey, rating, recallSeconds, Date.now(), recallReview);
    setSessions(current => upsertNhkSession(current, next));
    setView('home');
  };

  const copyShortcutBase = async () => {
    const value = `${window.location.origin}/?share_target=1&url=`;
    try {
      await navigator.clipboard.writeText(value);
      setShareCopyStatus('已复制接收地址');
    } catch {
      setShareCopyStatus(value);
    }
  };

  useEffect(() => {
    const sharedUrl = readCapturedSharedMojiUrl(localStorage);
    if (!sharedUrl || sharedHandledRef.current === sharedUrl) return;
    sharedHandledRef.current = sharedUrl;
    clearCapturedSharedMojiUrl(localStorage);
    const base = findTodayNhkSession(loadNhkSessions(), todayKey) || createNhkSession(todayKey);
    const next = resetSessionForSource(base, sharedUrl);
    draftRef.current = next;
    selectedRef.current = [];
    setDraft(next);
    setArticleSentences([]);
    setSelectedSentences([]);
    setCoach(null);
    setCoachModel('');
    setCoachStatus('idle');
    setParseError('');
    setStep(0);
    setShowOriginal(false);
    setView('today');
    void parseArticle(sharedUrl, next);
  }, [todayKey]);

  if (view === 'boss' && activeBoss) {
    return <NhkBossPage session={activeBoss} onBack={closeBoss} onUpdate={persistBossSession} />;
  }

  if (view === 'evidence') {
    return <NhkEvidencePage evidence={evidence} onBack={() => setView('home')} />;
  }

  if (view === 'world' && activeWorldSession?.dailyInput) {
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

  if (view === 'recall' && recallSession && recallTarget) {
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={20} /></button>
          <div><small>第{recallTarget.intervalDay}天 · {recallRegisterLabel(recallTarget)}</small><strong>先说，再看参考</strong></div>
          <span />
        </header>
        <div className={`nhk-recall-stage nhk-recall-${recallTarget.scenarioKind}`}>
          <small>{formatDate(recallSession.dateKey)} · {recallSession.title || 'NHK日语听力'}</small>
          <div className="nhk-recall-task">
            <span>{recallRegisterLabel(recallTarget)}</span>
            <h1>{recallTarget.titleZh}</h1>
            <p>{recallTarget.promptZh}</p>
            <blockquote>{recallTarget.promptJa}</blockquote>
          </div>
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
          {!recallRevealed ? (
            <button
              className="nhk-secondary-action"
              disabled={!recallSeconds && !recallReview && !recallFallback}
              onClick={() => setRecallRevealed(true)}
            >
              已回答，查看参考
            </button>
          ) : (
            <div className="nhk-recall-answer">
              <small>{recallTarget.revealLabelZh}</small>
              <strong>{recallTarget.referenceJa}</strong>
              {recallTarget.referenceJa !== recallSession.keyExpression && (
                <p><b>核心表达：</b>{recallSession.keyExpression}</p>
              )}
              <div className="nhk-rating">
                <button onClick={() => finishRecall('miss')}>没说出来</button>
                <button onClick={() => finishRecall('close')}>接近了</button>
                <button onClick={() => finishRecall('good')}>{recallTarget.intervalDay === 1 ? '重建成功' : '迁移成功'}</button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (view === 'today') {
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={20} /></button>
          <div><small>今朝のNHK</small><strong>{step + 1}/3</strong></div>
          <span />
        </header>
        <div className="nhk-step-dots three">{[0, 1, 2].map(index => <i key={index} className={index <= step ? 'active' : ''} />)}</div>

        {step === 0 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">CHOOSE</span>
            <h1>分享一篇，教练替你挑重点。</h1>
            <p>标题、正文和迁移表达都会自动准备。第 1 句完整训练，其余最多两句会保存为补充句。</p>
            <div className="nhk-link-entry">
              <div className="nhk-url-row">
                <Link2 size={18} />
                <input
                  aria-label="MOJi文章链接"
                  value={draft.sourceUrl}
                  onChange={event => changeSourceUrl(event.target.value)}
                  onPaste={pasteAndParse}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void parseArticle();
                    }
                  }}
                  placeholder="从 MOJi 分享，或粘贴文章链接"
                  inputMode="url"
                />
                <button type="button" disabled={parseStatus === 'loading'} onClick={() => void parseArticle()}>
                  {parseStatus === 'loading' ? <LoaderCircle className="nhk-spin" size={17} /> : '解析'}
                </button>
              </div>
              <small>{parseStatus === 'loading' ? '正在寻找原文并生成训练建议…' : '从分享菜单进入时会自动解析。'}</small>
            </div>

            {parseStatus === 'error' && <div className="nhk-parse-error">{parseError}</div>}

            {parseStatus === 'ready' && draft.title && (
              <>
                <div className="nhk-parsed-article">
                  <div><small>已识别</small><strong>{draft.title}</strong></div>
                  <a href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文章"><ExternalLink size={17} /></a>
                </div>

                {coach && (
                  <div className="nhk-coach-summary">
                    <div className="nhk-coach-status">
                      <Sparkles size={14} />
                      <strong>{coachStatus === 'loading' ? '教练正在精炼' : coachStatus === 'fallback' ? '本地教练建议' : '今日教练建议'}</strong>
                    </div>
                    <p>{coach.summaryZh}</p>
                    <blockquote>{coach.summaryJa}</blockquote>
                  </div>
                )}

                <div className="nhk-sentence-picker-head">
                  <div><strong>推荐训练句</strong><small>第 1 句是今日核心，可自由更换，最多 3 句</small></div>
                  <b>{selectedSentences.length}/3</b>
                </div>
                <div className="nhk-sentence-list coached">
                  {articleSentences.map((sentence, index) => {
                    const selected = selectedSentences.includes(sentence);
                    const blocked = !selected && selectedSentences.length >= 3;
                    const recommendation = recommendationFor(sentence);
                    const selectedOrder = selectedSentences.indexOf(sentence);
                    return (
                      <button
                        key={`${index}-${sentence}`}
                        type="button"
                        className={`${selected ? 'selected' : ''} ${recommendation ? 'recommended' : ''}`.trim()}
                        disabled={blocked}
                        aria-pressed={selected}
                        onClick={() => toggleSentence(sentence)}
                      >
                        <span>{selected ? <Check size={15} /> : index + 1}</span>
                        <div>
                          {(recommendation || selectedOrder >= 0) && <small><b>{selectedOrder === 0 ? '今日核心' : selectedOrder > 0 ? '补充句' : recommendation?.label}</b>{selectedOrder === 0 ? '完整训练这句' : selectedOrder > 0 ? '已保存为补充句' : recommendation?.reasonZh}</small>}
                          <strong>{sentence}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button className="nhk-primary-action" disabled={!selectedSentences.length} onClick={nextFromInput}>
              完整训练第 1 句<ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">SAY</span>
            <h1>先跟顺，再关掉原文说出来。</h1>
            <p>影子跟读练语流；脱稿复述检验你是否真的听懂。</p>

            {primaryRecommendation && (
              <>
                <NhkSentencePlayer sentence={primaryRecommendation.sentence} chunks={primaryRecommendation.chunks} />
                <div className="nhk-shadow-guide">
                  <div><small>今日核心 · 影子切分</small><strong>{primaryRecommendation.sentence}</strong></div>
                  <div className="nhk-chunks">
                    {primaryRecommendation.chunks.map((chunk, index) => <span key={`${index}-${chunk}`}>{chunk}</span>)}
                  </div>
                  <p><b>{primaryRecommendation.expression}</b><span>{primaryRecommendation.meaningZh}</span></p>
                </div>
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
              </>
            )}

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
            <label>系统转写（可修正）<textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder="录音分析后自动填写；不能录音时可手动输入" rows={5} /></label>
            <button className="nhk-text-toggle" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? '收起原句' : '说完后看原句'}</button>
            {showOriginal && <blockquote>{draft.shadowText}</blockquote>}
            <div className="nhk-step-actions"><button onClick={() => setStep(0)}>上一步</button><button disabled={!draft.recapText.trim() || (!draft.recapRecordingSeconds && !draft.speechFallback)} onClick={() => setStep(2)}>用进世界</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">USE</span>
            <h1>把今天的一句，用进你自己的生活。</h1>
            <p>教练已经完成表达迁移。你只需要用日语作出自己的回答。</p>

            <div className="nhk-transfer-card">
              <small>今天带走</small>
              <strong>{draft.keyExpression}</strong>
              {primaryRecommendation?.meaningZh && <p>{primaryRecommendation.meaningZh}</p>}
              <div><span>平时</span><b>{draft.dailyVersion || draft.keyExpression}</b></div>
              <div><span>工作</span><b>{draft.workVersion || draft.keyExpression}</b></div>
            </div>

            {coach?.opinionQuestion && (
              <label className="nhk-opinion-prompt">
                <span>先想一想</span>
                <strong>{coach.opinionQuestion}</strong>
                <textarea value={draft.opinion} onChange={event => patch({opinion: event.target.value})} placeholder="可选：先写下你真正想说的观点" rows={3} />
              </label>
            )}

            <div className="nhk-world-scene">
              <small>{worldStory?.series?.seasonTitle || '在日本生活和工作的我'}</small>
              {coach?.worldSetupZh && <p className="nhk-world-setup">{coach.worldSetupZh}</p>}
              <strong>田中问你：「{coach?.worldPromptJa || 'このニュース、仕事や生活にも関係がありそうですか。'}」</strong>
              <p>尽量用上：{draft.workVersion || draft.keyExpression}</p>
            </div>
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
            <label>系统转写（可修正）<textarea value={draft.worldAnswer} onChange={event => patch({worldAnswer: event.target.value})} placeholder="录音分析后自动填写；不能录音时可手动输入" rows={4} /></label>
            <div className="nhk-step-actions"><button onClick={() => setStep(1)}>上一步</button><button className="complete" disabled={!isNhkSessionReadyToComplete(draft)} onClick={completeToday}><Check size={17} />完成今天</button></div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="nhk-page">
      <header className="nhk-home-header">
        <div><small>NHK → MY WORLD</small><h1>今朝の日本語</h1></div>
        <span>{streak ? `${streak}天` : '今天开始'}</span>
      </header>

      <button className={`nhk-main-card ${todaySession?.completedAt ? 'done' : ''}`} onClick={openToday}>
        <div className="nhk-main-icon">{todaySession?.completedAt ? <Check size={24} /> : <Headphones size={25} />}</div>
        <div>
          <small>{todaySession?.completedAt ? 'TODAY COMPLETE' : '8 MINUTES AFTER NHK'}</small>
          <strong>{todaySession?.completedAt ? (todaySession.title || '今天的 NHK 已转化') : '把刚听过的日语，变成你能说的日语'}</strong>
          <span>{todaySession?.completedAt ? todaySession.keyExpression : '分享文章 · 自动推荐 · 脱稿表达'}</span>
        </div>
        <ChevronRight size={20} />
      </button>

      <button className="nhk-evidence-card" onClick={() => setView('evidence')}>
        <TrendingUp size={19} />
        <div>
          <small>本周证据 · {evidence.periodLabel}</small>
          <strong>{evidence.headlineZh}</strong>
          <span>{evidence.completedInputs} 篇真实输入 · {evidence.analyzedResponses} 次语音分析</span>
        </div>
        <ChevronRight size={18} />
      </button>

      {(bossCandidate.expressions.length > 0 || weeklyBoss) && (
        <button
          className={`nhk-boss-card ${weeklyBoss?.outcome ? 'complete' : weeklyBoss || bossCandidate.eligible ? 'ready' : 'locked'}`}
          disabled={!weeklyBoss && !bossCandidate.eligible}
          onClick={openBoss}
        >
          <Trophy size={19} />
          <div>
            <small>{weeklyBoss?.outcome
              ? 'WEEKLY BOSS COMPLETE'
              : weeklyBoss
                ? `WEEKLY BOSS · ${bossProgress}/5`
                : bossCandidate.eligible
                  ? 'WEEKLY BOSS READY'
                  : `还差 ${Math.max(0, bossCandidate.requiredExpressionCount - bossCandidate.expressions.length)} 个表达`}
            </small>
            <strong>{weeklyBoss?.outcome
              ? '本周五轮对话已完成'
              : weeklyBoss
                ? '继续没有选项的五轮对话'
                : bossCandidate.eligible
                  ? '把本周表达混进一次真实对话'
                  : '收集 5 个本周表达后解锁'}
            </strong>
            <span>{weeklyBoss?.outcome
              ? `成功使用 ${weeklyBoss.outcome.usedExpressionCount}/5 个表达`
              : weeklyBoss
                ? '回答会改变田中的下一轮追问'
                : bossCandidate.eligible
                  ? '日常 · 礼貌 · 工作 · 约 3 分钟'
                  : `${bossCandidate.expressions.length}/${bossCandidate.requiredExpressionCount} 个表达`}
            </span>
          </div>
          <ChevronRight size={18} />
        </button>
      )}

      <button className="nhk-share-card" onClick={() => setShowShareHelp(value => !value)}>
        <Share2 size={19} />
        <div><small>MOJI → 日语世界</small><strong>从分享菜单直接开始</strong></div>
        <ChevronRight className={showShareHelp ? 'open' : ''} size={18} />
      </button>

      {showShareHelp && (
        <div className="nhk-share-help">
          <div><Smartphone size={19} /><strong>{isIOS ? 'iPhone 设置一次即可' : '安装后即可直接分享'}</strong></div>
          {isIOS ? (
            <>
              <p>iPhone Safari 还不能把网页 PWA 直接注册到系统分享列表。用快捷指令桥接一次，之后在 MOJi 分享菜单里点「日语世界」即可。</p>
              <ol>
                <li>新建快捷指令，开启“在共享表单中显示”，接收 URL。</li>
                <li>添加“URL”动作：先粘贴下方接收地址，再在末尾插入“快捷指令输入”。</li>
                <li>添加“打开 URL”动作，并把快捷指令命名为「日语世界」。</li>
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

      {worldCallbackTarget && (
        <button className="nhk-world-callback-card" onClick={() => openWorldSession(worldCallbackTarget.session, 'callback')}>
          <RotateCcw size={19} />
          <div><small>几天后的回响 · {formatDate(worldCallbackTarget.dueDateKey)}</small><strong>田中真的又提起了那件事</strong></div>
          <ChevronRight size={18} />
        </button>
      )}

      {recallSession && (
        <button className="nhk-recall-card" onClick={openRecall}>
          <RotateCcw size={19} />
          <div><small>第{recallTarget?.intervalDay || 1}天 · {recallTarget ? recallRegisterLabel(recallTarget) : '主动回忆'}</small><strong>{recallTarget?.titleZh || '先说，再看参考'}</strong></div>
          <ChevronRight size={18} />
        </button>
      )}

      {todaySession?.completedAt && (
        <button className="nhk-enter-world" onClick={() => openWorldSession(todaySession, 'event')}>
          <Sparkles size={19} />
          <div><small>{todaySession.dailyInput?.world.usedInWorld ? '今天的事件' : '让这件事发生'}</small><strong>{todaySession.dailyInput?.world.setupZh || todaySession.workVersion || todaySession.keyExpression}</strong></div>
          <ChevronRight size={18} />
        </button>
      )}

      {recent.length > 0 && (
        <div className="nhk-history">
          <small>最近的输入</small>
          {recent.map(session => (
            <div key={session.id}><span>{formatDate(session.dateKey)}</span><strong>{session.title || session.keyExpression}</strong><b>{session.recapRecordingSeconds || 0}s</b></div>
          ))}
        </div>
      )}
    </section>
  );
}
