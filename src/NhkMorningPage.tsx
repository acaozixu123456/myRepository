import {type ClipboardEvent, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BookOpen,
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
import NhkPracticeModeSwitch from './NhkPracticeModeSwitch';
import NhkQuietResponseCard from './NhkQuietResponseCard';
import NhkQuietReview from './NhkQuietReview';
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
  recordNhkQuietReview,
  recordNhkRecallAttempt,
  saveNhkSessions,
  syncNhkDailyInputUserFields,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';
import {
  loadNhkPracticeMode,
  saveNhkPracticeMode,
  type NhkPracticeMode,
} from './nhkPracticeMode';
import {
  clearCapturedSharedMojiUrl,
  readCapturedSharedMojiUrl,
} from './shareTarget';
import './nhkMorning.css';
import './nhkReadable.css';

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
  completedMode: undefined,
  completedAt: undefined,
});

type NhkMorningPageProps = {
  worldStory: Story | null;
  onEnterWorld: () => void;
};

type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence' | 'boss' | 'review';

export default function NhkMorningPage({worldStory, onEnterWorld}: NhkMorningPageProps) {
  const todayKey = toDateKey();
  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());
  const [bossSessions, setBossSessions] = useState<NhkBossSession[]>(() => loadNhkBossSessions());
  const [practiceMode, setPracticeMode] = useState<NhkPracticeMode>(() => loadNhkPracticeMode());
  const [activeBossId, setActiveBossId] = useState('');
  const [reviewSessionId, setReviewSessionId] = useState('');
  const [draft, setDraft] = useState<NhkMorningSession>(() => findTodayNhkSession(loadNhkSessions(), todayKey) || createNhkSession(todayKey, loadNhkPracticeMode()));
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
  const [recallQuietNote, setRecallQuietNote] = useState('');
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
  useEffect(() => saveNhkPracticeMode(practiceMode), [practiceMode]);
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
  const activeReviewSession = useMemo(
    () => sessions.find(session => session.id === reviewSessionId) || null,
    [sessions, reviewSessionId],
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

  const changePracticeMode = (mode: NhkPracticeMode) => {
    setPracticeMode(mode);
    if (view === 'today') {
      persist({...draftRef.current, practiceMode: mode, speechFallback: false});
    }
  };

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
    const existing = todaySession || createNhkSession(todayKey, practiceMode);
    const next = {...existing, practiceMode};
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
    const next = applyCoachFields({...draftRef.current, practiceMode}, coach, selectedRef.current, articleSentences, coachModel);
    persist(next);
    setStep(1);
  };

  const completeToday = () => {
    const next = syncNhkDailyInputUserFields({
      ...draftRef.current,
      practiceMode,
      completedMode: practiceMode,
      completedAt: Date.now(),
    });
    persist(next);
    setView('home');
  };

  const openRecall = () => {
    setRecallRevealed(false);
    setRecallSeconds(0);
    setRecallReview(undefined);
    setRecallFallback(false);
    setRecallQuietNote('');
    setView('recall');
  };

  const finishRecall = (rating: NhkRecallRating) => {
    if (!recallSession || !recallTarget) return;
    const next = recordNhkRecallAttempt(
      recallSession,
      recallTarget,
      todayKey,
      rating,
      practiceMode === 'voice' ? recallSeconds : 0,
      Date.now(),
      practiceMode === 'voice' ? recallReview : undefined,
      practiceMode,
      recallQuietNote,
    );
    setSessions(current => upsertNhkSession(current, next));
    setView('home');
  };

  const openQuietReview = (session: NhkMorningSession) => {
    setReviewSessionId(session.id);
    setView('review');
  };

  const finishQuietReview = (rating: NhkRecallRating, note: string) => {
    if (!activeReviewSession) return;
    const next = recordNhkQuietReview(activeReviewSession, rating, note);
    if (draftRef.current.id === next.id) {
      draftRef.current = next;
      setDraft(next);
    }
    setSessions(current => upsertNhkSession(current, next));
    setReviewSessionId('');
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
    const base = findTodayNhkSession(loadNhkSessions(), todayKey) || createNhkSession(todayKey, practiceMode);
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

  if (view === 'review' && activeReviewSession) {
    return (
      <NhkQuietReview
        session={activeReviewSession}
        onBack={() => { setReviewSessionId(''); setView('home'); }}
        onComplete={finishQuietReview}
      />
    );
  }

  if (view === 'boss' && activeBoss) {
    return (
      <NhkBossPage
        session={activeBoss}
        practiceMode={practiceMode}
        onRequestVoiceMode={() => setPracticeMode('voice')}
        onBack={closeBoss}
        onUpdate={persistBossSession}
      />
    );
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
        practiceMode={practiceMode}
        onPracticeModeChange={changePracticeMode}
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
    const quietRecallReady = practiceMode === 'quiet' && recallFallback;
    const voiceRecallReady = practiceMode === 'voice' && Boolean(recallSeconds || recallReview || recallFallback);
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={22} /></button>
          <div>
            <small>第{recallTarget.intervalDay}天 · {recallRegisterLabel(recallTarget)}</small>
            <strong>{practiceMode === 'quiet' ? '先默答，再看参考' : '先说，再看参考'}</strong>
          </div>
          <span />
        </header>

        <NhkPracticeModeSwitch
          compact
          value={practiceMode}
          onChange={mode => {
            setPracticeMode(mode);
            setRecallFallback(false);
            setRecallQuietNote('');
            setRecallSeconds(0);
            setRecallReview(undefined);
          }}
        />

        <div className={`nhk-recall-stage nhk-recall-${recallTarget.scenarioKind}`}>
          <small>{formatDate(recallSession.dateKey)} · {recallSession.title || 'NHK日语听力'}</small>
          <div className="nhk-recall-task">
            <span>{recallRegisterLabel(recallTarget)}</span>
            <h1>{recallTarget.titleZh}</h1>
            <p>{recallTarget.promptZh}</p>
            <blockquote>{recallTarget.promptJa}</blockquote>
          </div>

          {practiceMode === 'voice' ? (
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
            <>
              <NhkQuietResponseCard
                title="在心里完整回答一次"
                description="不打开麦克风。先组织日语，再决定要不要写下关键词。"
                prompt={recallTarget.promptJa}
                value={recallQuietNote}
                onChange={setRecallQuietNote}
                placeholder="可留空；也可以记下关键词或一句日语"
                rows={3}
                optional
              />
              <button
                className={`nhk-quiet-confirm ${recallFallback ? 'done' : ''}`}
                type="button"
                onClick={() => setRecallFallback(true)}
              >
                {recallFallback ? <Check size={18} /> : <BookOpen size={18} />}
                {recallFallback ? '已经默答完成' : '我已经在心里回答过'}
              </button>
            </>
          )}

          {!recallRevealed ? (
            <button
              className="nhk-secondary-action"
              disabled={!quietRecallReady && !voiceRecallReady}
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
                <button onClick={() => finishRecall('miss')}>{practiceMode === 'quiet' ? '没想起' : '没说出来'}</button>
                <button onClick={() => finishRecall('close')}>{practiceMode === 'quiet' ? '有点模糊' : '接近了'}</button>
                <button onClick={() => finishRecall('good')}>{practiceMode === 'quiet' ? '想起来了' : recallTarget.intervalDay === 1 ? '重建成功' : '迁移成功'}</button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (view === 'today') {
    const recapReady = Boolean(draft.recapText.trim())
      && (practiceMode === 'quiet' || Boolean(draft.recapRecordingSeconds || draft.speechFallback));
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={22} /></button>
          <div><small>今朝のNHK</small><strong>{step + 1}/3</strong></div>
          <span />
        </header>
        <div className="nhk-step-dots three">{[0, 1, 2].map(index => <i key={index} className={index <= step ? 'active' : ''} />)}</div>
        <NhkPracticeModeSwitch compact value={practiceMode} onChange={changePracticeMode} />

        {step === 0 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">CHOOSE</span>
            <h1>选一句今天真正想带走的日语。</h1>
            <p>分享或粘贴一篇 MOJi 文章，教练会整理重点。第 1 句完整训练，其余最多两句留作补充。</p>
            <div className="nhk-link-entry">
              <div className="nhk-url-row">
                <Link2 size={20} />
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
                  {parseStatus === 'loading' ? <LoaderCircle className="nhk-spin" size={18} /> : '解析'}
                </button>
              </div>
              <small>{parseStatus === 'loading' ? '正在识别文章并准备训练内容…' : '从分享菜单进入时会自动解析。'}</small>
            </div>

            {parseStatus === 'error' && <div className="nhk-parse-error">{parseError}</div>}

            {parseStatus === 'ready' && draft.title && (
              <>
                <div className="nhk-parsed-article">
                  <div><small>已识别文章</small><strong>{draft.title}</strong></div>
                  <a href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文章"><ExternalLink size={19} /></a>
                </div>

                {coach && (
                  <div className="nhk-coach-summary">
                    <div className="nhk-coach-status">
                      <Sparkles size={17} />
                      <strong>{coachStatus === 'loading' ? '教练正在精炼' : coachStatus === 'fallback' ? '本地教练建议' : '今日教练建议'}</strong>
                    </div>
                    <p>{coach.summaryZh}</p>
                    <blockquote>{coach.summaryJa}</blockquote>
                  </div>
                )}

                <div className="nhk-sentence-picker-head">
                  <div><strong>推荐训练句</strong><small>第 1 句是今日核心，可自由更换</small></div>
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
                        <span>{selected ? <Check size={17} /> : index + 1}</span>
                        <div>
                          {(recommendation || selectedOrder >= 0) && (
                            <small>
                              <b>{selectedOrder === 0 ? '今日核心' : selectedOrder > 0 ? '补充句' : recommendation?.label}</b>
                              {selectedOrder === 0 ? '完整训练这句' : selectedOrder > 0 ? '已保存为补充句' : recommendation?.reasonZh}
                            </small>
                          )}
                          <strong>{sentence}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button className="nhk-primary-action" disabled={!selectedSentences.length} onClick={nextFromInput}>
              训练第 1 句<ChevronRight size={20} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">UNDERSTAND</span>
            <h1>{practiceMode === 'quiet' ? '安静地听懂，再用文字复述。' : '先跟顺，再关掉原文说出来。'}</h1>
            <p>{practiceMode === 'quiet' ? '可以戴耳机听，也可以只读。今天不要求开口，重点是主动组织日语。' : '影子跟读练语流；脱稿复述检验你是否真的听懂。'}</p>

            {primaryRecommendation && (
              <>
                <NhkSentencePlayer sentence={primaryRecommendation.sentence} chunks={primaryRecommendation.chunks} />
                <div className="nhk-shadow-guide">
                  <div><small>今日核心 · 语块</small><strong>{primaryRecommendation.sentence}</strong></div>
                  <div className="nhk-chunks">
                    {primaryRecommendation.chunks.map((chunk, index) => <span key={`${index}-${chunk}`}>{chunk}</span>)}
                  </div>
                  <p><b>{primaryRecommendation.expression}</b><span>{primaryRecommendation.meaningZh}</span></p>
                </div>
                {practiceMode === 'voice' && (
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
                )}
              </>
            )}

            {practiceMode === 'voice' ? (
              <>
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
                <label className="nhk-editable-transcript">
                  系统转写（可修正）
                  <textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder="录音分析后自动填写；设备不支持时可手动输入" rows={5} />
                </label>
              </>
            ) : (
              <NhkQuietResponseCard
                title="用自己的日语复述"
                description="不要照抄原句。先在心里组织，再写 1～3 句。"
                prompt={coach?.summaryZh ? `请复述：${coach.summaryZh}` : undefined}
                value={draft.recapText}
                onChange={value => patch({recapText: value})}
                placeholder="例如：このニュースでは、〜について伝えています。"
                rows={5}
              />
            )}

            <button className="nhk-text-toggle" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? '收起原句' : '回答后查看原句'}</button>
            {showOriginal && <blockquote>{draft.shadowText}</blockquote>}
            <div className="nhk-step-actions">
              <button onClick={() => setStep(0)}>上一步</button>
              <button disabled={!recapReady} onClick={() => setStep(2)}>用进场景<ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">USE</span>
            <h1>{practiceMode === 'quiet' ? '不出声，也要把表达用进自己的生活。' : '把今天的一句，用进你自己的生活。'}</h1>
            <p>{practiceMode === 'quiet' ? '用日语写下你真正会回答的话；之后仍可在方便时回到开口练习。' : '教练已经完成表达迁移。你只需要用日语作出自己的回答。'}</p>

            <div className="nhk-transfer-card">
              <small>今天带走</small>
              <strong>{draft.keyExpression}</strong>
              {primaryRecommendation?.meaningZh && <p>{primaryRecommendation.meaningZh}</p>}
              <div><span>日常</span><b>{draft.dailyVersion || draft.keyExpression}</b></div>
              <div><span>工作</span><b>{draft.workVersion || draft.keyExpression}</b></div>
            </div>

            {coach?.opinionQuestion && (
              <label className="nhk-opinion-prompt">
                <span>先想一想</span>
                <strong>{coach.opinionQuestion}</strong>
                <textarea value={draft.opinion} onChange={event => patch({opinion: event.target.value})} placeholder="可选：先写下你的真实观点" rows={3} />
              </label>
            )}

            <div className="nhk-world-scene">
              <small>{worldStory?.series?.seasonTitle || '在日本生活和工作的我'}</small>
              {coach?.worldSetupZh && <p className="nhk-world-setup">{coach.worldSetupZh}</p>}
              <strong>田中问你：「{coach?.worldPromptJa || 'このニュース、仕事や生活にも関係がありそうですか。'}」</strong>
              <p>尽量用上：{draft.workVersion || draft.keyExpression}</p>
            </div>

            {practiceMode === 'voice' ? (
              <>
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
                <label className="nhk-editable-transcript">
                  系统转写（可修正）
                  <textarea value={draft.worldAnswer} onChange={event => patch({worldAnswer: event.target.value})} placeholder="录音分析后自动填写；设备不支持时可手动输入" rows={4} />
                </label>
              </>
            ) : (
              <NhkQuietResponseCard
                title="静音回答田中"
                description="这次用文字完成场景迁移，不会打开麦克风。"
                prompt={coach?.worldPromptJa || 'このニュースについて、どう思いますか。'}
                value={draft.worldAnswer}
                onChange={value => patch({worldAnswer: value})}
                placeholder="用 1～3 句日语回答"
                rows={5}
              />
            )}

            {practiceMode === 'quiet' && (
              <div className="nhk-mode-note"><BookOpen size={17} /><span>本次会记录为静音学习，不计入语音分析和开口时长。</span></div>
            )}

            <div className="nhk-step-actions">
              <button onClick={() => setStep(1)}>上一步</button>
              <button className="complete" disabled={!isNhkSessionReadyToComplete(draft)} onClick={completeToday}><Check size={18} />完成今天</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const dueCount = Number(Boolean(worldCallbackTarget)) + Number(Boolean(recallSession));
  const quietCompleted = evidence.studyModes.quietCompletedInputs + evidence.studyModes.quietReviews;

  return (
    <section className="nhk-page nhk-home-page">
      <header className="nhk-home-header">
        <div><small>NHK → MY WORLD</small><h1>今朝の日本語</h1></div>
        <span>{streak ? `${streak}天` : '今天开始'}</span>
      </header>

      <NhkPracticeModeSwitch value={practiceMode} onChange={changePracticeMode} />

      <button className={`nhk-main-card ${todaySession?.completedAt ? 'done' : ''}`} onClick={openToday}>
        <div className="nhk-main-icon">
          {todaySession?.completedAt ? <Check size={27} /> : practiceMode === 'quiet' ? <BookOpen size={27} /> : <Headphones size={28} />}
        </div>
        <div>
          <small>{todaySession?.completedAt ? `TODAY COMPLETE · ${todaySession.completedMode === 'quiet' ? '静音' : '开口'}` : practiceMode === 'quiet' ? 'QUIET STUDY' : 'VOICE PRACTICE'}</small>
          <strong>{todaySession?.completedAt
            ? (todaySession.title || '今天的日语已经完成')
            : practiceMode === 'quiet'
              ? '安静地听懂、复述，再用进场景'
              : '把刚听过的日语，变成你能说的日语'}
          </strong>
          <span>{todaySession?.completedAt
            ? todaySession.keyExpression
            : practiceMode === 'quiet'
              ? '不用麦克风 · 约 6 分钟'
              : '播放 · 录音 · 反馈 · 约 8 分钟'}
          </span>
        </div>
        <ChevronRight size={22} />
      </button>

      {dueCount > 0 && (
        <section className="nhk-home-section nhk-priority-section">
          <div className="nhk-section-head">
            <div><small>现在最值得做</small><strong>{dueCount} 个到期任务</strong></div>
          </div>
          <div className="nhk-priority-stack">
            {worldCallbackTarget && (
              <button className="nhk-world-callback-card" onClick={() => openWorldSession(worldCallbackTarget.session, 'callback')}>
                <RotateCcw size={21} />
                <div><small>几天后的回响 · {formatDate(worldCallbackTarget.dueDateKey)}</small><strong>田中真的又提起了那件事</strong><span>{practiceMode === 'quiet' ? '可以用文字回答' : '重新开口回答'}</span></div>
                <ChevronRight size={20} />
              </button>
            )}
            {recallSession && (
              <button className="nhk-recall-card" onClick={openRecall}>
                <RotateCcw size={21} />
                <div><small>第{recallTarget?.intervalDay || 1}天 · {recallTarget ? recallRegisterLabel(recallTarget) : '主动回忆'}</small><strong>{recallTarget?.titleZh || '先回想，再看参考'}</strong><span>{practiceMode === 'quiet' ? '默答或记关键词' : '录音后查看反馈'}</span></div>
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </section>
      )}

      {todaySession?.completedAt && (
        <button className="nhk-enter-world nhk-home-world" onClick={() => openWorldSession(todaySession, 'event')}>
          <Sparkles size={21} />
          <div><small>{todaySession.dailyInput?.world.usedInWorld ? '今天的世界事件' : '让这件事发生'}</small><strong>{todaySession.dailyInput?.world.setupZh || todaySession.workVersion || todaySession.keyExpression}</strong></div>
          <ChevronRight size={20} />
        </button>
      )}

      {recent.length > 0 && (
        <section className="nhk-home-section">
          <div className="nhk-section-head">
            <div><small>任何时候都能做</small><strong>静音复习</strong></div>
            <BookOpen size={20} />
          </div>
          <div className="nhk-recent-review-list">
            {recent.map(session => (
              <button key={session.id} onClick={() => openQuietReview(session)}>
                <span>{formatDate(session.dateKey)}</span>
                <div><strong>{session.title || session.keyExpression}</strong><small>{session.keyExpression || '回想重点与表达'}</small></div>
                <b>复习<ChevronRight size={17} /></b>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="nhk-home-section">
        <div className="nhk-section-head">
          <div><small>本周</small><strong>进步与挑战</strong></div>
        </div>
        <div className="nhk-home-week-grid">
          <button className="nhk-evidence-card" onClick={() => setView('evidence')}>
            <TrendingUp size={22} />
            <div>
              <small>{evidence.periodLabel}</small>
              <strong>本周证据</strong>
              <span>{evidence.analyzedResponses} 次语音 · {quietCompleted} 次静音</span>
            </div>
            <ChevronRight size={19} />
          </button>

          {(bossCandidate.expressions.length > 0 || weeklyBoss) ? (
            <button
              className={`nhk-boss-card ${weeklyBoss?.outcome ? 'complete' : weeklyBoss || bossCandidate.eligible ? 'ready' : 'locked'}`}
              disabled={!weeklyBoss && !bossCandidate.eligible}
              onClick={openBoss}
            >
              <Trophy size={22} />
              <div>
                <small>{weeklyBoss?.outcome ? '已完成' : weeklyBoss ? `${bossProgress}/5 轮` : bossCandidate.eligible ? '已解锁' : `${bossCandidate.expressions.length}/${bossCandidate.requiredExpressionCount}`}</small>
                <strong>Weekly Boss</strong>
                <span>{practiceMode === 'quiet' && !weeklyBoss?.outcome ? '需要开口，进度会保留' : weeklyBoss?.outcome ? `用了 ${weeklyBoss.outcome.usedExpressionCount}/5 个表达` : '五轮真实对话'}</span>
              </div>
              <ChevronRight size={19} />
            </button>
          ) : (
            <div className="nhk-boss-placeholder">
              <Trophy size={22} />
              <div><small>收集表达</small><strong>Weekly Boss</strong><span>完成几篇输入后解锁</span></div>
            </div>
          )}
        </div>
      </section>

      <button className="nhk-share-card nhk-share-utility" onClick={() => setShowShareHelp(value => !value)}>
        <Share2 size={20} />
        <div><small>快捷入口</small><strong>从 MOJi 分享菜单直接开始</strong></div>
        <ChevronRight className={showShareHelp ? 'open' : ''} size={20} />
      </button>

      {showShareHelp && (
        <div className="nhk-share-help">
          <div><Smartphone size={21} /><strong>{isIOS ? 'iPhone 设置一次即可' : '安装后即可直接分享'}</strong></div>
          {isIOS ? (
            <>
              <p>iPhone Safari 需要用快捷指令桥接。设置一次后，在 MOJi 分享菜单中点「日语世界」即可。</p>
              <ol>
                <li>新建快捷指令，开启“在共享表单中显示”，接收 URL。</li>
                <li>添加“URL”动作：粘贴接收地址，并在末尾插入“快捷指令输入”。</li>
                <li>添加“打开 URL”动作，命名为「日语世界」。</li>
              </ol>
              <div className="nhk-share-help-actions">
                <a href="shortcuts://create-shortcut">打开快捷指令</a>
                <button onClick={copyShortcutBase}><Copy size={16} />复制接收地址</button>
              </div>
              {shareCopyStatus && <small>{shareCopyStatus}</small>}
            </>
          ) : (
            <p>把本页安装到主屏幕后，支持 Web Share Target 的浏览器会在分享菜单中显示「日语世界」。</p>
          )}
        </div>
      )}
    </section>
  );
}
