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
  Mic2,
  RotateCcw,
  Share2,
  Smartphone,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import {api} from './api';
import type {Story} from './content';
import NhkWorldEvent, {type NhkWorldEventMode} from './NhkWorldEvent';
import {
  NhkRecordingCoach,
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
  pickNhkWorldCallbackTarget,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  syncNhkDailyInputUserFields,
  toDateKey,
  upsertNhkSession,
} from './nhkMorning';
import {
  blobToBoundedBase64,
  estimateBase64Length,
  isSupportedSpeechMimeType,
  MAX_AUDIO_BASE64_LENGTH,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_SECONDS,
  normalizeSpeechMimeType,
  parseNhkSpeechFeedback,
  type NhkRecapSpeechFeedback,
  type NhkShadowSpeechFeedback,
  type NhkSpeechFeedbackMode,
} from './nhkSpeechFeedback';
import {
  clearCapturedSharedMojiUrl,
  readCapturedSharedMojiUrl,
} from './shareTarget';
import './nhkMorning.css';

type VoiceRecorderProps = {
  label: string;
  onDuration: (seconds: number) => void;
  targetHint?: string;
  analyzeLabel?: string;
  onAnalyze?: (recording: VoiceRecording) => Promise<void>;
  onDiscard?: () => void;
};

type RecorderState = 'idle' | 'recording' | 'ready' | 'error';
type RecorderAnalysisState = 'idle' | 'loading' | 'done';
type ArticleParseStatus = 'idle' | 'loading' | 'ready' | 'error';
type CoachStatus = 'idle' | 'loading' | 'ready' | 'fallback';

type VoiceRecording = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};

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

type NhkSpeechFeedbackResponse = {
  ok?: boolean;
  feedback?: unknown;
  model?: string;
  usedFallback?: boolean;
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
  speechFeedbackVersion: undefined,
  shadowFeedback: undefined,
  recapFeedback: undefined,
  completedAt: undefined,
});

const preferredRecorderMimeType = (): string => {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return candidates.find(value => MediaRecorder.isTypeSupported(value)) || '';
};

function VoiceRecorder({label, onDuration, targetHint, analyzeLabel, onAnalyze, onDiscard}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [analysisState, setAnalysisState] = useState<RecorderAnalysisState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const replaceAudioUrl = (next: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = next;
    setAudioUrl(next);
  };

  useEffect(() => () => {
    stopTimer();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopStream();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    blobRef.current = null;
  }, []);

  const discardRecording = () => {
    replaceAudioUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
    setState('idle');
    setAnalysisState('idle');
    setError('');
    setNotice('');
    onDuration(0);
    onDiscard?.();
  };

  const start = async () => {
    if (blobRef.current || audioUrlRef.current) discardRecording();
    setError('');
    setNotice('');
    setAnalysisState('idle');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('这个浏览器暂时不能录音。你仍可在下方手动填写实际说出的内容。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mimeType = preferredRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setSeconds(0);
      setState('recording');
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        const duration = Math.min(MAX_RECORDING_SECONDS, Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, {type: recorder.mimeType || 'audio/webm'});
        recorderRef.current = null;
        chunksRef.current = [];
        if (!isSupportedSpeechMimeType(blob.type)) {
          blobRef.current = null;
          setState('error');
          setError('这个录音格式暂时不能分析，请换浏览器或重新录制。');
          onDuration(0);
          stopStream();
          return;
        }
        if (blob.size <= 0) {
          blobRef.current = null;
          setState('error');
          setError('没有录到声音，请重新录制。');
          onDuration(0);
          stopStream();
          return;
        }
        if (blob.size > MAX_AUDIO_BYTES || estimateBase64Length(blob.size) > MAX_AUDIO_BASE64_LENGTH) {
          blobRef.current = null;
          setState('error');
          setError('录音超过约 2 MB 的分析请求上限，请缩短后重新录制。');
          onDuration(0);
          stopStream();
          return;
        }
        blobRef.current = blob;
        const nextUrl = URL.createObjectURL(blob);
        replaceAudioUrl(nextUrl);
        setSeconds(duration);
        setState('ready');
        onDuration(duration);
        stopStream();
      };
      recorder.onerror = () => {
        stopTimer();
        stopStream();
        recorderRef.current = null;
        chunksRef.current = [];
        blobRef.current = null;
        setState('error');
        setError('录音发生错误，请重新录制。');
        onDuration(0);
      };
      recorder.start(250);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(Math.min(MAX_RECORDING_SECONDS, elapsed));
        if (elapsed >= MAX_RECORDING_SECONDS && recorder.state === 'recording') {
          setNotice('已到 60 秒上限，录音已自动停止。');
          recorder.stop();
        }
      }, 250);
    } catch {
      stopTimer();
      stopStream();
      setState('error');
      setError('没有取得麦克风权限。');
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const analyze = async () => {
    const blob = blobRef.current;
    if (!blob || !onAnalyze || state !== 'ready') return;
    setError('');
    setAnalysisState('loading');
    try {
      await onAnalyze({
        blob,
        mimeType: normalizeSpeechMimeType(blob.type),
        durationSeconds: seconds,
      });
      setAnalysisState('done');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '分析失败，请稍后重试。';
      setError(message);
      setAnalysisState('idle');
    }
  };

  return (
    <div className={`nhk-recorder ${onAnalyze ? 'analyzable' : ''}`.trim()}>
      <div>
        <strong>{label}</strong>
        <small>{state === 'recording' ? `${seconds}/60秒` : state === 'ready' ? `${seconds}秒 · ${Math.ceil((blobRef.current?.size || 0) / 1024)} KB` : targetHint || '录音只在本次页面临时使用'}</small>
      </div>
      {state === 'recording' ? (
        <button className="recording" onClick={stop}><Square size={17} fill="currentColor" />停止</button>
      ) : (
        <button disabled={analysisState === 'loading'} onClick={start}><Mic2 size={17} />{state === 'ready' ? '再录一次' : '开始录音'}</button>
      )}
      {onAnalyze && <p className="nhk-recorder-consent">停止录音不会上传。只有点击“{analyzeLabel || '分析'}”后，这段所选录音才会临时上传用于分析；服务端不会存储原始音频。</p>}
      {audioUrl && <audio controls src={audioUrl} />}
      {state === 'ready' && onAnalyze && (
        <button className="recorder-analyze" disabled={analysisState === 'loading'} onClick={analyze}>
          {analysisState === 'loading' ? <LoaderCircle className="nhk-spin" size={15} /> : <Sparkles size={15} />}
          {analysisState === 'loading' ? '正在分析' : analysisState === 'done' ? '重新分析' : analyzeLabel || '分析'}
        </button>
      )}
      {state === 'ready' && <button className="recorder-reset" disabled={analysisState === 'loading'} onClick={discardRecording}><RotateCcw size={14} />清除录音</button>}
      {analysisState === 'done' && <small className="nhk-recorder-done">分析完成；原始录音仍只保留在本页，清除或重录会立即丢弃。</small>}
      {notice && <p className="nhk-recorder-notice">{notice}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}

const speechErrorMessage = (reason: string): string => {
  if (reason === 'daily_quota' || reason === 'client_quota') return '今天的语音分析额度已用完。录音仍未上传保存，你可以手动填写后继续。';
  if (reason === 'transcription_failed') return '没有取得可靠的日语转写。请靠近麦克风并缩短后重试。';
  if (reason === 'speech_timeout') return '语音分析超时。录音仍留在本页，可以直接重试。';
  if (reason === 'invalid_input' || reason === 'content_type') return '录音格式、时长或大小不符合分析要求，请重新录制。';
  return '语音分析暂时不可用。录音仍留在本页，你可以重试或手动填写。';
};

function ShadowFeedbackCard({feedback}: {feedback: NhkShadowSpeechFeedback}) {
  return (
    <div className="nhk-speech-feedback shadow">
      <div><small>实际转写</small><strong>{feedback.transcript}</strong></div>
      <section>
        <span>漏说</span>
        <p>{feedback.omissions.length ? feedback.omissions.join(' ／ ') : '没有检出明确漏说'}</p>
      </section>
      <section>
        <span>替换</span>
        <p>{feedback.substitutions.length
          ? feedback.substitutions.map(item => `「${item.expected}」→「${item.heard}」`).join(' ／ ')
          : '没有检出明确替换'}</p>
      </section>
      <section>
        <span>助词</span>
        <p>{feedback.particleIssues.length
          ? feedback.particleIssues.map(item => `「${item.expected}」→「${item.heard}」（${item.context}）`).join(' ／ ')
          : '没有检出明确助词问题'}</p>
      </section>
      <blockquote>{feedback.retryTip}</blockquote>
      <small className="nhk-secondary-metric">文字一致度 {feedback.accuracyPercent}% · 仅作辅助，不是发音分数</small>
    </div>
  );
}

function RecapFeedbackCard({feedback}: {feedback: NhkRecapSpeechFeedback}) {
  return (
    <div className="nhk-speech-feedback recap">
      <div><small>实际转写</small><strong>{feedback.transcript}</strong></div>
      <section><span>最小修改</span><p lang="ja">{feedback.minimalRevision}</p></section>
      <section><span>更自然的口语</span><p lang="ja">{feedback.naturalJapanese}</p></section>
      <section><span>缺少的信息</span><p>{feedback.missingFacts.length ? feedback.missingFacts.join(' ／ ') : '主要信息已覆盖'}</p></section>
      <section><span>连接</span><p>{feedback.linkageFeedback}</p></section>
      <section><span>自然度</span><p>{feedback.naturalnessFeedback}</p></section>
      {feedback.usedFallback && <small className="nhk-secondary-metric">本次为转写后的确定性文字对照；未生成扩展教练建议。</small>}
    </div>
  );
}
type NhkMorningPageProps = {
  worldStory: Story | null;
  onEnterWorld: () => void;
};

type PageView = 'home' | 'today' | 'recall' | 'world';

export default function NhkMorningPage({worldStory, onEnterWorld}: NhkMorningPageProps) {
  const todayKey = toDateKey();
  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());
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
  const [worldSessionId, setWorldSessionId] = useState('');
  const [worldMode, setWorldMode] = useState<NhkWorldEventMode>('event');
  const [articleSentences, setArticleSentences] = useState<string[]>(initialCandidates);
  const [selectedSentences, setSelectedSentences] = useState<string[]>(initialSentences);
  const [parseStatus, setParseStatus] = useState<ArticleParseStatus>(initialCandidates.length ? 'ready' : 'idle');
  const [parseError, setParseError] = useState('');
  const [coach, setCoach] = useState<NhkCoachResult | null>(initialInput?.coach || null);
  const [coachStatus, setCoachStatus] = useState<CoachStatus>(initialInput ? 'ready' : 'idle');
  const [coachModel, setCoachModel] = useState(initialInput?.coachModel || '');
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'playing' | 'error'>('idle');
  const [showShareHelp, setShowShareHelp] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState('');
  const draftRef = useRef(draft);
  const selectedRef = useRef(selectedSentences);
  const parseRequestRef = useRef(0);
  const coachRequestRef = useRef(0);
  const speechRequestRef = useRef(0);
  const selectionTouchedRef = useRef(false);
  const sharedHandledRef = useRef('');

  useEffect(() => saveNhkSessions(sessions), [sessions]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { selectedRef.current = selectedSentences; }, [selectedSentences]);

  const todaySession = useMemo(() => findTodayNhkSession(sessions, todayKey), [sessions, todayKey]);
  const recallTarget = useMemo(() => pickRecallTarget(sessions, todayKey), [sessions, todayKey]);
  const recallSession = recallTarget?.session || null;
  const worldCallbackTarget = useMemo(() => pickNhkWorldCallbackTarget(sessions, todayKey), [sessions, todayKey]);
  const activeWorldSession = useMemo(() => sessions.find(session => session.id === worldSessionId) || null, [sessions, worldSessionId]);
  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);
  const recent = useMemo(() => sessions.filter(session => session.completedAt).slice(0, 3), [sessions]);
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);

  const persist = (next: NhkMorningSession) => {
    draftRef.current = next;
    setDraft(next);
    setSessions(current => upsertNhkSession(current, next));
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
  const primarySentence = primaryRecommendation?.sentence || selectedSentences[0] || '';
  const primarySentenceRef = useRef(primarySentence);

  useEffect(() => { primarySentenceRef.current = primarySentence; }, [primarySentence]);

  useEffect(() => () => {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, []);

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
    speechRequestRef.current += 1;
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
      speechFeedbackVersion: undefined,
      shadowFeedback: undefined,
      recapFeedback: undefined,
      completedAt: undefined,
    };
    persist(applyCoachFields(resetOutput, coach, nextSelected, articleSentences, coachModel));
  };

  const nextFromInput = () => {
    const next = applyCoachFields(draftRef.current, coach, selectedRef.current, articleSentences, coachModel);
    persist(next);
    setStep(1);
  };

  const playPrimarySentence = () => {
    setPlaybackStatus('idle');
    if (!primarySentence || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      setPlaybackStatus('error');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(primarySentence);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.88;
    const japaneseVoice = speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;
    utterance.onend = () => setPlaybackStatus('idle');
    utterance.onerror = () => setPlaybackStatus('error');
    setPlaybackStatus('playing');
    speechSynthesis.speak(utterance);
  };

  const analyzeSpeech = async (mode: NhkSpeechFeedbackMode, recording: VoiceRecording) => {
    if (!primarySentence) throw new Error('没有可对照的原句，请返回上一步重新选择。');
    const request = ++speechRequestRef.current;
    const expectedText = primarySentence;
    const sessionId = draftRef.current.id;
    const sourceUrl = draftRef.current.sourceUrl;
    const contextText = [draftRef.current.title, ...selectedRef.current].filter(Boolean).join('\n');
    try {
      const audioBase64 = await blobToBoundedBase64(recording.blob);
      const {data} = await api.post<NhkSpeechFeedbackResponse>('/api/nhk-speech-feedback', {
        mode,
        mimeType: recording.mimeType,
        durationSeconds: recording.durationSeconds,
        expectedText,
        contextText,
        audioBase64,
      });
      if (!data?.ok) throw new Error(data?.reason || 'speech_unavailable');
      const feedback = parseNhkSpeechFeedback(data.feedback, mode);
      if (!feedback || feedback.expectedText !== expectedText) throw new Error('invalid_feedback');
      if (request !== speechRequestRef.current || draftRef.current.id !== sessionId
        || draftRef.current.sourceUrl !== sourceUrl || primarySentenceRef.current !== expectedText) return;
      if (feedback.mode === 'shadow') {
        patch({
          speechFeedbackVersion: 1,
          shadowRecordingSeconds: recording.durationSeconds,
          shadowFeedback: feedback,
        });
      } else {
        patch({
          speechFeedbackVersion: 1,
          recapRecordingSeconds: recording.durationSeconds,
          recapFeedback: feedback,
          recapText: feedback.transcript,
        });
      }
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : 'speech_unavailable';
      if (/[　-鿿]/.test(reason)) throw caught;
      throw new Error(speechErrorMessage(reason));
    }
  };

  const discardShadowFeedback = () => {
    speechRequestRef.current += 1;
    patch({
      shadowFeedback: undefined,
      speechFeedbackVersion: draftRef.current.recapFeedback ? 1 : undefined,
    });
  };

  const discardRecapFeedback = () => {
    speechRequestRef.current += 1;
    const hadFeedback = Boolean(draftRef.current.recapFeedback);
    patch({
      recapFeedback: undefined,
      recapText: hadFeedback ? '' : draftRef.current.recapText,
      speechFeedbackVersion: draftRef.current.shadowFeedback ? 1 : undefined,
    });
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

  if (view === 'recall' && recallSession) {
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={20} /></button>
          <div><small>第{recallTarget?.intervalDay || 1}天回忆</small><strong>先说，再看答案</strong></div>
          <span />
        </header>
        <div className="nhk-recall-stage">
          <small>{formatDate(recallSession.dateKey)} · 第{recallTarget?.intervalDay || 1}天 · {recallSession.title || 'NHK日语听力'}</small>
          <h1>不用看原文，先说出最值得带走的一句。</h1>
          <p>再用这句话，说一句和你工作或生活有关的话。</p>
          <NhkRecordingCoach
            label="20秒无提示回忆"
            mode="recall"
            referenceText={recallSession.keyExpression}
            summary={recallSession.dailyInput?.coach.summaryJa || recallSession.title}
            question={`第${recallTarget?.intervalDay || 1}天，把这句迁移到工作或生活。`}
            targetExpression={recallSession.keyExpression}
            review={recallReview}
            onDuration={setRecallSeconds}
            onReview={setRecallReview}
          />
          {!recallRevealed ? (
            <button className="nhk-secondary-action" onClick={() => setRecallRevealed(true)}>说完了，查看答案</button>
          ) : (
            <div className="nhk-recall-answer">
              <small>第{recallTarget?.intervalDay || 1}天要想起</small>
              <strong>{recallSession.keyExpression}</strong>
              {recallSession.workVersion && <p>{recallSession.workVersion}</p>}
              <div className="nhk-rating">
                <button onClick={() => finishRecall('miss')}>没想起</button>
                <button onClick={() => finishRecall('close')}>差一点</button>
                <button onClick={() => finishRecall('good')}>说出来了</button>
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

            {primarySentence && (
              <div className="nhk-shadow-guide">
                <div><small>{primaryRecommendation ? '今日核心 · ' : ''}原句跟读</small><strong>{primarySentence}</strong></div>
                {primaryRecommendation && (
                  <>
                    <div className="nhk-chunks">
                      {primaryRecommendation.chunks.map((chunk, index) => <span key={`${index}-${chunk}`}>{chunk}</span>)}
                    </div>
                    <p><b>{primaryRecommendation.expression}</b><span>{primaryRecommendation.meaningZh}</span></p>
                  </>
                )}
                <button className="nhk-play-source" type="button" onClick={playPrimarySentence}>
                  <Volume2 size={16} />{playbackStatus === 'playing' ? '正在播放原句' : '播放短句（日本语 TTS）'}
                </button>
                {playbackStatus === 'error' && <small className="nhk-playback-error">此浏览器无法播放语音；仍可看原句跟读或使用手动复述。</small>}
              </div>
            )}

            <div className="nhk-speech-stage-head"><small>1 · SHADOW</small><strong>跟着原句说一遍</strong><span>先听短句，再录下同一句；停止后由你决定是否上传分析。</span></div>
            <VoiceRecorder
              key={`shadow-${draft.id}-${primarySentence}`}
              label="原句跟读"
              targetHint="建议 5～15 秒 · 最长 60 秒"
              analyzeLabel="分析跟读"
              onDuration={seconds => patch({shadowRecordingSeconds: seconds})}
              onAnalyze={recording => analyzeSpeech('shadow', recording)}
              onDiscard={discardShadowFeedback}
            />
            {draft.shadowFeedback?.expectedText === primarySentence && <ShadowFeedbackCard feedback={draft.shadowFeedback} />}

            <div className="nhk-speech-stage-head recap"><small>2 · RECAP</small><strong>关掉原文，脱稿复述</strong><span>用 20～40 秒说出你真正理解的内容；不要照抄，也不用追求完整。</span></div>
            <VoiceRecorder
              key={`recap-${draft.id}-${primarySentence}`}
              label="20～40 秒脱稿复述"
              targetHint="建议 20～40 秒 · 最长 60 秒"
              analyzeLabel="分析复述"
              onDuration={seconds => patch({recapRecordingSeconds: seconds})}
              onAnalyze={recording => analyzeSpeech('recap', recording)}
              onDiscard={discardRecapFeedback}
            />
            {draft.recapFeedback?.expectedText === primarySentence && <RecapFeedbackCard feedback={draft.recapFeedback} />}
            <label>我刚才真正说出来的内容
              <textarea
                value={draft.recapText}
                onChange={event => patch({
                  recapText: event.target.value,
                  recapFeedback: undefined,
                  speechFeedbackVersion: draftRef.current.shadowFeedback ? 1 : undefined,
                })}
                placeholder="语音分析后会自动填入实际转写；浏览器不支持录音时，可在这里手动填写"
                rows={5}
              />
            </label>
            <button className="nhk-text-toggle" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? '收起原句' : '说完后看原句'}</button>
            {showOriginal && <blockquote>{primarySentence}</blockquote>}
            <div className="nhk-step-actions"><button onClick={() => setStep(0)}>上一步</button><button disabled={!draft.recapText.trim()} onClick={() => setStep(2)}>用进世界</button></div>
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
          <div><small>第{recallTarget?.intervalDay || 1}天回忆</small><strong>先说，再看答案</strong></div>
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
