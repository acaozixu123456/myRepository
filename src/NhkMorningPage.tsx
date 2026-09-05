import {type ClipboardEvent, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  Library,
  Link2,
  LoaderCircle,
  Search,
  Share2,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {api} from './api';
import NhkPracticeModeSwitch from './NhkPracticeModeSwitch';
import NhkQuietResponseCard from './NhkQuietResponseCard';
import {
  NhkRecordingCoach,
  NhkSentencePlayer,
  type NhkSpeechReview,
} from './NhkSpeechCoach';
import {
  alignCoachRecommendations,
  buildFallbackCoach,
  coachKnowledgeCounts,
  isNhkCoachResult,
  normalizeNhkCoachResult,
  pickCoachRecommendation,
  type NhkCoachRecommendation,
  type NhkCoachResult,
  type NhkGrammarPoint,
  type NhkVocabularyPoint,
} from './nhkCoach';
import {
  applyNhkDailyInput,
  applyNhkSpeechReview,
  buildNhkDailyInput,
  createNhkSession,
  findTodayNhkSession,
  loadNhkSessions,
  type NhkMorningSession,
  type NhkRecallPlan,
  type NhkRecallRating,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  syncNhkDailyInputUserFields,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';
import {
  createNhkArticleRecord,
  dueNhkKnowledge,
  exportNhkStudyData,
  isNhkKnowledgeSaved,
  knowledgePointFromGrammar,
  knowledgePointFromVocabulary,
  loadNhkArticleRecords,
  loadNhkKnowledge,
  markNhkArticleCompleted,
  mergeNhkArticlesWithSessions,
  nhkArticleRecordId,
  rateNhkKnowledge,
  removeNhkKnowledge,
  saveNhkArticleRecords,
  saveNhkKnowledge,
  toggleNhkKnowledge,
  touchNhkArticle,
  updateNhkArticleCoach,
  upsertNhkArticleRecord,
  type NhkArticleRecord,
  type NhkKnowledgeItem,
  type NhkKnowledgeSource,
  type SaveableKnowledgePoint,
} from './nhkLibrary';
import {
  loadNhkPracticeMode,
  saveNhkPracticeMode,
  type NhkPracticeMode,
} from './nhkPracticeMode';
import {
  clearCapturedSharedMojiUrl,
  readCapturedSharedMojiUrl,
} from './shareTarget';
import {GentleHome, GentleReview, GentleSentenceCheck} from './NhkGentleUI';
import {checkGentleSentence, focusGentle, gentleContinueArticle, loadGentle, recordGentleReview, saveGentle} from './nhkGentle';
import './nhkCalm.css';

type ArticleParseStatus = 'idle' | 'loading' | 'ready' | 'error';
type CoachStatus = 'idle' | 'loading' | 'ready' | 'fallback';
type PageView = 'home' | 'study' | 'archive' | 'article' | 'knowledge' | 'recall';

type MojiArticleResponse = {
  ok?: boolean;
  sourceUrl?: string;
  title?: string;
  sentences?: string[];
  access?: string;
  reason?: string;
};

type NhkCoachResponse = {
  ok?: boolean;
  coach?: unknown;
  model?: string;
  cached?: boolean;
  reason?: string;
};

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const sessionSentences = (session: NhkMorningSession): string[] => {
  if (session.selectedSentences?.length) return session.selectedSentences.slice(0, 3);
  return session.shadowText.split(/\n+/).map(value => value.trim()).filter(Boolean).slice(0, 3);
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

const recallRegisterLabel = (plan: NhkRecallPlan): string => {
  if (plan.register === 'work') return '工作迁移';
  if (plan.register === 'daily') return '日常迁移';
  return '文章核心';
};

const recallRecorderLabel = (plan: NhkRecallPlan): string => {
  if (plan.scenarioKind === 'work-transfer') return '用两句工作日语迁移';
  if (plan.scenarioKind === 'daily-transfer') return '用自然口语迁移';
  return '30秒重建文章核心';
};

const pointSource = (
  article: NhkArticleRecord,
  recommendation: NhkCoachRecommendation,
): NhkKnowledgeSource => ({
  articleId: article.id,
  articleTitle: article.title,
  sourceUrl: article.sourceUrl,
  sentence: recommendation.sentence,
  sentenceIndex: recommendation.sentenceIndex,
});

function KnowledgeToggle({
  saved,
  onClick,
}: {
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nhk-knowledge-toggle ${saved ? 'saved' : ''}`}
      type="button"
      aria-pressed={saved}
      onClick={onClick}
    >
      {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      {saved ? '已收藏' : '收藏复习'}
    </button>
  );
}

function GrammarPointCard({
  point,
  recommendation,
  article,
  knowledge,
  onToggle,
}: {
  point: NhkGrammarPoint;
  recommendation: NhkCoachRecommendation;
  article: NhkArticleRecord;
  knowledge: NhkKnowledgeItem[];
  onToggle: (point: SaveableKnowledgePoint, source: NhkKnowledgeSource) => void;
}) {
  const saved = isNhkKnowledgeSaved(knowledge, 'grammar', point.pattern);
  return (
    <article className="nhk-point-card grammar">
      <div className="nhk-point-head">
        <div><small>重点语法</small><strong>{point.pattern}</strong></div>
        <KnowledgeToggle saved={saved} onClick={() => onToggle(knowledgePointFromGrammar(point), pointSource(article, recommendation))} />
      </div>
      <p className="nhk-point-meaning">{point.meaningZh}</p>
      {point.formation && <div className="nhk-point-line"><span>接续</span><b>{point.formation}</b></div>}
      <p>{point.explanationZh}</p>
      {point.nuanceZh && <p className="nhk-point-nuance">语感：{point.nuanceZh}</p>}
      {point.examples.length > 0 && (
        <div className="nhk-extension-examples">
          <small>延伸例句</small>
          {point.examples.map((example, index) => (
            <div key={`${point.id}-${index}`}><strong>{example.ja}</strong><span>{example.zh}</span></div>
          ))}
        </div>
      )}
    </article>
  );
}

function VocabularyPointCard({
  point,
  recommendation,
  article,
  knowledge,
  onToggle,
}: {
  point: NhkVocabularyPoint;
  recommendation: NhkCoachRecommendation;
  article: NhkArticleRecord;
  knowledge: NhkKnowledgeItem[];
  onToggle: (point: SaveableKnowledgePoint, source: NhkKnowledgeSource) => void;
}) {
  const saved = isNhkKnowledgeSaved(knowledge, 'vocabulary', point.word);
  return (
    <article className="nhk-point-card vocabulary">
      <div className="nhk-point-head">
        <div>
          <small>{point.partOfSpeech || '重点单词'}</small>
          <strong>{point.word}{point.reading ? <em>（{point.reading}）</em> : null}</strong>
        </div>
        <KnowledgeToggle saved={saved} onClick={() => onToggle(knowledgePointFromVocabulary(point), pointSource(article, recommendation))} />
      </div>
      <p className="nhk-point-meaning">{point.meaningZh}</p>
      {point.nuanceZh && <p>{point.nuanceZh}</p>}
      {point.examples.length > 0 && (
        <div className="nhk-extension-examples compact">
          {point.examples.map((example, index) => (
            <div key={`${point.id}-${index}`}><strong>{example.ja}</strong><span>{example.zh}</span></div>
          ))}
        </div>
      )}
    </article>
  );
}

function DeepAnalysisCard({recommendation, article, knowledge, onToggleKnowledge, showPlayer = true}: {
  recommendation: NhkCoachRecommendation;
  article: NhkArticleRecord;
  knowledge: NhkKnowledgeItem[];
  onToggleKnowledge: (point: SaveableKnowledgePoint, source: NhkKnowledgeSource) => void;
  showPlayer?: boolean;
}) {
  return <section className="nhk-deep-analysis-card">
    <span className="calm-eyebrow">这一句</span><h2 lang="ja">{recommendation.sentence}</h2>
    <div className="calm-sentence-meaning"><p>{recommendation.translationZh}</p></div>
    {showPlayer && <details className="calm-audio-disclosure"><summary><Headphones size={18}/>听一听这句话</summary><NhkSentencePlayer key={recommendation.sentence} sentence={recommendation.sentence} chunks={recommendation.chunks}/></details>}
    <div className="calm-structure"><small>这样读，就不绕了</small><p>{recommendation.structureZh}</p><div className="calm-chunks">{recommendation.chunks.map((chunk,index) => <span key={index} lang="ja">{chunk}</span>)}</div></div>
    <div className="calm-explanation-folds">
      <details><summary><span>语法，拆开看看</span><small>{recommendation.grammarPoints.length} 个重点</small></summary><div className="nhk-point-stack">{recommendation.grammarPoints.map(point => <GrammarPointCard key={point.id} point={point} recommendation={recommendation} article={article} knowledge={knowledge} onToggle={onToggleKnowledge}/>)}</div></details>
      <details><summary><span>单词，放进句子里</span><small>{recommendation.vocabularyPoints.length} 个重点</small></summary><div className="nhk-point-stack">{recommendation.vocabularyPoints.map(point => <VocabularyPointCard key={point.id} point={point} recommendation={recommendation} article={article} knowledge={knowledge} onToggle={onToggleKnowledge}/>)}</div></details>
      <details><summary><span>换成自己的日语</span><small>日常 · 工作</small></summary><div className="nhk-transfer-examples"><strong lang="ja">{recommendation.expression}</strong><p>{recommendation.meaningZh}</p><div><small>日常</small><p lang="ja">{recommendation.dailyVersion}</p></div><div><small>工作</small><p lang="ja">{recommendation.workVersion}</p></div></div></details>
    </div>
  </section>;
}

function StudioNav({
  view,
  onChange,
}: {
  view: PageView;
  onChange: (view: 'home' | 'archive' | 'knowledge') => void;
}) {
  return (
    <nav className="nhk-studio-nav" aria-label="NHK学习导航">
      <button aria-current={view === 'home' ? 'page' : undefined} className={view === 'home' ? 'active' : ''} onClick={() => onChange('home')}><Home size={20} /><span>今日</span></button>
      <button aria-current={view === 'archive' ? 'page' : undefined} className={view === 'archive' ? 'active' : ''} onClick={() => onChange('archive')}><Library size={20} /><span>文章</span></button>
      <button aria-current={view === 'knowledge' ? 'page' : undefined} className={view === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')}>
        <Bookmark size={20} /><span>复习</span>
      </button>
    </nav>
  );
}

export default function NhkMorningPage() {
  const todayKey = toDateKey();
  const initialSessions = useMemo(() => loadNhkSessions(), []);
  const [sessions, setSessions] = useState<NhkMorningSession[]>(initialSessions);
  const [articles, setArticles] = useState<NhkArticleRecord[]>(() =>
    mergeNhkArticlesWithSessions(loadNhkArticleRecords(), initialSessions));
  const [knowledge, setKnowledge] = useState<NhkKnowledgeItem[]>(() => loadNhkKnowledge());
  const [practiceMode, setPracticeMode] = useState<NhkPracticeMode>(() => loadNhkPracticeMode());
  const [view, setView] = useState<PageView>('home');
  const [gentle, setGentle] = useState(() => loadGentle());
  const [gentlePhase, setGentlePhase] = useState<'read' | 'recall' | 'done'>('read');
  const [storageWarning, setStorageWarning] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState('');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [step, setStep] = useState(0);
  const [analysisFocus, setAnalysisFocus] = useState(0);
  const [showAllSentences, setShowAllSentences] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [recallSeconds, setRecallSeconds] = useState(0);
  const [recallReview, setRecallReview] = useState<NhkSpeechReview | undefined>();
  const [recallFallback, setRecallFallback] = useState(false);
  const [recallQuietNote, setRecallQuietNote] = useState('');
  const [showShareHelp, setShowShareHelp] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState('');
  const [parseStatus, setParseStatus] = useState<ArticleParseStatus>('idle');
  const [parseError, setParseError] = useState('');
  const [coachStatus, setCoachStatus] = useState<CoachStatus>('idle');
  const [coachModel, setCoachModel] = useState('');

  const initialToday = findTodayNhkSession(initialSessions, todayKey) || createNhkSession(todayKey, practiceMode);
  const initialSelected = sessionSentences(initialToday);
  const initialArticle = initialToday.sourceUrl
    ? articles.find(record => record.id === nhkArticleRecordId(initialToday.sourceUrl, initialToday.title))
    : undefined;
  const initialCandidates = initialArticle?.sentences?.length
    ? initialArticle.sentences
    : initialToday.dailyInput?.candidateSentences?.length
      ? initialToday.dailyInput.candidateSentences
      : initialSelected;
  const [draft, setDraft] = useState<NhkMorningSession>(initialToday);
  const [articleSentences, setArticleSentences] = useState<string[]>(initialCandidates);
  const [selectedSentences, setSelectedSentences] = useState<string[]>(initialSelected);
  const [coach, setCoach] = useState<NhkCoachResult | null>(() => initialToday.dailyInput?.coach
    ? normalizeNhkCoachResult(initialToday.dailyInput.coach, initialToday.title, initialCandidates)
    : initialArticle?.coach || null);

  const draftRef = useRef(draft);
  const selectedRef = useRef(selectedSentences);
  const parseRequestRef = useRef(0);
  const coachRequestRef = useRef(0);
  const selectionTouchedRef = useRef(false);
  const sharedHandledRef = useRef('');

  const storageFailures = useRef<Record<string, boolean>>({});
  const storageResult = (area: string, success: boolean) => {
    storageFailures.current[area] = !success;
    setStorageWarning(Object.values(storageFailures.current).some(Boolean));
  };
  useEffect(() => {storageResult('sessions', saveNhkSessions(sessions));}, [sessions]);
  useEffect(() => {storageResult('gentle', saveGentle(gentle));}, [gentle]);
  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'instant'});
    const heading = document.querySelector<HTMLElement>('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({preventScroll: true});
  }, [view, step, gentlePhase]);
  useEffect(() => {storageResult('articles', saveNhkArticleRecords(articles));}, [articles]);
  useEffect(() => {storageResult('knowledge', saveNhkKnowledge(knowledge));}, [knowledge]);
  useEffect(() => {storageResult('mode', saveNhkPracticeMode(practiceMode));}, [practiceMode]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { selectedRef.current = selectedSentences; }, [selectedSentences]);

  const recallTarget = useMemo(() => pickRecallTarget(sessions, todayKey), [sessions, todayKey]);
  const dueKnowledge = useMemo(() => dueNhkKnowledge(knowledge), [knowledge]);
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);
  const activeArticle = useMemo(() => articles.find(record => record.id === activeArticleId) || null, [articles, activeArticleId]);
  const currentArticleId = draft.sourceUrl ? nhkArticleRecordId(draft.sourceUrl, draft.title) : '';
  const currentArticle = useMemo(
    () => articles.find(record => record.id === currentArticleId) || null,
    [articles, currentArticleId],
  );

  const filteredArticles = useMemo(() => {
    const query = archiveQuery.trim().toLowerCase();
    return articles.filter(record => !query
      || record.title.toLowerCase().includes(query)
      || record.sentences.some(sentence => sentence.toLowerCase().includes(query)));
  }, [articles, archiveQuery]);

  const selectedRecommendations = useMemo(
    () => alignCoachRecommendations(coach, selectedSentences, articleSentences),
    [coach, selectedSentences, articleSentences],
  );
  const primaryRecommendation = useMemo(
    () => pickCoachRecommendation(coach, selectedSentences, articleSentences),
    [coach, selectedSentences, articleSentences],
  );

  const gentleSentence = selectedRecommendations[analysisFocus]?.sentence || selectedRecommendations[0]?.sentence || '';
  useEffect(() => {
    setGentlePhase('read');
    if (view === 'study' && step === 1 && currentArticleId && gentleSentence) {
      setGentle(value => value.lastArticleId === currentArticleId && value.articles[currentArticleId]?.focus === gentleSentence ? value : focusGentle(value, currentArticleId, gentleSentence));
    }
  }, [view, step, currentArticleId, gentleSentence]);

  const persist = (next: NhkMorningSession) => {
    draftRef.current = next;
    setDraft(next);
    setSessions(current => upsertNhkSession(current, next));
  };

  const patch = (values: Partial<NhkMorningSession>) =>
    persist(syncNhkDailyInputUserFields({...draftRef.current, ...values}));

  const saveSpeechReview = (review: NhkSpeechReview) =>
    persist(applyNhkSpeechReview(draftRef.current, review));

  const toggleKnowledge = (point: SaveableKnowledgePoint, source: NhkKnowledgeSource) => {
    setKnowledge(current => toggleNhkKnowledge(current, point, source));
  };

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

  const updateArticleWithCoach = (
    title: string,
    sentences: string[],
    sourceUrl: string,
    selected: string[],
    nextCoach: NhkCoachResult,
    model: string,
  ) => {
    setArticles(current => updateNhkArticleCoach(
      current,
      sourceUrl,
      title,
      sentences,
      selected,
      nextCoach,
      model,
      todayKey,
    ));
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

    let chosen = selectedRef.current;
    if (autoSelect && !selectionTouchedRef.current) {
      chosen = fallback.recommendations.map(item => item.sentence).slice(0, 1);
      selectedRef.current = chosen;
      setSelectedSentences(chosen);
      persist(applyCoachFields(baseSession, fallback, chosen, sentences, 'local-fallback'));
    }
    updateArticleWithCoach(title, sentences, baseSession.sourceUrl, chosen, fallback, 'local-fallback');

    try {
      const {data} = await api.post<NhkCoachResponse>('/api/nhk-coach', {title, sentences});
      if (request !== coachRequestRef.current) return;
      if (!data?.ok || !isNhkCoachResult(data.coach)) throw new Error(data?.reason || 'coach_failed');
      const generated = normalizeNhkCoachResult(data.coach, title, sentences);
      const generatedModel = data.model || 'openai-coach';
      setCoach(generated);
      setCoachModel(generatedModel);
      setCoachStatus('ready');

      if (draftRef.current.sourceUrl === baseSession.sourceUrl) {
        const recommended = generated.recommendations.map(item => item.sentence).slice(0, 1);
        const nextSelected = autoSelect && !selectionTouchedRef.current ? recommended : selectedRef.current;
        if (autoSelect && !selectionTouchedRef.current) {
          selectedRef.current = recommended;
          setSelectedSentences(recommended);
        }
        if (nextSelected.length) persist(applyCoachFields(draftRef.current, generated, nextSelected, sentences, generatedModel));
        updateArticleWithCoach(title, sentences, baseSession.sourceUrl, nextSelected, generated, generatedModel);
      }
    } catch {
      if (request !== coachRequestRef.current) return;
      setCoach(fallback);
      setCoachModel('local-fallback');
      setCoachStatus('fallback');
      if (selectedRef.current.length && draftRef.current.sourceUrl === baseSession.sourceUrl) {
        persist(applyCoachFields(draftRef.current, fallback, selectedRef.current, sentences, 'local-fallback'));
        updateArticleWithCoach(title, sentences, baseSession.sourceUrl, selectedRef.current, fallback, 'local-fallback');
      }
    }
  };

  const initializeStudy = (session: NhkMorningSession, candidates: string[], storedCoach?: NhkCoachResult) => {
    parseRequestRef.current += 1;
    coachRequestRef.current += 1;
    setGentlePhase('read');
    const selected = sessionSentences(session);
    draftRef.current = session;
    selectedRef.current = selected;
    selectionTouchedRef.current = Boolean(selected.length);
    setDraft(session);
    setSelectedSentences(selected);
    setArticleSentences(candidates);
    setCoach(storedCoach || session.dailyInput?.coach || null);
    setCoachModel(session.dailyInput?.coachModel || '');
    setCoachStatus(storedCoach || session.dailyInput ? (session.dailyInput?.coachModel === 'local-fallback' ? 'fallback' : 'ready') : 'idle');
    setParseStatus(candidates.length ? 'ready' : 'idle');
    setParseError('');
    setAnalysisFocus(0);
    setShowAllSentences(false);
    setView('study');
  };

  const openToday = () => {
    const record = gentleContinueArticle(articles, gentle);
    if (record) {studySavedArticle(record); return;}
    startNewArticle();
  };

  const startNewArticle = () => {
    parseRequestRef.current += 1;
    coachRequestRef.current += 1;
    selectionTouchedRef.current = false;
    const next = createNhkSession(todayKey, practiceMode);
    initializeStudy(next, []);
    setSelectedSentences([]);
    selectedRef.current = [];
    setCoach(null);
    setCoachModel('');
    setCoachStatus('idle');
    setStep(0);
  };

  const changePracticeMode = (mode: NhkPracticeMode) => {
    setPracticeMode(mode);
    if (view === 'study') persist({...draftRef.current, practiceMode: mode, speechFallback: false});
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
      setParseError('先粘贴 MOJi 的 NHK 文章链接。');
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
      const parsedSentences = data.sentences;
      const next = {
        ...cleanSession,
        sourceUrl: data.sourceUrl || sourceUrl,
        title: data.title,
      };
      persist(next);
      setArticleSentences(parsedSentences);
      setParseStatus('ready');
      setArticles(current => upsertNhkArticleRecord(current, createNhkArticleRecord({
        sourceUrl: next.sourceUrl,
        title: next.title,
        sentences: parsedSentences,
        dateKey: todayKey,
      })));
      void loadCoach(data.title, parsedSentences, next, true);
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

  const recommendationFor = (sentence: string): NhkCoachRecommendation | undefined =>
    coach?.recommendations.find(item => item.sentence === sentence);

  const toggleSentence = (sentence: string) => {
    const selected = selectedRef.current.includes(sentence);
    if (!selected && selectedRef.current.length >= 3) return;
    selectionTouchedRef.current = true;
    const nextSelected = selected
      ? selectedRef.current.filter(value => value !== sentence)
      : [...selectedRef.current, sentence];
    selectedRef.current = nextSelected;
    setSelectedSentences(nextSelected);
    setAnalysisFocus(0);
    const resetOutput: NhkMorningSession = {
      ...draftRef.current,
      recapText: '',
      opinion: '',
      shadowRecordingSeconds: 0,
      recapRecordingSeconds: 0,
      speechFallback: false,
      speechReviews: {},
      recallAttempts: [],
      completedAt: undefined,
    };
    persist(applyCoachFields(resetOutput, coach, nextSelected, articleSentences, coachModel));
    if (coach && draftRef.current.sourceUrl) {
      updateArticleWithCoach(draftRef.current.title, articleSentences, draftRef.current.sourceUrl, nextSelected, coach, coachModel || 'local-fallback');
    }
  };

  const nextFromInput = () => {
    selectionTouchedRef.current = true;
    const next = applyCoachFields({...draftRef.current, practiceMode}, coach, selectedRef.current, articleSentences, coachModel);
    persist(next);
    setAnalysisFocus(0);
    setStep(1);
  };

  const studyCompletionReady = Boolean(
    draft.shadowText.trim()
    && draft.keyExpression.trim()
    && draft.recapText.trim()
    && (practiceMode === 'quiet' || draft.recapRecordingSeconds > 0 || draft.speechFallback),
  );

  const completeToday = () => {
    if (!studyCompletionReady) return;
    const completedAt = Date.now();
    const next = syncNhkDailyInputUserFields({
      ...draftRef.current,
      practiceMode,
      completedMode: practiceMode,
      completedAt,
    });
    persist(next);
    setArticles(current => markNhkArticleCompleted(current, next.sourceUrl, completedAt));
    setView('home');
  };

  const openArticle = (id: string) => {
    setArticles(current => touchNhkArticle(current, id));
    setActiveArticleId(id);
    setAnalysisFocus(0);
    setShowAllSentences(false);
    setView('article');
  };

  const studySavedArticle = (record: NhkArticleRecord, regenerate = false) => {
    selectionTouchedRef.current = Boolean(record.selectedSentences.length);
    const previous = sessions.find(session => session.sourceUrl === record.sourceUrl && session.dateKey === todayKey);
    const base = previous ? {...previous, practiceMode} : {
      ...resetSessionForSource(createNhkSession(todayKey, practiceMode), record.sourceUrl),
      title: record.title,
    };
    const resolvedCoach = record.coach || buildFallbackCoach(record.title, record.sentences);
    const focus = gentle.articles[record.id]?.focus;
    const selected = focus && record.sentences.includes(focus) ? [focus] : record.selectedSentences.length
      ? record.selectedSentences.slice(0, 1)
      : resolvedCoach.recommendations.map(item => item.sentence).slice(0, 1);
    selectedRef.current = selected;
    const next = applyCoachFields(base, resolvedCoach, selected, record.sentences, record.coachModel || 'local-fallback');
    initializeStudy(next, record.sentences, resolvedCoach);
    setSelectedSentences(selected);
    selectedRef.current = selected;
    setStep(1);
    if (regenerate || !record.coach) void loadCoach(record.title, record.sentences, next, !record.selectedSentences.length);
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
    if (!recallTarget) return;
    const next = recordNhkRecallAttempt(
      recallTarget.session,
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

  const copyShortcutBase = async () => {
    const value = `${window.location.origin}/?share_target=1&url=`;
    try {
      await navigator.clipboard.writeText(value);
      setShareCopyStatus('已复制接收地址');
    } catch {
      setShareCopyStatus(value);
    }
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({...JSON.parse(exportNhkStudyData(articles, knowledge, sessions)), gentleProgress: gentle}, null, 2)], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nhk-study-backup-${todayKey}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  useEffect(() => {
    let sharedUrl = '';
    try { sharedUrl = readCapturedSharedMojiUrl(localStorage) || ''; } catch { return; }
    if (!sharedUrl || sharedHandledRef.current === sharedUrl) return;
    sharedHandledRef.current = sharedUrl;
    try { clearCapturedSharedMojiUrl(localStorage); } catch { /* Reading can still proceed. */ }
    const base = createNhkSession(todayKey, practiceMode);
    const next = resetSessionForSource(base, sharedUrl);
    initializeStudy(next, []);
    setSelectedSentences([]);
    selectedRef.current = [];
    setStep(0);
    void parseArticle(sharedUrl, next);
  }, [todayKey]);

  if (view === 'recall' && recallTarget) {
    const quietReady = practiceMode === 'quiet' && recallFallback;
    const voiceReady = practiceMode === 'voice' && Boolean(recallSeconds || recallReview || recallFallback);
    return (
      <section className="nhk-page nhk-studio-page nhk-recall-page">
        <header className="nhk-studio-subheader">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={22} /></button>
          <div><small>第{recallTarget.intervalDay}天 · {recallRegisterLabel(recallTarget)}</small><strong>先回想，再看答案</strong></div>
          <span />
        </header>
        <NhkPracticeModeSwitch compact value={practiceMode} onChange={mode => {
          setPracticeMode(mode);
          setRecallFallback(false);
          setRecallQuietNote('');
          setRecallSeconds(0);
          setRecallReview(undefined);
        }} />

        <div className="nhk-recall-studio-card">
          <small>{formatDate(recallTarget.session.dateKey)} · {recallTarget.session.title}</small>
          <span>{recallRegisterLabel(recallTarget)}</span>
          <h1>{recallTarget.titleZh}</h1>
          <p>{recallTarget.promptZh}</p>
          <blockquote>{recallTarget.promptJa}</blockquote>

          {practiceMode === 'voice' ? (
            <NhkRecordingCoach
              label={recallRecorderLabel(recallTarget)}
              mode="recall"
              referenceText={recallTarget.referenceJa || recallTarget.session.keyExpression}
              summary={recallTarget.session.dailyInput?.coach.summaryJa || recallTarget.session.title}
              question={recallTarget.promptJa}
              targetExpression={recallTarget.session.keyExpression}
              review={recallReview}
              onDuration={setRecallSeconds}
              onReview={setRecallReview}
              onUnavailable={() => setRecallFallback(true)}
            />
          ) : (
            <>
              <NhkQuietResponseCard
                title="在心里或文字中重建"
                description="先不要看原句，尽量自己组织完整日语。"
                prompt={recallTarget.promptJa}
                value={recallQuietNote}
                onChange={setRecallQuietNote}
                placeholder="可记关键词，也可以写完整回答"
                rows={4}
                optional
              />
              <button className={`nhk-quiet-confirm ${recallFallback ? 'done' : ''}`} onClick={() => setRecallFallback(true)}>
                {recallFallback ? <Check size={18} /> : <BookOpen size={18} />}
                {recallFallback ? '已经完成回想' : '我已经认真回想过'}
              </button>
            </>
          )}

          {!recallRevealed ? (
            <button className="nhk-studio-primary" disabled={!quietReady && !voiceReady} onClick={() => setRecallRevealed(true)}>
              查看参考表达
            </button>
          ) : (
            <div className="nhk-recall-reference">
              <small>{recallTarget.revealLabelZh}</small>
              <strong>{recallTarget.referenceJa}</strong>
              <div>
                <button onClick={() => finishRecall('miss')}>没想起</button>
                <button onClick={() => finishRecall('close')}>有点模糊</button>
                <button onClick={() => finishRecall('good')}>想起来了</button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (view === 'article' && activeArticle) {
    const articleCoach = activeArticle.coach || buildFallbackCoach(activeArticle.title, activeArticle.sentences);
    const recommendations = articleCoach.recommendations;
    const activeRecommendation = recommendations[analysisFocus] || recommendations[0];
    const counts = coachKnowledgeCounts(articleCoach);
    return (
      <section className="nhk-page nhk-studio-page nhk-article-detail-page">
        <header className="nhk-studio-subheader">
          <button aria-label="返回文章库" onClick={() => setView('archive')}><ArrowLeft size={22} /></button>
          <div><small>{formatTimestamp(activeArticle.importedAt)}</small><strong>文章精读记录</strong></div>
          <a href={activeArticle.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文"><ExternalLink size={20} /></a>
        </header>

        {(activeArticle.coachModel === 'local-fallback' || !activeArticle.coach) && <p className="calm-coach-status">当前保存的是基础讲解，可重试 AI 精讲。</p>}
        <article className="nhk-article-detail-hero">
          <span>{activeArticle.completedAt ? '完成过输出练习' : '已保存'}</span>
          <h1>{activeArticle.title}</h1>
          <p>{articleCoach.summaryZh}</p>
          <blockquote>{articleCoach.summaryJa}</blockquote>
          <div><b>{activeArticle.sentences.length}</b><small>正文句子</small><b>{counts.grammar}</b><small>语法点</small><b>{counts.vocabulary}</b><small>单词</small></div>
        </article>

        <div className="nhk-article-detail-actions">
          <button className="primary" onClick={() => studySavedArticle(activeArticle)}><GraduationCap size={18} />从一句开始</button>
          <button onClick={() => studySavedArticle(activeArticle, true)}><Sparkles size={18} />重试 AI 精讲</button>
        </div>

        {recommendations.length > 1 && (
          <div className="nhk-analysis-tabs">
            {recommendations.map((recommendation, index) => (
              <button key={`${recommendation.sentenceIndex}-${recommendation.sentence}`} className={analysisFocus === index ? 'active' : ''} onClick={() => setAnalysisFocus(index)}>
                <span>{index + 1}</span><div><small>{recommendation.label}</small><strong>{recommendation.expression}</strong></div>
              </button>
            ))}
          </div>
        )}

        {activeRecommendation && (
          <DeepAnalysisCard
            recommendation={activeRecommendation}
            article={activeArticle}
            knowledge={knowledge}
            onToggleKnowledge={toggleKnowledge}
          />
        )}

        <section className="nhk-all-sentences-card">
          <button className="nhk-collapse-head" onClick={() => setShowAllSentences(value => !value)}>
            <div><small>ARTICLE</small><strong>查看完整正文句子</strong></div>
            {showAllSentences ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {showAllSentences && (
            <ol>{activeArticle.sentences.map((sentence, index) => <li key={`${index}-${sentence}`}><span>{index + 1}</span><p>{sentence}</p></li>)}</ol>
          )}
        </section>
      </section>
    );
  }

  if (view === 'archive') {
    return (
      <section className="nhk-page nhk-studio-page nhk-library-page">
        {storageWarning && <p className="calm-storage-warning" role="alert">当前浏览器暂时不能保存，请导出备份后再离开。</p>}
        <header className="nhk-studio-mainheader">
          <div><span className="calm-eyebrow">慢慢积累，随时翻看</span><h1>文章库</h1><p>读过的、想读的，都留在这里。</p></div>
          <button aria-label="导出学习记录" onClick={exportBackup}><Download size={20} /></button>
        </header>

        <button className="calm-secondary" onClick={startNewArticle}><Link2 size={18}/>导入文章</button>
        <p className="calm-storage-note">保存在当前浏览器，暂未云同步。右上角可导出备份。</p>
        <label className="nhk-studio-search">
          <Search size={18} />
          <input aria-label="搜索文章" value={archiveQuery} onChange={event => setArchiveQuery(event.target.value)} placeholder="搜索标题或正文" />
        </label>

        <div className="nhk-library-summary">
          <div><strong>{articles.length}</strong><span>已保存文章</span></div>
          <div><strong>{articles.filter(record => record.completedAt).length}</strong><span>完成过输出练习</span></div>
          <div><strong>{knowledge.length}</strong><span>收藏知识点</span></div>
        </div>

        <div className="nhk-article-list">
          {filteredArticles.map(record => {
            const counts = coachKnowledgeCounts(record.coach || null);
            return (
              <button key={record.id} onClick={() => openArticle(record.id)}>
                <div className="nhk-article-date"><CalendarDays size={17} /><span>{formatTimestamp(record.importedAt)}</span></div>
                <strong>{record.title}</strong>
                <p>{record.coach?.summaryZh || record.sentences[0] || '已保存，等待精读。'}</p>
                <footer>
                  <span>{record.sentences.length} 句</span>
                  <span>{counts.grammar} 语法</span>
                  <span>{counts.vocabulary} 单词</span>
                  {record.completedAt && <b><Check size={14} />练习过</b>}
                  <ChevronRight size={18} />
                </footer>
              </button>
            );
          })}
          {!filteredArticles.length && (
            <div className="nhk-studio-empty"><FileText size={30} /><strong>还没有匹配的文章</strong><p>从 MOJi 分享一篇 NHK 文章后，会自动保存在这里。</p></div>
          )}
        </div>
        <StudioNav view={view} onChange={setView} />
      </section>
    );
  }

  if (view === 'knowledge') {
    return <section className="nhk-page nhk-studio-page nhk-knowledge-page">
      {storageWarning && <p className="calm-storage-warning" role="alert">浏览器暂时不能保存记录。请先导出备份，离开页面可能丢失本次进度。</p>}
      <GentleReview items={knowledge} onRate={(id, rating) => {setKnowledge(value => rateNhkKnowledge(value, id, rating)); setGentle(value => recordGentleReview(value, id, rating));}}
        onRemove={id => setKnowledge(value => removeNhkKnowledge(value, id))} onOpenArticle={openArticle} onExit={() => setView('home')}
        recallAction={recallTarget ? <button className="calm-archive-link" onClick={openRecall}><span>再回想一篇旧新闻</span><ChevronRight size={18}/></button> : undefined}/>
      <StudioNav view={view} onChange={setView}/>
    </section>;
  }

  if (view === 'study') {
    const studyArticle = currentArticle || createNhkArticleRecord({
      sourceUrl: draft.sourceUrl || 'https://www.mojidict.com/article/pending',
      title: draft.title || 'NHK日语听力',
      sentences: articleSentences,
      selectedSentences,
      coach: coach || undefined,
      coachModel,
      dateKey: todayKey,
    });
    const activeRecommendation = selectedRecommendations[analysisFocus] || selectedRecommendations[0];
    const recapReady = Boolean(draft.recapText.trim())
      && (practiceMode === 'quiet' || Boolean(draft.recapRecordingSeconds || draft.speechFallback));
    if (step === 1 && activeRecommendation) {
      const nextRecommendation = coach?.recommendations.find(item => item.sentence !== activeRecommendation.sentence && !gentle.articles[studyArticle.id]?.read.includes(item.sentence));
      const nextSentence = () => {
        if (!nextRecommendation) {openArticle(studyArticle.id); return;}
        const selected = [nextRecommendation.sentence];
        selectedRef.current = selected;
        selectionTouchedRef.current = true;
        setSelectedSentences(selected);
        setAnalysisFocus(0);
        persist(applyCoachFields(draftRef.current, coach, selected, articleSentences, coachModel));
        setGentlePhase('read');
      };
      return <section className="nhk-page nhk-studio-page nhk-focus-page">
        <header className="nhk-studio-subheader"><button aria-label="返回今日" onClick={() => setView('home')}><ArrowLeft size={22}/></button><div><small>{gentlePhase === 'read' ? '读懂' : gentlePhase === 'recall' ? '回想' : '小小收获'}</small><h1>一句精读</h1></div><button aria-label="查看这篇文章" onClick={() => openArticle(studyArticle.id)}><BookOpen size={21}/></button></header>
        {storageWarning && <p className="calm-storage-warning" role="alert">本次记录暂未写入浏览器，请导出备份。</p>}
        {gentlePhase === 'read' && <>
          {(coachStatus === 'loading' || coachStatus === 'fallback' || coachModel === 'local-fallback') && <div className="calm-coach-status" role="status">{coachStatus === 'loading' ? '正在补全精讲，可以先读正文。' : '当前是基础讲解；AI 精讲暂未完成。'}{coachStatus !== 'loading' && <button onClick={() => void loadCoach(draft.title, articleSentences, draftRef.current, false)}>重试精讲</button>}</div>}
          {selectedRecommendations.length > 1 && <div className="nhk-analysis-tabs" role="group" aria-label="已选句子">{selectedRecommendations.map((item,index) => <button key={item.sentence} aria-pressed={index === analysisFocus} className={index === analysisFocus ? 'active' : ''} onClick={() => setAnalysisFocus(index)}>第 {index + 1} 句</button>)}</div>}
          <DeepAnalysisCard key={activeRecommendation.sentence} recommendation={activeRecommendation} article={studyArticle} knowledge={knowledge} onToggleKnowledge={toggleKnowledge}/>
          <div className="calm-focus-actions"><button className="calm-primary" onClick={() => {selectionTouchedRef.current = true; setGentlePhase('recall');}}>合上提示，想一想<ChevronRight size={18}/></button><button className="calm-text-button" onClick={() => setStep(0)}>换一句 / 查看全文</button></div>
        </>}
        {gentlePhase === 'recall' && <GentleSentenceCheck key={activeRecommendation.sentence} sentence={activeRecommendation.sentence} meaning={activeRecommendation.translationZh}
          onBack={() => setGentlePhase('read')} onFinish={rating => {setGentle(value => checkGentleSentence(value, studyArticle.id, activeRecommendation.sentence, rating)); setGentlePhase('done');}}/>}
        {gentlePhase === 'done' && <section className="calm-finish-card"><span className="calm-finish-icon"><Check size={30}/></span><span className="calm-eyebrow">这一句，离你近了一点</span><h2>今天的小练习，完成了。</h2><p>你读过，也试着回想了。这不是一次考试，之后还会慢慢熟悉。</p><button className="calm-primary" onClick={() => setView('home')}>今天到这里<Check size={18}/></button><div className="calm-finish-options"><button onClick={nextSentence}>{nextRecommendation ? '再读一句' : '回看这篇文章'}<ChevronRight size={16}/></button><button onClick={() => setStep(2)}>试着说一说<ChevronRight size={16}/></button></div></section>}
      </section>;
    }
    return (
      <section className="nhk-page nhk-studio-page nhk-study-page">
        <header className="nhk-studio-subheader">
          <button aria-label="返回首页" onClick={() => setView('home')}><ArrowLeft size={22} /></button>
          <div><small>NHK 精读</small><strong>{step === 0 ? '保存文章' : '试着表达 · 可选'}</strong></div>
          {draft.sourceUrl ? <a href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文"><ExternalLink size={20} /></a> : <span />}
        </header>
        
        {step === 2 && <NhkPracticeModeSwitch compact value={practiceMode} onChange={changePracticeMode} />}

        {step === 0 && (
          <div className="nhk-study-step">
            <div className="nhk-step-intro">
              <span>ARTICLE</span>
              <h1>先留下一篇，今天读一句。</h1>
              <p>解析后保存正文，重点句由 AI 帮你挑。</p>
            </div>

            <div className="nhk-link-entry nhk-studio-link-entry">
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
                  placeholder="从 MOJi 分享，或粘贴 NHK 文章链接"
                  inputMode="url"
                />
                <button type="button" disabled={parseStatus === 'loading'} onClick={() => void parseArticle()}>
                  {parseStatus === 'loading' ? <LoaderCircle className="nhk-spin" size={18} /> : '解析'}
                </button>
              </div>
              <small>{parseStatus === 'loading' ? '正在保存正文并生成重点精讲…' : '支持 MOJi 分享链接，粘贴后自动解析。'}</small>
            </div>

            {parseStatus === 'error' && <div className="nhk-parse-error">{parseError}</div>}

            {parseStatus === 'ready' && draft.title && (
              <>
                <article className="nhk-parsed-overview">
                  <div><small>{storageWarning ? '正文暂留本页，请导出备份' : '已保存到文章库'}</small><h2>{draft.title}</h2></div>
                  <span><Check size={16} />{articleSentences.length} 句</span>
                  {coach && <><p>{coach.summaryZh}</p><blockquote>{coach.summaryJa}</blockquote></>}
                  <footer><Sparkles size={16} /><span>{coachStatus === 'loading' ? 'AI 正在补全语法、单词和延伸例句' : coachStatus === 'fallback' ? '当前显示本地基础讲解，可稍后重试 AI 精讲' : '重点句精讲已准备好'}</span></footer>
                </article>

                <button className="calm-primary" disabled={!selectedSentences.length} onClick={nextFromInput}>就从这一句开始<ChevronRight size={20}/></button>
                <details className="calm-picker-disclosure"><summary>查看正文 / 自己选句</summary>
                <div className="nhk-picker-heading">
                  <div><small>KEY SENTENCES</small><strong>重点句</strong><p>也可以自己换选，最多 3 句。</p></div>
                  <b>{selectedSentences.length}/3</b>
                </div>
                <div className="nhk-sentence-list nhk-studio-sentence-list">
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
                            <small><b>{selectedOrder === 0 ? '核心句' : selectedOrder > 0 ? `重点句 ${selectedOrder + 1}` : recommendation?.label}</b>{recommendation?.reasonZh}</small>
                          )}
                          <strong>{sentence}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
                </details>
              </>
            )}


          </div>
        )}

        {step === 2 && (
          <div className="nhk-study-step">
            <div className="nhk-step-intro">
              <span>OUTPUT</span>
              <h1>用自己的话，说一点就好。</h1>
              <p>这是可选的进阶练习。先说清一个重点，不必一次讲得完美。</p>
            </div>

            <article className="nhk-output-brief">
              <small>文章核心</small>
              <h2>{coach?.summaryJa || draft.title}</h2>
              <p>{coach?.summaryZh}</p>
              {primaryRecommendation && (
                <div><span>这次试用</span><strong>{primaryRecommendation.expression}</strong><p>{primaryRecommendation.meaningZh}</p></div>
              )}
            </article>

            {practiceMode === 'voice' ? (
              <>
                <NhkRecordingCoach
                  label="20～60秒脱稿复述"
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
                  <textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder="录音分析后会自动填写；也可以手动补充" rows={5} />
                </label>
              </>
            ) : (
              <NhkQuietResponseCard
                title="用自己的日语复述"
                description="不要照抄原句。先组织，写 1～2 句也可以。"
                prompt={coach?.summaryZh ? `请复述：${coach.summaryZh}` : undefined}
                value={draft.recapText}
                onChange={value => patch({recapText: value})}
                placeholder="このニュースでは、〜について伝えています。"
                rows={6}
              />
            )}

            <label className="nhk-opinion-answer">
              <span>你的看法（可选）</span>
              <strong>{coach?.opinionQuestion || 'このニュースについて、あなたはどう思いますか。'}</strong>
              <textarea value={draft.opinion} onChange={event => patch({opinion: event.target.value})} placeholder="理由也写一句。例：私は〜と思います。なぜなら、〜からです。" rows={4} />
            </label>

            {primaryRecommendation && (
              <section className="nhk-output-transfer">
                <small>延伸表达</small>
                <div><span>日常</span><strong>{primaryRecommendation.dailyVersion}</strong></div>
                <div><span>工作</span><strong>{primaryRecommendation.workVersion}</strong></div>
              </section>
            )}

            <div className="nhk-completion-checklist">
              <div className={selectedRecommendations.length ? 'done' : ''}><Check size={16} /><span>已选 {selectedRecommendations.length} 个重点句</span></div>
              <div className={recapReady ? 'done' : ''}><Check size={16} /><span>已记录一次复述</span></div>
              <div className={draft.opinion.trim() ? 'done' : ''}><Check size={16} /><span>表达看法（可选）</span></div>
            </div>

            <div className="nhk-step-actions nhk-studio-step-actions">
              <button onClick={() => setStep(1)}>返回精讲</button>
              <button className="complete" disabled={!studyCompletionReady} onClick={completeToday}><Check size={18} />保存这次表达</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="nhk-page nhk-studio-page nhk-studio-home">
      {storageWarning && <p className="calm-storage-warning" role="alert">浏览器暂时无法保存。请先导出备份，避免关闭后丢失本次记录。</p>}
      <GentleHome article={gentleContinueArticle(articles, gentle)} progress={gentle} dueCount={dueKnowledge.length} articleCount={articles.length}
        onContinue={openToday} onImport={startNewArticle} onReview={() => setView('knowledge')} onArchive={() => setView('archive')}/>
      <div className="calm-home-utilities"><button className="calm-text-button" onClick={exportBackup}><Download size={16}/>导出备份</button><small>仅保存在当前浏览器，暂未云同步</small></div>
      <button className="nhk-share-card nhk-studio-share" onClick={() => setShowShareHelp(value => !value)}>
        <Share2 size={20} />
        <div><small>快捷入口</small><strong>从 MOJi 分享菜单直接保存并精读</strong></div>
        {showShareHelp ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {showShareHelp && (
        <div className="nhk-share-help nhk-studio-share-help">
          <div><Smartphone size={21} /><strong>{isIOS ? 'iPhone 设置一次即可' : '安装后即可直接分享'}</strong></div>
          {isIOS ? (
            <>
              <p>iPhone Safari 需要用快捷指令桥接。设置一次后，在 MOJi 分享菜单中点「NHK精读」即可。</p>
              <ol>
                <li>新建快捷指令，开启“在共享表单中显示”，接收 URL。</li>
                <li>添加“URL”动作：粘贴接收地址，并在末尾插入“快捷指令输入”。</li>
                <li>添加“打开 URL”动作，命名为「NHK精读」。</li>
              </ol>
              <div className="nhk-share-help-actions">
                <a href="shortcuts://create-shortcut">打开快捷指令</a>
                <button onClick={copyShortcutBase}><Copy size={16} />复制接收地址</button>
              </div>
              {shareCopyStatus && <small>{shareCopyStatus}</small>}
            </>
          ) : (
            <p>把本页安装到主屏幕后，支持 Web Share Target 的浏览器会在分享菜单中显示「NHK精读」。</p>
          )}
        </div>
      )}

      <StudioNav view={view} onChange={setView} />
    </section>
  );
}
