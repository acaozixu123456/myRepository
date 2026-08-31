import {type ClipboardEvent, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, Check, ChevronRight, ExternalLink, Headphones, Link2, LoaderCircle, Mic2, RotateCcw, Sparkles, Square} from 'lucide-react';
import {api} from './api';
import type {Story} from './content';
import EpisodeVisual from './EpisodeVisual';
import {
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
} from './nhkMorning';
import './nhkMorning.css';

type VoiceRecorderProps = {
  label: string;
  onDuration: (seconds: number) => void;
};

type RecorderState = 'idle' | 'recording' | 'ready' | 'error';
type ArticleParseStatus = 'idle' | 'loading' | 'ready' | 'error';
type MojiArticleResponse = {
  ok?: boolean;
  sourceUrl?: string;
  title?: string;
  sentences?: string[];
  reason?: string;
};

const sessionSentences = (session: NhkMorningSession): string[] => {
  if (session.selectedSentences?.length) return session.selectedSentences.slice(0, 3);
  return session.shadowText.split(/\n+/).map(value => value.trim()).filter(Boolean).slice(0, 3);
};

function VoiceRecorder({label, onDuration}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
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
      setError('这个浏览器暂时不能录音。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const recorder = new MediaRecorder(stream);
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
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, {type: recorder.mimeType || 'audio/webm'});
        const nextUrl = URL.createObjectURL(blob);
        setAudioUrl(previous => {
          if (previous) URL.revokeObjectURL(previous);
          return nextUrl;
        });
        setSeconds(duration);
        setState('ready');
        onDuration(duration);
        stopStream();
      };
      recorder.start();
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
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

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSeconds(0);
    setState('idle');
    setError('');
  };

  return (
    <div className="nhk-recorder">
      <div><strong>{label}</strong><small>{state === 'recording' ? `${seconds}秒` : '录音只在本次页面临时使用'}</small></div>
      {state === 'recording' ? (
        <button className="recording" onClick={stop}><Square size={17} fill="currentColor" />停止</button>
      ) : (
        <button onClick={start}><Mic2 size={17} />{state === 'ready' ? '再录一次' : '开始录音'}</button>
      )}
      {audioUrl && <audio controls src={audioUrl} />}
      {state === 'ready' && <button className="recorder-reset" onClick={reset}><RotateCcw size={14} />清除</button>}
      {error && <p>{error}</p>}
    </div>
  );
}

type NhkMorningPageProps = {
  worldStory: Story | null;
  onEnterWorld: () => void;
};

type PageView = 'home' | 'today' | 'recall';

const formatDate = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkMorningPage({worldStory, onEnterWorld}: NhkMorningPageProps) {
  const todayKey = toDateKey();
  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());
  const [draft, setDraft] = useState<NhkMorningSession>(() => findTodayNhkSession(loadNhkSessions(), todayKey) || createNhkSession(todayKey));
  const initialSentences = sessionSentences(draft);
  const [view, setView] = useState<PageView>('home');
  const [step, setStep] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [recallSeconds, setRecallSeconds] = useState(0);
  const [articleSentences, setArticleSentences] = useState<string[]>(initialSentences);
  const [selectedSentences, setSelectedSentences] = useState<string[]>(initialSentences);
  const [parseStatus, setParseStatus] = useState<ArticleParseStatus>(initialSentences.length ? 'ready' : 'idle');
  const [parseError, setParseError] = useState('');

  useEffect(() => saveNhkSessions(sessions), [sessions]);

  const todaySession = useMemo(() => findTodayNhkSession(sessions, todayKey), [sessions, todayKey]);
  const recallSession = useMemo(() => pickRecallSession(sessions, todayKey), [sessions, todayKey]);
  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);
  const recent = useMemo(() => sessions.filter(session => session.completedAt).slice(0, 3), [sessions]);

  const persist = (next: NhkMorningSession) => {
    setDraft(next);
    setSessions(current => upsertNhkSession(current, next));
  };

  const patch = (values: Partial<NhkMorningSession>) => persist({...draft, ...values});

  const openToday = () => {
    const next = todaySession || createNhkSession(todayKey);
    const selected = sessionSentences(next);
    setDraft(next);
    setSelectedSentences(selected);
    setArticleSentences(selected);
    setParseStatus(selected.length ? 'ready' : 'idle');
    setParseError('');
    setStep(0);
    setShowOriginal(false);
    setView('today');
  };

  const resetAfterSourceChange = (sourceUrl: string): NhkMorningSession => ({
    ...draft,
    sourceUrl,
    title: '',
    shadowText: '',
    selectedSentences: [],
    recapText: '',
    keyExpression: '',
    dailyVersion: '',
    workVersion: '',
    opinion: '',
    worldAnswer: '',
    recapRecordingSeconds: 0,
    worldRecordingSeconds: 0,
    completedAt: undefined,
  });

  const changeSourceUrl = (sourceUrl: string) => {
    setDraft(resetAfterSourceChange(sourceUrl));
    setArticleSentences([]);
    setSelectedSentences([]);
    setParseStatus('idle');
    setParseError('');
  };

  const parseArticle = async (inputUrl = draft.sourceUrl) => {
    const sourceUrl = inputUrl.trim();
    if (!sourceUrl) {
      setParseStatus('error');
      setParseError('先粘贴 MOJi 文章链接。');
      return;
    }
    setParseStatus('loading');
    setParseError('');
    try {
      const {data} = await api.post<MojiArticleResponse>('/api/moji-article', {url: sourceUrl});
      if (!data?.ok || !data.title || !Array.isArray(data.sentences) || !data.sentences.length) {
        throw new Error(data?.reason || 'parse_failed');
      }
      const next = {
        ...resetAfterSourceChange(data.sourceUrl || sourceUrl),
        title: data.title,
      };
      persist(next);
      setArticleSentences(data.sentences);
      setSelectedSentences([]);
      setParseStatus('ready');
    } catch {
      setParseStatus('error');
      setParseError('没有解析出正文。请确认这是能公开打开的 MOJi 文章链接，再重试。');
    }
  };

  const pasteAndParse = (event: ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData('text').trim();
    if (!value) return;
    event.preventDefault();
    changeSourceUrl(value);
    void parseArticle(value);
  };

  const toggleSentence = (sentence: string) => {
    const selected = selectedSentences.includes(sentence);
    if (!selected && selectedSentences.length >= 3) return;
    const nextSelected = selected
      ? selectedSentences.filter(value => value !== sentence)
      : [...selectedSentences, sentence];
    setSelectedSentences(nextSelected);
    persist({
      ...draft,
      selectedSentences: nextSelected,
      shadowText: nextSelected.join('\n'),
      recapText: '',
      keyExpression: '',
      dailyVersion: '',
      workVersion: '',
      opinion: '',
      worldAnswer: '',
      recapRecordingSeconds: 0,
      worldRecordingSeconds: 0,
      completedAt: undefined,
    });
  };

  const nextFromInput = () => {
    const shadowText = selectedSentences.join('\n');
    const expression = draft.keyExpression || suggestExpression(shadowText);
    persist({...draft, shadowText, selectedSentences, keyExpression: expression, dailyVersion: draft.dailyVersion || expression});
    setStep(1);
  };

  const completeToday = () => {
    const next = {...draft, completedAt: Date.now()};
    persist(next);
    setView('home');
  };

  const openRecall = () => {
    setRecallRevealed(false);
    setRecallSeconds(0);
    setView('recall');
  };

  const finishRecall = (rating: NhkRecallRating) => {
    if (!recallSession) return;
    const next: NhkMorningSession = {
      ...recallSession,
      recall: {dateKey: todayKey, rating, recordingSeconds: recallSeconds, completedAt: Date.now()},
    };
    setSessions(current => upsertNhkSession(current, next));
    setView('home');
  };

  if (view === 'recall' && recallSession) {
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={() => setView('home')}><ArrowLeft size={20} /></button>
          <div><small>昨日の一文</small><strong>先说，再看答案</strong></div>
          <span />
        </header>
        <div className="nhk-recall-stage">
          <small>{formatDate(recallSession.dateKey)} · {recallSession.title || 'NHK日语听力'}</small>
          <h1>不用看原文，先说出最值得带走的一句。</h1>
          <p>再用这句话，说一句和你工作或生活有关的话。</p>
          <VoiceRecorder label="20秒无提示回忆" onDuration={setRecallSeconds} />
          {!recallRevealed ? (
            <button className="nhk-secondary-action" onClick={() => setRecallRevealed(true)}>说完了，查看答案</button>
          ) : (
            <div className="nhk-recall-answer">
              <small>昨天的一句</small>
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
          <div><small>今朝のNHK</small><strong>{step + 1}/4</strong></div>
          <span />
        </header>
        <div className="nhk-step-dots">{[0, 1, 2, 3].map(index => <i key={index} className={index <= step ? 'active' : ''} />)}</div>

        {step === 0 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">INPUT</span>
            <h1>贴链接，选句子。</h1>
            <p>标题和正文自动识别。你只需要选出今天实际跟读过的 1～3 句。</p>
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
                  placeholder="粘贴 MOJi 文章链接"
                  inputMode="url"
                />
                <button type="button" disabled={parseStatus === 'loading'} onClick={() => void parseArticle()}>
                  {parseStatus === 'loading' ? <LoaderCircle className="nhk-spin" size={17} /> : '解析'}
                </button>
              </div>
              <small>粘贴后会自动解析。</small>
            </div>

            {parseStatus === 'error' && <div className="nhk-parse-error">{parseError}</div>}

            {parseStatus === 'ready' && draft.title && (
              <>
                <div className="nhk-parsed-article">
                  <div><small>已识别</small><strong>{draft.title}</strong></div>
                  <a href={draft.sourceUrl} target="_blank" rel="noreferrer" aria-label="打开原文章"><ExternalLink size={17} /></a>
                </div>
                <div className="nhk-sentence-picker-head">
                  <div><strong>选择跟读过的句子</strong><small>按文章顺序显示，最多 3 句</small></div>
                  <b>{selectedSentences.length}/3</b>
                </div>
                <div className="nhk-sentence-list">
                  {articleSentences.map((sentence, index) => {
                    const selected = selectedSentences.includes(sentence);
                    const blocked = !selected && selectedSentences.length >= 3;
                    return (
                      <button
                        key={`${index}-${sentence}`}
                        type="button"
                        className={selected ? 'selected' : ''}
                        disabled={blocked}
                        aria-pressed={selected}
                        onClick={() => toggleSentence(sentence)}
                      >
                        <span>{selected ? <Check size={15} /> : index + 1}</span>
                        <strong>{sentence}</strong>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button className="nhk-primary-action" disabled={!selectedSentences.length} onClick={nextFromInput}>用这几句开始脱稿<ChevronRight size={18} /></button>
          </div>
        )}

        {step === 1 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">RECALL</span>
            <h1>关掉原文，讲 20～40 秒。</h1>
            <p>先讲清楚“谁、发生了什么、为什么重要”，不要追求逐字复现。</p>
            <VoiceRecorder label="第一次脱稿复述" onDuration={seconds => patch({recapRecordingSeconds: seconds})} />
            <label>我刚才真正说出来的内容<textarea value={draft.recapText} onChange={event => patch({recapText: event.target.value})} placeholder="可以简写，但不要复制原文" rows={5} /></label>
            <button className="nhk-text-toggle" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? '收起原句' : '说完后看原句'}</button>
            {showOriginal && <blockquote>{draft.shadowText}</blockquote>}
            <div className="nhk-step-actions"><button onClick={() => setStep(0)}>上一步</button><button disabled={!draft.recapText.trim()} onClick={() => setStep(2)}>继续</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">TRANSFER</span>
            <h1>只带走一句。</h1>
            <p>不要收藏所有生词。挑一句以后真的可能用到的表达。</p>
            <label>新闻里的一句<input value={draft.keyExpression} onChange={event => patch({keyExpression: event.target.value})} placeholder="最值得主动掌握的表达" /></label>
            <label>平时我会这样说<input value={draft.dailyVersion} onChange={event => patch({dailyVersion: event.target.value})} placeholder="更自然、更口语的版本" /></label>
            <label>工作里我会这样说<textarea value={draft.workVersion} onChange={event => patch({workVersion: event.target.value})} placeholder="把新闻表达迁移到你的项目、会议或汇报" rows={3} /></label>
            <label>我怎么看<textarea value={draft.opinion} onChange={event => patch({opinion: event.target.value})} placeholder="用日语写下你的真实观点（可选）" rows={3} /></label>
            <div className="nhk-step-actions"><button onClick={() => setStep(1)}>上一步</button><button disabled={!draft.keyExpression.trim()} onClick={() => setStep(3)}>带进世界</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="nhk-step-card">
            <span className="nhk-kicker">MY WORLD</span>
            <h1>现在，用它解决你自己的场景。</h1>
            {worldStory && <EpisodeVisual story={worldStory} />}
            <div className="nhk-world-scene">
              <small>{worldStory?.series?.seasonTitle || '在日本生活和工作的我'}</small>
              <strong>田中问你：「このニュース、仕事や生活にも関係がありそうですか。」</strong>
              <p>请尽量使用：{draft.workVersion || draft.keyExpression}</p>
            </div>
            <VoiceRecorder label="回答田中" onDuration={seconds => patch({worldRecordingSeconds: seconds})} />
            <label>我的回答<textarea value={draft.worldAnswer} onChange={event => patch({worldAnswer: event.target.value})} placeholder="用 1～3 句日语回答" rows={4} /></label>
            <div className="nhk-step-actions"><button onClick={() => setStep(2)}>上一步</button><button className="complete" disabled={!isNhkSessionReadyToComplete(draft)} onClick={completeToday}><Check size={17} />完成今天</button></div>
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
          <span>{todaySession?.completedAt ? todaySession.keyExpression : '贴链接 · 选句子 · 脱稿复述'}</span>
        </div>
        <ChevronRight size={20} />
      </button>

      {recallSession && (
        <button className="nhk-recall-card" onClick={openRecall}>
          <RotateCcw size={19} />
          <div><small>昨日の一文</small><strong>先说，再看答案</strong></div>
          <ChevronRight size={18} />
        </button>
      )}

      {todaySession?.completedAt && (
        <button className="nhk-enter-world" onClick={onEnterWorld}>
          <Sparkles size={19} />
          <div><small>今天带进去</small><strong>{todaySession.workVersion || todaySession.keyExpression}</strong></div>
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
