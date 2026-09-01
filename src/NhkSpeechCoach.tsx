import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Mic2,
  Play,
  RotateCcw,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import {api} from './api';

export type NhkSpeechMode = 'shadow' | 'recap' | 'world' | 'recall';

export type NhkSpeechDifference = {
  heard: string;
  expected: string;
  noteZh: string;
};

export type NhkSpeechOmission = {
  expected: string;
  noteZh: string;
};

export type NhkSpeechReview = {
  id: string;
  mode: NhkSpeechMode;
  transcript: string;
  summaryZh: string;
  strengthsZh: string[];
  omissions: NhkSpeechOmission[];
  substitutions: NhkSpeechDifference[];
  particles: NhkSpeechDifference[];
  pauseAdviceZh: string[];
  minimalRevisionJa: string;
  naturalVersionJa: string;
  characterReactionJa: string;
  characterReactionZh: string;
  metrics: {
    textAccuracy: number;
    contentScore: number;
    omissionRate: number;
    substitutionCount: number;
    particleIssueCount: number;
    targetExpressionUsed: boolean;
    charactersPerSecond: number;
  };
  analyzedAt: number;
  transcriptionModel: string;
  feedbackModel: string;
};

type SpeechResponse = {
  ok?: boolean;
  url?: string;
  review?: NhkSpeechReview;
  reason?: string;
};

type CaptionMode = 'hidden' | 'delayed' | 'shown';
type RecorderState = 'idle' | 'recording' | 'ready' | 'analyzing' | 'error';

const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const ttsCache = new Map<string, string>();

const supportedRecorderMime = (): string => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ].find(value => MediaRecorder.isTypeSupported(value)) || '';
};

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('audio_read_failed'));
  reader.onload = () => {
    const value = typeof reader.result === 'string' ? reader.result : '';
    const encoded = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
    encoded ? resolve(encoded) : reject(new Error('audio_read_failed'));
  };
  reader.readAsDataURL(blob);
});

const errorCopy = (reason: string): string => {
  if (reason.includes('quota')) return '今天的语音分析次数已用完，录音仍可在本页回放。';
  if (reason.includes('invalid_audio_size')) return '录音太短或太长，请控制在 1～90 秒内。';
  if (reason.includes('transcription')) return '这次没有听清，请靠近麦克风再说一次。';
  if (reason.includes('timeout')) return '分析超时，录音仍保留在本页，可以重新提交。';
  return '语音服务暂时没有完成，请稍后重新提交本次录音。';
};

export function NhkSentencePlayer({
  sentence,
  chunks,
}: {
  sentence: string;
  chunks: string[];
}) {
  const [rate, setRate] = useState(1);
  const [captionMode, setCaptionMode] = useState<CaptionMode>('delayed');
  const [captionVisible, setCaptionVisible] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const captionTimerRef = useRef<number | null>(null);

  const clearCaptionTimer = () => {
    if (captionTimerRef.current !== null) {
      window.clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    requestRef.current += 1;
    clearCaptionTimer();
    audioRef.current?.pause();
  }, []);

  const playText = async (text: string) => {
    if (!text || busyText) return;
    const request = ++requestRef.current;
    clearCaptionTimer();
    setError('');
    setBusyText(text);
    setCaptionVisible(captionMode === 'shown');
    if (captionMode === 'delayed') {
      captionTimerRef.current = window.setTimeout(() => setCaptionVisible(true), 1600);
    }

    const player = new Audio(SILENT_WAV);
    player.preload = 'auto';
    player.loop = true;
    audioRef.current?.pause();
    audioRef.current = player;
    try { await player.play(); } catch { /* user gesture may be retained after the request */ }

    try {
      let url = ttsCache.get(text);
      if (!url) {
        const {data} = await api.post<SpeechResponse>('/api/nhk-speech', {action: 'tts', text});
        if (!data?.ok || !data.url) throw new Error(data?.reason || 'tts_failed');
        url = data.url;
        ttsCache.set(text, url);
      }
      if (request !== requestRef.current) return;
      player.pause();
      player.loop = false;
      player.src = url;
      player.currentTime = 0;
      player.playbackRate = rate;
      player.onended = () => {
        if (request === requestRef.current) setBusyText('');
      };
      await player.play();
    } catch (failure) {
      if (request !== requestRef.current) return;
      player.pause();
      setBusyText('');
      const reason = failure instanceof Error ? failure.message : 'tts_failed';
      setError(errorCopy(reason));
    }
  };

  const setCaptions = (mode: CaptionMode) => {
    clearCaptionTimer();
    setCaptionMode(mode);
    setCaptionVisible(mode === 'shown');
  };

  return (
    <div className="nhk-sentence-player">
      <div className="nhk-player-head">
        <div><small>短句集中训练</small><strong>先听，再跟</strong></div>
        <div className="nhk-speed-picker" aria-label="播放速度">
          {[0.8, 0.9, 1].map(value => (
            <button key={value} className={rate === value ? 'active' : ''} onClick={() => setRate(value)}>{value}×</button>
          ))}
        </div>
      </div>

      <button className="nhk-play-main" disabled={Boolean(busyText)} onClick={() => void playText(sentence)}>
        {busyText === sentence ? <LoaderCircle className="nhk-spin" size={19} /> : <Volume2 size={19} />}
        {busyText === sentence ? '播放中…' : '播放整句'}
      </button>

      <div className="nhk-caption-picker">
        <button className={captionMode === 'hidden' ? 'active' : ''} onClick={() => setCaptions('hidden')}><EyeOff size={14} />盲听</button>
        <button className={captionMode === 'delayed' ? 'active' : ''} onClick={() => setCaptions('delayed')}><Play size={14} />延迟字幕</button>
        <button className={captionMode === 'shown' ? 'active' : ''} onClick={() => setCaptions('shown')}><Eye size={14} />显示</button>
      </div>

      <div className={`nhk-player-caption ${captionVisible ? 'visible' : ''}`} aria-live="polite">
        {captionVisible ? sentence : '字幕已隐藏。先抓住词的边界和语流。'}
      </div>

      <div className="nhk-segment-player">
        <small>分段循环</small>
        <div>{chunks.map((chunk, index) => (
          <button key={`${index}-${chunk}`} disabled={Boolean(busyText)} onClick={() => void playText(chunk)}>
            {busyText === chunk ? <LoaderCircle className="nhk-spin" size={13} /> : index + 1}
            <span>{chunk}</span>
          </button>
        ))}</div>
      </div>
      {error && <p className="nhk-speech-error">{error}</p>}
    </div>
  );
}

const ReviewList = ({title, items}: {title: string; items: string[]}) => items.length ? (
  <div className="nhk-review-list"><small>{title}</small>{items.map((item, index) => <p key={`${index}-${item}`}>{item}</p>)}</div>
) : null;

export function NhkSpeechReviewPanel({review}: {review: NhkSpeechReview}) {
  const differenceLines = useMemo(() => [
    ...review.omissions.map(item => `漏掉「${item.expected}」${item.noteZh ? `：${item.noteZh}` : ''}`),
    ...review.substitutions.map(item => `说成「${item.heard}」→「${item.expected}」${item.noteZh ? `：${item.noteZh}` : ''}`),
    ...review.particles.map(item => `助词「${item.heard}」→「${item.expected}」${item.noteZh ? `：${item.noteZh}` : ''}`),
  ], [review]);

  return (
    <div className="nhk-speech-review">
      <div className="nhk-review-score">
        <span>{review.mode === 'shadow' ? '文本一致度' : '表达完成度'}</span>
        <strong>{review.mode === 'shadow' ? review.metrics.textAccuracy : review.metrics.contentScore}</strong>
      </div>
      <p className="nhk-review-summary">{review.summaryZh}</p>
      <div className="nhk-transcript"><small>系统听到</small><strong>{review.transcript}</strong></div>
      <ReviewList title="做得好的地方" items={review.strengthsZh} />
      <ReviewList title="需要修正" items={differenceLines} />
      <ReviewList title="停顿建议" items={review.pauseAdviceZh} />
      {review.minimalRevisionJa && (
        <div className="nhk-revision-pair"><small>最小修改</small><strong>{review.minimalRevisionJa}</strong></div>
      )}
      {review.naturalVersionJa && review.naturalVersionJa !== review.minimalRevisionJa && (
        <div className="nhk-revision-pair natural"><small>更自然的口语</small><strong>{review.naturalVersionJa}</strong></div>
      )}
      {review.mode === 'world' && (review.characterReactionJa || review.characterReactionZh) && (
        <div className="nhk-character-reaction">
          <small>田中的反应</small>
          {review.characterReactionJa && <strong>{review.characterReactionJa}</strong>}
          {review.characterReactionZh && <p>{review.characterReactionZh}</p>}
        </div>
      )}
    </div>
  );
}

export function NhkRecordingCoach({
  label,
  mode,
  referenceText,
  summary = '',
  question = '',
  targetExpression = '',
  review,
  onDuration,
  onReview,
  onUnavailable,
}: {
  label: string;
  mode: NhkSpeechMode;
  referenceText: string;
  summary?: string;
  question?: string;
  targetExpression?: string;
  review?: NhkSpeechReview;
  onDuration: (seconds: number) => void;
  onReview: (review: NhkSpeechReview) => void;
  onUnavailable?: () => void;
}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [localReview, setLocalReview] = useState<NhkSpeechReview | undefined>(review);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const visibleReview = localReview || review;

  useEffect(() => { if (review) setLocalReview(review); }, [review]);

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

  useEffect(() => () => {
    stopTimer();
    stopStream();
  }, []);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('这个浏览器不能录音，已开放手动输入作为备用。');
      onUnavailable?.();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mimeType = supportedRecorderMime();
      const recorder = mimeType ? new MediaRecorder(stream, {mimeType}) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setSeconds(0);
      setBlob(null);
      setLocalReview(undefined);
      setState('recording');
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const nextBlob = new Blob(chunksRef.current, {type: recorder.mimeType || mimeType || 'audio/webm'});
        const nextUrl = URL.createObjectURL(nextBlob);
        setAudioUrl(previous => {
          if (previous) URL.revokeObjectURL(previous);
          return nextUrl;
        });
        setBlob(nextBlob);
        setSeconds(duration);
        setState('ready');
        onDuration(duration);
        stopStream();
      };
      recorder.onerror = () => {
        stopTimer();
        stopStream();
        setState('error');
        setError('录音没有保存成功，请重新录一次。');
      };
      recorder.start(250);
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch {
      stopTimer();
      stopStream();
      setState('error');
      setError('没有取得麦克风权限，已开放手动输入作为备用。');
      onUnavailable?.();
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setBlob(null);
    setSeconds(0);
    setState('idle');
    setError('');
    setLocalReview(undefined);
    onDuration(0);
  };

  const analyze = async () => {
    if (!blob || state === 'analyzing') return;
    if (blob.size > 2_800_000) {
      setError('录音文件过大，请缩短到 90 秒以内。');
      return;
    }
    setState('analyzing');
    setError('');
    try {
      const audioBase64 = await blobToBase64(blob);
      const {data} = await api.post<SpeechResponse>('/api/nhk-speech', {
        action: 'review',
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        mode,
        referenceText,
        summary,
        question,
        targetExpression,
        durationSeconds: seconds,
      });
      if (!data?.ok || !data.review) throw new Error(data?.reason || 'review_failed');
      setLocalReview(data.review);
      setState('ready');
      onReview(data.review);
    } catch (failure) {
      setState('ready');
      const reason = failure instanceof Error ? failure.message : 'review_failed';
      setError(errorCopy(reason));
    }
  };

  return (
    <div className="nhk-recording-coach">
      <div className="nhk-recording-head">
        <div><strong>{label}</strong><small>{state === 'recording' ? `${seconds}秒` : '录音只在本页保留；提交分析后不保存音频'}</small></div>
        {state === 'recording' ? (
          <button className="recording" onClick={stop}><Square size={16} fill="currentColor" />停止</button>
        ) : (
          <button onClick={() => void start()}><Mic2 size={16} />{blob ? '重录' : '开始'}</button>
        )}
      </div>
      {audioUrl && <audio controls src={audioUrl} />}
      {blob && (
        <div className="nhk-recording-actions">
          <button disabled={state === 'analyzing'} onClick={() => void analyze()}>
            {state === 'analyzing' ? <LoaderCircle className="nhk-spin" size={15} /> : <Send size={15} />}
            {state === 'analyzing' ? '正在转写和分析…' : visibleReview ? '重新分析' : '上传分析'}
          </button>
          <button onClick={reset}><RotateCcw size={14} />清除</button>
        </div>
      )}
      {error && <p className="nhk-speech-error">{error}</p>}
      {visibleReview && <NhkSpeechReviewPanel review={visibleReview} />}
    </div>
  );
}
