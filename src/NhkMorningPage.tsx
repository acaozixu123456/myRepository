import {type ClipboardEvent, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  Library,
  Link2,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
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
  completedNhkStreak,
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
import './nhkMorning.css';
import './nhkReadable.css';
import './nhkArticleStudio.css';

type ArticleParseStatus = 'idle' | 'loading' | 'ready' | 'error';
type CoachStatus = 'idle' | 'loading' | 'ready' | 'fallback';
type PageView = 'home' | 'study' | 'archive' | 'article' | 'knowledge' | 'recall';
type KnowledgeFilter = 'due' | 'all' | 'grammar' | 'vocabulary';

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

function DeepAnalysisCard({
  recommendation,
  article,
  knowledge,
  onToggleKnowledge,
  showPlayer = true,
}: {
  recommendation: NhkCoachRecommendation;
  article: NhkArticleRecord;
  knowledge: NhkKnowledgeItem[];
  onToggleKnowledge: (point: SaveableKnowledgePoint, source: NhkKnowledgeSource) => void;
  showPlayer?: boolean;
}) {
  return (
    <section className="nhk-deep-analysis-card">
      <div className="nhk-analysis-label">
        <span>{recommendation.label}</span>
        <p>{recommendation.reasonZh}</p>
      </div>
      <h2>{recommendation.sentence}</h2>
      {showPlayer && <NhkSentencePlayer sentence={recommendation.sentence} chunks={recommendation.chunks} />}

      <div className="nhk-sentence-explanation">
        <div><small>整句意思</small><p>{recommendation.translationZh}</p></div>
        <div><small>句子结构</small><p>{recommendation.structureZh}</p></div>
        <div className="nhk-chunk-row"><small>语块</small><p>{recommendation.chunks.map((chunk, index) => <span key={`${index}-${chunk}`}>{chunk}</span>)}</p></div>
      </div>

      <div className="nhk-analysis-section-head">
        <div><small>GRAMMAR</small><strong>重点语法</strong></div>
        <span>{recommendation.grammarPoints.length} 个</span>
      </div>
      <div className="nhk-point-stack">
        {recommendation.grammarPoints.map(point => (
          <GrammarPointCard
            key={point.id}
            point={point}
            recommendation={recommendation}
            article={article}
            knowledge={knowledge}
            onToggle={onToggleKnowledge}
          />
        ))}
      </div>

      <div className="nhk-analysis-section-head">
        <div><small>VOCABULARY</small><strong>重点单词</strong></div>
        <span>{recommendation.vocabularyPoints.length} 个</span>
      </div>
      <div className="nhk-point-stack vocabulary-grid">
        {recommendation.vocabularyPoints.map(point => (
          <VocabularyPointCard
            key={point.id}
            point={point}
            recommendation={recommendation}
            article={article}
            knowledge={knowledge}
            onToggle={onToggleKnowledge}
          />
        ))}
      </div>

      <div className="nhk-transfer-examples">
        <small>把核心表达带出去</small>
        <div><span>核心表达</span><strong>{recommendation.expression}</strong><p>{recommendation.meaningZh}</p></div>
        <div><span>日常例句</span><strong>{recommendation.dailyVersion}</strong></div>
        <div><span>工作例句</span><strong>{recommendation.workVersion}</strong></div>
      </div>
    </section>
  );
}

function StudioNav({
  view,
  dueCount,
  onChange,
}: {
  view: PageView;
  dueCount: number;
  onChange: (view: 'home' | 'archive' | 'knowledge') => void;
}) {
  return (
    <nav className="nhk-studio-nav" aria-label="NHK学习导航">
      <button className={view === 'home' ? 'active' : ''} onClick={() => onChange('home')}><Home size={20} /><span>首页</span></button>
      <button className={view === 'archive' ? 'active' : ''} onClick={() => onChange('archive')}><Library size={20} /><span>文章库</span></button>
      <button className={view === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')}>
        <Bookmark size={20} /><span>收藏</span>{dueCount > 0 && <b>{Math.min(dueCount, 99)}</b>}
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
  const [activeArticleId, setActiveArticleId] = useState('');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeFilter, setKnowledgeFilter] = useState<KnowledgeFilter>('due');
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState('');
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

  useEffect(() => saveNhkSessions(sessions), [sessions]);
  useEffect(() => saveNhkArticleRecords(articles), [articles]);
  useEffect(() => saveNhkKnowledge(knowledge), [knowledge]);
  useEffect(() => saveNhkPracticeMode(practiceMode), [practiceMode]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { selectedRef.current = selectedSentences; }, [selectedSentences]);

  const todaySession = useMemo(() => findTodayNhkSession(sessions, todayKey), [sessions, todayKey]);
  const recallTarget = useMemo(() => pickRecallTarget(sessions, todayKey), [sessions, todayKey]);
  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);
  const dueKnowledge = useMemo(() => dueNhkKnowledge(knowledge), [knowledge]);
  const grammarCount = useMemo(() => knowledge.filter(item => item.kind === 'grammar').length, [knowledge]);
  const vocabularyCount = knowledge.length - grammarCount;
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

  const filteredKnowledge = useMemo(() => {
    const now = Date.now();
    const query = knowledgeQuery.trim().toLowerCase();
    return knowledge.filter(item => {
      if (knowledgeFilter === 'due' && item.nextReviewAt > now) return false;
      if (knowledgeFilter === 'grammar' && item.kind !== 'grammar') return false;
      if (knowledgeFilter === 'vocabulary' && item.kind !== 'vocabulary') return false;
      return !query
        || item.title.toLowerCase().includes(query)
        || item.reading.toLowerCase().includes(query)
        || item.meaningZh.toLowerCase().includes(query);
    });
  }, [knowledge, knowledgeFilter, knowledgeQuery]);

  const selectedRecommendations = useMemo(
    () => alignCoachRecommendations(coach, selectedSentences, articleSentences),
    [coach, selectedSentences, articleSentences],
  );
  const primaryRecommendation = useMemo(
    () => pickCoachRecommendation(coach, selectedSentences, articleSentences),
    [coach, selectedSentences, articleSentences],
  );

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
      chosen = fallback.recommendations.map(item => item.sentence).slice(0, 3);
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
        const recommended = generated.recommendations.map(item => item.sentence).slice(0, 3);
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
    const selected = sessionSentences(session);
    draftRef.current = session;
    selectedRef.current = selected;
    selectionTouchedRef.current = Boolean(selected.length);
    setDraft(session);
    setSelectedSentences(selected);
    setArticleSentences(candidates);
    setCoach(storedCoach || session.dailyInput?.coach || null);
    setCoachModel(session.dailyInput?.coachModel || '');
    setCoachStatus(storedCoach || session.dailyInput ? 'ready' : 'idle');
    setParseStatus(candidates.length ? 'ready' : 'idle');
    setParseError('');
    setAnalysisFocus(0);
    setShowAllSentences(false);
    setView('study');
  };

  const openToday = () => {
    const existing = todaySession || createNhkSession(todayKey, practiceMode);
    const next = {...existing, practiceMode};
    const record = next.sourceUrl
      ? articles.find(item => item.id === nhkArticleRecordId(next.sourceUrl, next.title))
      : undefined;
    const candidates = record?.sentences?.length
      ? record.sentences
      : next.dailyInput?.candidateSentences?.length
        ? next.dailyInput.candidateSentences
        : sessionSentences(next);
    initializeStudy(next, candidates, record?.coach);
    setStep(next.sourceUrl && candidates.length ? (next.completedAt ? 1 : 0) : 0);
    if (!record?.coach && !next.dailyInput && next.title && candidates.length) {
      void loadCoach(next.title, candidates, next, false);
    }
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
    const next = applyCoachFields({...draftRef.current, practiceMode}, coach, selectedRef.current, articleSentences, coachModel);
    persist(next);
    setAnalysisFocus(0);
    setStep(1);
  };

  const studyCompletionReady = Boolean(
    draft.shadowText.trim()
    && draft.keyExpression.trim()
    && draft.recapText.trim()
    && draft.opinion.trim()
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
    const base = {
      ...resetSessionForSource(createNhkSession(todayKey, practiceMode), record.sourceUrl),
      title: record.title,
    };
    const resolvedCoach = record.coach || buildFallbackCoach(record.title, record.sentences);
    const selected = record.selectedSentences.length
      ? record.selectedSentences
      : resolvedCoach.recommendations.map(item => item.sentence).slice(0, 3);
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
    const blob = new Blob([exportNhkStudyData(articles, knowledge, sessions)], {type: 'application/json;charset=utf-8'});
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
    const sharedUrl = readCapturedSharedMojiUrl(localStorage);
    if (!sharedUrl || sharedHandledRef.current === sharedUrl) return;
    sharedHandledRef.current = sharedUrl;
    clearCapturedSharedMojiUrl(localStorage);
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

        <main className="nhk-recall-studio-card">
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
        </main>
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

        <article className="nhk-article-detail-hero">
          <span>{activeArticle.completedAt ? '已完成精读' : '已保存'}</span>
          <h1>{activeArticle.title}</h1>
          <p>{articleCoach.summaryZh}</p>
          <blockquote>{articleCoach.summaryJa}</blockquote>
          <div><b>{activeArticle.sentences.length}</b><small>正文句子</small><b>{counts.grammar}</b><small>语法点</small><b>{counts.vocabulary}</b><small>单词</small></div>
        </article>

        <div className="nhk-article-detail-actions">
          <button className="primary" onClick={() => studySavedArticle(activeArticle)}><GraduationCap size={18} />继续精读这篇</button>
          <button onClick={() => studySavedArticle(activeArticle, true)}><Sparkles size={18} />重新生成 AI 精讲</button>
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
        <header className="nhk-studio-mainheader">
          <div><small>NHK ARCHIVE</small><h1>文章库</h1><p>每次分享进来的文章都会留在这里。</p></div>
          <button aria-label="导出学习记录" onClick={exportBackup}><Download size={20} /></button>
        </header>

        <label className="nhk-studio-search">
          <Search size={18} />
          <input value={archiveQuery} onChange={event => setArchiveQuery(event.target.value)} placeholder="搜索标题或正文" />
        </label>

        <div className="nhk-library-summary">
          <div><strong>{articles.length}</strong><span>已保存文章</span></div>
          <div><strong>{articles.filter(record => record.completedAt).length}</strong><span>已完成精读</span></div>
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
                  {record.completedAt && <b><Check size={14} />已学完</b>}
                  <ChevronRight size={18} />
                </footer>
              </button>
            );
          })}
          {!filteredArticles.length && (
            <div className="nhk-studio-empty"><FileText size={30} /><strong>还没有匹配的文章</strong><p>从 MOJi 分享一篇 NHK 文章后，会自动保存在这里。</p></div>
          )}
        </div>
        <StudioNav view={view} dueCount={dueKnowledge.length} onChange={setView} />
      </section>
    );
  }

  if (view === 'knowledge') {
    return (
      <section className="nhk-page nhk-studio-page nhk-knowledge-page">
        <header className="nhk-studio-mainheader">
          <div><small>MY KNOWLEDGE</small><h1>收藏复习</h1><p>只复习你亲手留下的语法和单词。</p></div>
          <span>{dueKnowledge.length ? `${dueKnowledge.length} 到期` : '已清空'}</span>
        </header>

        <label className="nhk-studio-search">
          <Search size={18} />
          <input value={knowledgeQuery} onChange={event => setKnowledgeQuery(event.target.value)} placeholder="搜索语法、单词或意思" />
        </label>

        <div className="nhk-knowledge-filters">
          {([
            ['due', `到期 ${dueKnowledge.length}`],
            ['all', `全部 ${knowledge.length}`],
            ['grammar', `语法 ${grammarCount}`],
            ['vocabulary', `单词 ${vocabularyCount}`],
          ] as const).map(([id, label]) => (
            <button key={id} className={knowledgeFilter === id ? 'active' : ''} onClick={() => setKnowledgeFilter(id)}>{label}</button>
          ))}
        </div>

        <div className="nhk-knowledge-list">
          {filteredKnowledge.map(item => {
            const expanded = expandedKnowledgeId === item.id;
            const due = item.nextReviewAt <= Date.now();
            const source = item.sources[0];
            return (
              <article key={item.id} className={`${item.kind} ${due ? 'due' : ''}`}>
                <button className="nhk-knowledge-card-head" onClick={() => setExpandedKnowledgeId(expanded ? '' : item.id)}>
                  <span>{item.kind === 'grammar' ? '文法' : '単語'}</span>
                  <div><strong>{item.title}{item.reading ? <em>（{item.reading}）</em> : null}</strong><p>{item.meaningZh}</p></div>
                  {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                </button>
                <div className="nhk-knowledge-meta">
                  <span><Clock3 size={14} />{due ? '今天复习' : `${formatTimestamp(item.nextReviewAt)} 再见`}</span>
                  <span>掌握度 {item.mastery}/5</span>
                  <span>复习 {item.reviewCount} 次</span>
                </div>
                {expanded && (
                  <div className="nhk-knowledge-expanded">
                    {item.formation && <p><b>接续：</b>{item.formation}</p>}
                    {item.explanationZh && <p>{item.explanationZh}</p>}
                    {item.nuanceZh && <p><b>语感：</b>{item.nuanceZh}</p>}
                    {item.examples.map((example, index) => <blockquote key={`${item.id}-${index}`}><strong>{example.ja}</strong><span>{example.zh}</span></blockquote>)}
                    {source && (
                      <button className="nhk-source-link" onClick={() => openArticle(source.articleId)}><FileText size={16} />来自：{source.articleTitle}<ChevronRight size={16} /></button>
                    )}
                  </div>
                )}
                <footer>
                  <button onClick={() => setKnowledge(current => rateNhkKnowledge(current, item.id, 'again'))}>再复习</button>
                  <button className="remembered" onClick={() => setKnowledge(current => rateNhkKnowledge(current, item.id, 'good'))}>记住了</button>
                  <button aria-label="删除收藏" onClick={() => setKnowledge(current => removeNhkKnowledge(current, item.id))}><Trash2 size={17} /></button>
                </footer>
              </article>
            );
          })}
          {!filteredKnowledge.length && (
            <div className="nhk-studio-empty"><Bookmark size={30} /><strong>{knowledge.length ? '当前筛选没有内容' : '还没有收藏'}</strong><p>在文章精讲里点“收藏复习”，语法和单词就会来到这里。</p></div>
          )}
        </div>
        <StudioNav view={view} dueCount={dueKnowledge.length} onChange={setView} />
      </section>
    );
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
    return (
      <section className="nhk-page nhk-studio-page nhk-study-page">
        <header className="nhk-studio-subheader">
          <button aria-label="返回首页" onClick={() => setView('home')}><ArrowLeft size={22} /></button>
          <div><small>NHK 精读</small><strong>{step + 1}/3 · {step === 0 ? '导入与选句' : step === 1 ? '逐句精讲' : '输出检验'}</strong></div>
          {draft.sourceUrl ? <a href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文"><ExternalLink size={20} /></a> : <span />}
        </header>
        <div className="nhk-studio-progress">{[0, 1, 2].map(index => <i key={index} className={index <= step ? 'active' : ''} />)}</div>
        <NhkPracticeModeSwitch compact value={practiceMode} onChange={changePracticeMode} />

        {step === 0 && (
          <main className="nhk-study-step">
            <div className="nhk-step-intro">
              <span>ARTICLE</span>
              <h1>先把整篇文章留下，再选 1～3 句彻底吃透。</h1>
              <p>正文会在解析成功时立即进入文章库，不必等到完成训练。</p>
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
              <small>{parseStatus === 'loading' ? '正在保存正文并生成重点精讲…' : '从分享菜单进入时会自动解析。'}</small>
            </div>

            {parseStatus === 'error' && <div className="nhk-parse-error">{parseError}</div>}

            {parseStatus === 'ready' && draft.title && (
              <>
                <article className="nhk-parsed-overview">
                  <div><small>已保存到文章库</small><h2>{draft.title}</h2></div>
                  <span><Check size={16} />{articleSentences.length} 句</span>
                  {coach && <><p>{coach.summaryZh}</p><blockquote>{coach.summaryJa}</blockquote></>}
                  <footer><Sparkles size={16} /><span>{coachStatus === 'loading' ? 'AI 正在补全语法、单词和延伸例句' : coachStatus === 'fallback' ? '当前显示本地基础讲解，可稍后重新生成 AI 精讲' : '重点句精讲已准备好'}</span></footer>
                </article>

                <div className="nhk-picker-heading">
                  <div><small>KEY SENTENCES</small><strong>重点句</strong><p>AI 已推荐；你也可以自己更换，最多 3 句。</p></div>
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
              </>
            )}

            <button className="nhk-studio-primary" disabled={!selectedSentences.length} onClick={nextFromInput}>
              开始逐句精读<ChevronRight size={20} />
            </button>
          </main>
        )}

        {step === 1 && (
          <main className="nhk-study-step">
            <div className="nhk-step-intro">
              <span>DEEP READ</span>
              <h1>一层一层拆开，直到这句话没有模糊的地方。</h1>
              <p>整句意思、结构、语法、单词和延伸例句都在同一处；值得记的再手动收藏。</p>
            </div>

            {selectedRecommendations.length > 1 && (
              <div className="nhk-analysis-tabs">
                {selectedRecommendations.map((recommendation, index) => (
                  <button key={`${recommendation.sentenceIndex}-${recommendation.sentence}`} className={analysisFocus === index ? 'active' : ''} onClick={() => setAnalysisFocus(index)}>
                    <span>{index + 1}</span><div><small>{recommendation.label}</small><strong>{recommendation.expression}</strong></div>
                  </button>
                ))}
              </div>
            )}

            {activeRecommendation && (
              <DeepAnalysisCard
                recommendation={activeRecommendation}
                article={studyArticle}
                knowledge={knowledge}
                onToggleKnowledge={toggleKnowledge}
              />
            )}

            <div className="nhk-step-actions nhk-studio-step-actions">
              <button onClick={() => setStep(0)}>重新选句</button>
              <button onClick={() => setStep(2)}>进入输出检验<ChevronRight size={18} /></button>
            </div>
          </main>
        )}

        {step === 2 && (
          <main className="nhk-study-step">
            <div className="nhk-step-intro">
              <span>OUTPUT</span>
              <h1>不看原文，把新闻重新说成你自己的日语。</h1>
              <p>能复述重点、表达自己的看法，才算真正理解。</p>
            </div>

            <article className="nhk-output-brief">
              <small>文章核心</small>
              <h2>{coach?.summaryJa || draft.title}</h2>
              <p>{coach?.summaryZh}</p>
              {primaryRecommendation && (
                <div><span>必须带走</span><strong>{primaryRecommendation.expression}</strong><p>{primaryRecommendation.meaningZh}</p></div>
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
                description="不要照抄原句。先组织，再写 2～4 句。"
                prompt={coach?.summaryZh ? `请复述：${coach.summaryZh}` : undefined}
                value={draft.recapText}
                onChange={value => patch({recapText: value})}
                placeholder="このニュースでは、〜について伝えています。"
                rows={6}
              />
            )}

            <label className="nhk-opinion-answer">
              <span>你的看法</span>
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
              <div className={selectedRecommendations.length ? 'done' : ''}><Check size={16} /><span>精读 {selectedRecommendations.length} 个重点句</span></div>
              <div className={recapReady ? 'done' : ''}><Check size={16} /><span>完成脱稿复述</span></div>
              <div className={draft.opinion.trim() ? 'done' : ''}><Check size={16} /><span>用日语表达看法</span></div>
            </div>

            <div className="nhk-step-actions nhk-studio-step-actions">
              <button onClick={() => setStep(1)}>返回精讲</button>
              <button className="complete" disabled={!studyCompletionReady} onClick={completeToday}><Check size={18} />完成这篇</button>
            </div>
          </main>
        )}
      </section>
    );
  }

  return (
    <section className="nhk-page nhk-studio-page nhk-studio-home">
      <header className="nhk-studio-home-header">
        <div><small>NHK ARTICLE STUDIO</small><h1>NHK 精读</h1><p>每天真正吃透一篇，而不是匆匆看过。</p></div>
        <span>{streak ? `${streak}天连续` : '今天开始'}</span>
      </header>

      <NhkPracticeModeSwitch value={practiceMode} onChange={changePracticeMode} />

      <section className="nhk-home-primary-block">
        <button className={`nhk-studio-main-card ${todaySession?.completedAt ? 'done' : ''}`} onClick={openToday}>
          <div>{todaySession?.completedAt ? <Check size={29} /> : <Headphones size={29} />}</div>
          <section>
            <small>{todaySession?.completedAt ? 'TODAY COMPLETE' : todaySession?.sourceUrl ? 'CONTINUE TODAY' : 'TODAY'}</small>
            <strong>{todaySession?.title || '导入今天的 NHK 文章'}</strong>
            <span>{todaySession?.completedAt ? '可以继续回看精讲或开始下一篇' : todaySession?.sourceUrl ? '继续选句、精讲与输出检验' : '保存全文 · AI 逐句讲解 · 收藏复习'}</span>
          </section>
          <ChevronRight size={22} />
        </button>
        <button className="nhk-new-article-button" onClick={startNewArticle}><Link2 size={18} />导入另一篇文章</button>
      </section>

      {(recallTarget || dueKnowledge.length > 0) && (
        <section className="nhk-studio-priority">
          <div className="nhk-home-section-title"><div><small>NOW</small><strong>现在最值得复习</strong></div></div>
          {recallTarget && (
            <button onClick={openRecall}>
              <RotateCcw size={21} />
              <div><small>第{recallTarget.intervalDay}天 · {formatDate(recallTarget.session.dateKey)}</small><strong>{recallTarget.titleZh}</strong><span>{recallTarget.session.title}</span></div>
              <ChevronRight size={19} />
            </button>
          )}
          {dueKnowledge.length > 0 && (
            <button onClick={() => { setKnowledgeFilter('due'); setView('knowledge'); }}>
              <Brain size={21} />
              <div><small>收藏复习</small><strong>{dueKnowledge.length} 个语法或单词到期</strong><span>只复习你亲手收藏的内容</span></div>
              <ChevronRight size={19} />
            </button>
          )}
        </section>
      )}

      <section className="nhk-studio-dashboard">
        <button onClick={() => setView('archive')}><Library size={22} /><strong>{articles.length}</strong><span>文章</span></button>
        <button onClick={() => { setKnowledgeFilter('grammar'); setView('knowledge'); }}><ListChecks size={22} /><strong>{grammarCount}</strong><span>语法</span></button>
        <button onClick={() => { setKnowledgeFilter('vocabulary'); setView('knowledge'); }}><Bookmark size={22} /><strong>{vocabularyCount}</strong><span>单词</span></button>
      </section>

      {articles.length > 0 && (
        <section className="nhk-home-archive-preview">
          <div className="nhk-home-section-title">
            <div><small>ARCHIVE</small><strong>最近的文章</strong></div>
            <button onClick={() => setView('archive')}>查看全部<ChevronRight size={16} /></button>
          </div>
          <div>
            {articles.slice(0, 5).map(record => (
              <button key={record.id} onClick={() => openArticle(record.id)}>
                <span>{formatTimestamp(record.importedAt)}</span>
                <div><strong>{record.title}</strong><small>{record.coach?.summaryZh || `${record.sentences.length} 个正文句子`}</small></div>
                {record.completedAt ? <Check size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
          </div>
        </section>
      )}

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

      <StudioNav view={view} dueCount={dueKnowledge.length} onChange={setView} />
    </section>
  );
}
