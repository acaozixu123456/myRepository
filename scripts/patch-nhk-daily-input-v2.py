from pathlib import Path
import re

path = Path('src/NhkMorningPage.tsx')
text = path.read_text(encoding='utf-8')


def one(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


def block(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, found {count}')

one(
"""import {
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  NhkMorningSession,
  NhkRecallRating,
  pickRecallSession,
  saveNhkSessions,
  suggestExpression,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';""",
"""import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  markNhkDailyInputUsedInWorld,
  NhkMorningSession,
  NhkRecallRating,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  syncNhkDailyInputUserFields,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';""",
'imports')

one("  selectedSentences: [],\n  recapText: '',", "  selectedSentences: [],\n  dailyInput: undefined,\n  recapText: '',", 'reset input')
one("  worldRecordingSeconds: 0,\n  completedAt: undefined,", "  worldRecordingSeconds: 0,\n  recallAttempts: [],\n  recall: undefined,\n  completedAt: undefined,", 'reset recall')
one(
"""  const initialSentences = sessionSentences(draft);
  const [view, setView] = useState<PageView>('home');""",
"""  const initialSentences = sessionSentences(draft);
  const initialInput = draft.dailyInput;
  const initialCandidates = initialInput?.candidateSentences?.length ? initialInput.candidateSentences : initialSentences;
  const [view, setView] = useState<PageView>('home');""",
'initial input')
one("useState<string[]>(initialSentences);\n  const [selectedSentences", "useState<string[]>(initialCandidates);\n  const [selectedSentences", 'candidate state')
one("useState<ArticleParseStatus>(initialSentences.length ? 'ready' : 'idle');", "useState<ArticleParseStatus>(initialCandidates.length ? 'ready' : 'idle');", 'parse state')
one("useState<NhkCoachResult | null>(null);\n  const [coachStatus, setCoachStatus] = useState<CoachStatus>('idle');", "useState<NhkCoachResult | null>(initialInput?.coach || null);\n  const [coachStatus, setCoachStatus] = useState<CoachStatus>(initialInput ? 'ready' : 'idle');\n  const [coachModel, setCoachModel] = useState(initialInput?.coachModel || '');", 'coach state')
one("  const recallSession = useMemo(() => pickRecallSession(sessions, todayKey), [sessions, todayKey]);", "  const recallTarget = useMemo(() => pickRecallTarget(sessions, todayKey), [sessions, todayKey]);\n  const recallSession = recallTarget?.session || null;", 'recall target')
one("  const patch = (values: Partial<NhkMorningSession>) => persist({...draftRef.current, ...values});", "  const patch = (values: Partial<NhkMorningSession>) =>\n    persist(syncNhkDailyInputUserFields({...draftRef.current, ...values}));", 'patch sync')
one("() => pickCoachRecommendation(coach, selectedSentences),\n    [coach, selectedSentences],", "() => pickCoachRecommendation(coach, selectedSentences, articleSentences),\n    [coach, selectedSentences, articleSentences],", 'primary alignment')

block(
    r"  const applyCoachFields = \([\s\S]*?\n  const loadCoach = async \(",
"""  const applyCoachFields = (
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

  const loadCoach = async (""",
    'apply coach block')

block(
    r"  const loadCoach = async \([\s\S]*?\n  const openToday = \(\) => \{",
"""  const loadCoach = async (
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

  const openToday = () => {""",
    'load coach block')

block(
    r"  const openToday = \(\) => \{[\s\S]*?\n  const changeSourceUrl = \(sourceUrl: string\) => \{",
"""  const openToday = () => {
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

  const changeSourceUrl = (sourceUrl: string) => {""",
    'open today block')

text = text.replace("setCoach(null);\n    setCoachStatus('idle');", "setCoach(null);\n    setCoachModel('');\n    setCoachStatus('idle');")

block(
    r"  const toggleSentence = \(sentence: string\) => \{[\s\S]*?\n  const nextFromInput = \(\) => \{",
"""  const toggleSentence = (sentence: string) => {
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
      recapRecordingSeconds: 0,
      worldRecordingSeconds: 0,
      recallAttempts: [],
      completedAt: undefined,
    };
    persist(applyCoachFields(resetOutput, coach, nextSelected, articleSentences, coachModel));
  };

  const nextFromInput = () => {""",
    'toggle block')

one("const next = applyCoachFields(draftRef.current, coach, selectedRef.current);", "const next = applyCoachFields(draftRef.current, coach, selectedRef.current, articleSentences, coachModel);", 'next input')
one("const next = {...draftRef.current, completedAt: Date.now()};", "const next = markNhkDailyInputUsedInWorld({...draftRef.current, completedAt: Date.now()});", 'complete')

block(
    r"  const finishRecall = \(rating: NhkRecallRating\) => \{[\s\S]*?\n  const copyShortcutBase = async \(\) => \{",
"""  const finishRecall = (rating: NhkRecallRating) => {
    if (!recallSession || !recallTarget) return;
    const next = recordNhkRecallAttempt(recallSession, recallTarget, todayKey, rating, recallSeconds);
    setSessions(current => upsertNhkSession(current, next));
    setView('home');
  };

  const copyShortcutBase = async () => {""",
    'finish recall block')

if text.count("<small>昨日の一文</small>") != 2:
    raise SystemExit('recall labels changed unexpectedly')
text = text.replace("<small>昨日の一文</small>", "<small>第{recallTarget?.intervalDay || 1}天回忆</small>")
one("{formatDate(recallSession.dateKey)} · {recallSession.title || 'NHK日语听力'}", "{formatDate(recallSession.dateKey)} · 第{recallTarget?.intervalDay || 1}天 · {recallSession.title || 'NHK日语听力'}", 'recall detail')
one("标题、正文、推荐句和迁移表达都会自动准备；你只负责确认今天练哪 1～3 句。", "标题、正文和迁移表达都会自动准备。第 1 句完整训练，其余最多两句进入轻量跟读和后续回忆。", 'choose copy')
one("已自动勾选，可自由更换，最多 3 句", "第 1 句是今日核心，可自由更换，最多 3 句", 'picker copy')
one("const recommendation = recommendationFor(sentence);\n                    return (", "const recommendation = recommendationFor(sentence);\n                    const selectedOrder = selectedSentences.indexOf(sentence);\n                    return (", 'selection order')
one("{recommendation && <small><b>{recommendation.label}</b>{recommendation.reasonZh}</small>}", "{(recommendation || selectedOrder >= 0) && <small><b>{selectedOrder === 0 ? '今日核心' : selectedOrder > 0 ? '补充句' : recommendation?.label}</b>{selectedOrder === 0 ? '完整训练这句' : selectedOrder > 0 ? '轻量跟读，之后再遇' : recommendation?.reasonZh}</small>}", 'selection badge')
one("用这{selectedSentences.length || ''}句开始", "完整训练第 1 句", 'CTA')
one("{primaryRecommendation.label} · 影子切分", "今日核心 · 影子切分", 'shadow label')

path.write_text(text, encoding='utf-8')
