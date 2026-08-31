import {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Compass, Headphones, Heart, Map as MapIcon, RotateCcw, Sparkles, User, Zap} from 'lucide-react';
import {api} from './api';
import {categories, stories as bundledStories, Story} from './content';
import EpisodeVisual from './EpisodeVisual';
import {applyFinish, migrateMemory, MemoryMap, pickMemoryEcho, reviewPriority} from './memory';
import NhkMorningPage from './NhkMorningPage';
import PracticeLane, {type Weakness} from './PracticeLane';
import ReviewLane from './ReviewLane';
import {PlayClipId} from './playPlan';
import {playSfx} from './sfx';
import {getSeasonProgress, resolveActiveSeason, seasonStoriesFor} from './seasonProgress';

type Tab = 'morning' | 'play' | 'review' | 'atlas' | 'profile';
type OpenMode = 'play' | 'review';
type RecallResult = 'good' | 'close' | 'miss';
type ClipState = 'ready' | 'pending' | 'failed';

const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const SEASON_ORDER = ['release-week-01', 'life-beyond-work-02'];
const FRONTIER_REFRESH_MS = 30_000;

const fetchRemoteStories = async (): Promise<Story[]> => {
  const {data} = await api.get('/api/news-content');
  const payload = data as {ok?: boolean; stories?: Story[]};
  return payload?.ok && Array.isArray(payload.stories) ? payload.stories : [];
};

function App() {
  const [tab, setTab] = useState<Tab>('morning');
  const [openMode, setOpenMode] = useState<OpenMode>('play');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipStatus, setClipStatus] = useState<Partial<Record<PlayClipId, ClipState>>>({});
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('nihongo-sfx') !== 'off');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nihongo-favorites') || '[]') as string[]; } catch { return []; }
  });
  const [memories, setMemories] = useState<MemoryMap>(() => {
    try { return migrateMemory(JSON.parse(localStorage.getItem('nihongo-memories') || '{}') as MemoryMap); } catch { return {}; }
  });
  const evergreen = useMemo(() => bundledStories.filter(s => !s.news), []);
  const fallbackDynamic = useMemo(() => bundledStories.filter(s => !!s.news).map(s => ({...s, audioAvailable: false})), []);
  const [dynamic, setDynamic] = useState<Story[]>(fallbackDynamic);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const progressReportedRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    void fetchRemoteStories().then(remote => {
      if (active && remote.length) setDynamic(remote);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setClipStatus({}); return; }
    let active = true;
    void api.get(`/api/play-audio-status/${selectedId}`).then(({data}) => {
      const payload = data as {ok?: boolean; clips?: Partial<Record<PlayClipId, ClipState>>};
      if (active && payload?.ok && payload.clips) setClipStatus(payload.clips);
    }).catch(() => { if (active) setClipStatus({}); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => localStorage.setItem('nihongo-favorites', JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem('nihongo-memories', JSON.stringify(memories)), [memories]);
  useEffect(() => localStorage.setItem('nihongo-sfx', sfxEnabled ? 'on' : 'off'), [sfxEnabled]);

  const stories = useMemo(() => {
    const ids = new Set(dynamic.map(s => s.id));
    return [...dynamic, ...evergreen.filter(s => !ids.has(s.id))];
  }, [dynamic, evergreen]);

  const reportProgress = (story: Story) => {
    const meta = story.series;
    if (meta?.worldId !== 'life-in-japan' || !meta.seasonId || !meta.episodeNo) return;
    const previous = progressReportedRef.current[meta.seasonId] || 0;
    if (previous >= meta.episodeNo) return;
    progressReportedRef.current[meta.seasonId] = meta.episodeNo;
    void api.post('/api/content-progress', {storyId: story.id}).catch(() => {
      if (progressReportedRef.current[meta.seasonId!] === meta.episodeNo) {
        progressReportedRef.current[meta.seasonId!] = previous;
      }
    });
  };

  useEffect(() => {
    const latestBySeason = new Map<string, Story>();
    for (const story of stories) {
      const meta = story.series;
      if (meta?.worldId !== 'life-in-japan' || !meta.seasonId || !meta.episodeNo) continue;
      if (!(memories[story.id]?.lastSeen || 0)) continue;
      const current = latestBySeason.get(meta.seasonId);
      if (!current || (current.series?.episodeNo || 0) < meta.episodeNo) latestBySeason.set(meta.seasonId, story);
    }
    for (const story of latestBySeason.values()) reportProgress(story);
  }, [stories, memories]);

  const activeSeason = useMemo(() => resolveActiveSeason(stories, memories, SEASON_ORDER), [stories, memories]);
  const seasonStories = useMemo(() => seasonStoriesFor(stories, activeSeason), [stories, activeSeason]);
  const seasonProgress = useMemo(() => getSeasonProgress(seasonStories, memories), [seasonStories, memories]);

  useEffect(() => {
    if (!seasonProgress.waitingForNext) return;
    let active = true;
    const refresh = () => {
      void fetchRemoteStories().then(remote => {
        if (active && remote.length) setDynamic(remote);
      }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, FRONTIER_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [seasonProgress.waitingForNext, activeSeason]);

  const selected = stories.find(s => s.id === selectedId) || null;
  const learned = stories.filter(s => (memories[s.id]?.lastSeen || 0) > 0);
  const due = learned
    .filter(s => (memories[s.id]?.nextReviewAt || 0) <= Date.now())
    .sort((a, b) => reviewPriority(memories[b.id]) - reviewPriority(memories[a.id]));
  const nextSeasonStory = seasonStories.find(s => !memories[s.id]?.lastSeen);
  const continueStory = seasonProgress.waitingForNext
    ? null
    : nextSeasonStory || due[0] || stories.find(s => !memories[s.id]?.lastSeen) || stories[0] || null;
  const continueSeries = continueStory?.series;
  const completedSeason = seasonProgress.completedCount;
  const favoriteStories = stories.filter(s => favorites.includes(s.id));
  const morningWorldStory = continueStory || seasonStories[seasonStories.length - 1] || null;

  const unlock = () => {
    audioRef.current?.pause();
    const a = new Audio(SILENT_WAV);
    a.preload = 'auto';
    a.loop = true;
    audioRef.current = a;
    try { void a.play().catch(() => {}); } catch {}
    return a;
  };

  const playClip = async (storyId: string, clipId: PlayClipId, rate = 1) => {
    const request = ++requestRef.current;
    const a = unlock();
    try {
      const response = await Promise.race([
        api.get(`/api/play-audio/${storyId}/${clipId}`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('play_audio_timeout')), 5000)),
      ]);
      if (request !== requestRef.current) return false;
      const data = response.data as {status?: string; url?: string};
      if (data?.status !== 'ready' || !data?.url) throw new Error('not_ready');
      a.loop = false;
      a.src = data.url;
      a.currentTime = 0;
      a.playbackRate = rate;
      audioRef.current = a;
      await a.play();
      return true;
    } catch {
      if (request === requestRef.current) a.pause();
      return false;
    }
  };

  const toggleFavorite = (id: string) => setFavorites(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  const openStory = (id: string, mode: OpenMode = 'play') => { requestRef.current++; audioRef.current?.pause(); setOpenMode(mode); setSelectedId(id); };
  const closeStory = () => { requestRef.current++; audioRef.current?.pause(); setSelectedId(null); };
  const markMistake = (kind: Weakness) => {
    if (!selected) return;
    setMemories(v => {
      const old = v[selected.id] || {strength: 0, nextReviewAt: 0, lastSeen: 0, version: 2 as const};
      const weaknesses = {...(old.weaknesses || {})};
      weaknesses[kind] = (weaknesses[kind] || 0) + 1;
      return {...v, [selected.id]: {...old, version: 2, weaknesses}};
    });
  };

  const finish = (result: RecallResult) => {
    if (!selected) return;
    const now = Date.now();
    reportProgress(selected);
    setMemories(v => ({...v, [selected.id]: applyFinish(v[selected.id] || {strength: 0, nextReviewAt: 0, lastSeen: 0, version: 2}, result, selected)}));
    if (openMode === 'review') {
      const next = stories.find(s => s.id !== selected.id && (memories[s.id]?.lastSeen || 0) > 0 && (memories[s.id]?.nextReviewAt || 0) <= now);
      setSelectedId(next?.id || null);
      if (!next) setTab('review');
      return;
    }
    const meta = selected.series;
    const nextId = meta?.nextEpisodeId || selected.nextId;
    const explicitNext = stories.find(s => s.id === nextId);
    setOpenMode('play');
    if (explicitNext) {
      setSelectedId(explicitNext.id);
      return;
    }
    if (meta) {
      setSelectedId(null);
      setTab('play');
      return;
    }
    const next = stories.find(s => s.id !== selected.id && !memories[s.id]?.lastSeen);
    setSelectedId(next?.id || null);
  };

  if (selected) {
    const memory = memories[selected.id] || {strength: 0, nextReviewAt: 0, lastSeen: 0, version: 2};
    const meta = selected.series;
    const memoryEcho = pickMemoryEcho(selected, memories, stories);
    const contextLine = meta?.todayHook || undefined;
    return (
      <div className="shell">
        <main className="phone play-only">
          <header className="play-topbar">
            <button aria-label="返回" onClick={closeStory}><ChevronLeft size={22} /></button>
            <div>
              <small>{meta ? `第${meta.episodeNo}集` : `${selected.level}`}</small>
              <strong>{selected.key.term}</strong>
            </div>
            <button aria-label={favorites.includes(selected.id) ? '取消收藏' : '收藏'} onClick={() => toggleFavorite(selected.id)}>
              <Heart size={20} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
            </button>
          </header>
          {openMode === 'play' ? (
            <PracticeLane
              story={selected}
              clipStatus={clipStatus}
              playClip={playClip}
              onSfx={kind => playSfx(kind, sfxEnabled)}
              onComplete={finish}
              onMistake={markMistake}
              memoryEcho={memoryEcho}
              contextLine={contextLine}
            />
          ) : (
            <ReviewLane story={selected} clipStatus={clipStatus} playClip={playClip} memory={memory} onComplete={finish} onMistake={markMistake} />
          )}
        </main>
      </div>
    );
  }

  const card = (s: Story, mode: OpenMode = 'play') => (
    <button className="topic-row" key={`${mode}-${s.id}`} onClick={() => openStory(s.id, mode)}>
      <span>{s.emoji}</span>
      <div><strong>{s.key.term}</strong><small>{s.series?.episodeNo ? `第${s.series.episodeNo}集` : `${s.category} · ${s.level}`}</small></div>
      <ChevronRight size={16} />
    </button>
  );

  return (
    <div className="shell">
      <main className="phone focus-app">
        {tab === 'morning' && (
          <NhkMorningPage
            worldStory={morningWorldStory}
            onEnterWorld={() => {
              setTab('play');
              if (continueStory) openStory(continueStory.id, 'play');
            }}
          />
        )}
        {tab === 'play' && (
          <>
            <header className="focus-header compact">
              <strong>你的连续世界</strong>
              <span>{completedSeason}/{seasonProgress.episodeCount || seasonStories.length || 12}</span>
            </header>
            {continueStory && (
              <section className="hero-play immersive">
                <EpisodeVisual story={continueStory} />
                <div className="hero-copy">
                  <small>{continueSeries ? `第${continueSeries.episodeNo}集` : continueStory.category}</small>
                  <h1>{continueSeries?.todayHook || continueStory.key.term}</h1>
                  <button onClick={() => openStory(continueStory.id, 'play')}>
                    <Sparkles size={19} />
                    <strong>继续本集</strong>
                    <ChevronRight size={19} />
                  </button>
                </div>
              </section>
            )}
            {seasonStories.length > 0 && (
              <section className="season-progress compact">
                {seasonProgress.waitingForNext && (
                  <>
                    <div><strong>下一集准备中</strong><span>第{seasonProgress.nextEpisodeNo}集</span></div>
                    <small>故事会接着这里继续。</small>
                  </>
                )}
                <div className="season-dots">{seasonStories.map(s => <i key={s.id} className={(memories[s.id]?.lastSeen || 0) > 0 ? 'done' : s.id === continueStory?.id ? 'current' : ''} />)}</div>
              </section>
            )}
          </>
        )}
        {tab === 'review' && (
          <section className="secondary-page">
            <header><strong>再遇</strong></header>
            <div className="topic-list">{(due.length ? due : learned).map(s => card(s, 'review'))}</div>
            {!learned.length && <p className="empty-copy">先玩一组，这里会安排再遇。</p>}
          </section>
        )}
        {tab === 'atlas' && (
          <section className="secondary-page">
            <header><strong>图鉴</strong></header>
            {seasonStories.length > 0 && (
              <div className="atlas-season">
                <strong>{seasonStories[0]?.series?.seasonTitle || '连续世界'}</strong>
                <span>{seasonStories.length}/{seasonProgress.episodeCount || seasonStories.length} 集</span>
                <button onClick={() => openStory(seasonStories[0].id)}>从第1集开始</button>
              </div>
            )}
            <div className="atlas-simple">
              {categories.filter(c => c !== '全部').map(c => {
                const list = stories.filter(s => s.category === c && !s.series);
                return <button key={c} disabled={!list.length} onClick={() => list[0] && openStory(list[0].id)}><strong>{c}</strong><span>{list.length}</span></button>;
              })}
            </div>
          </section>
        )}
        {tab === 'profile' && (
          <section className="secondary-page">
            <header><strong>我的</strong></header>
            <div className="profile-simple">
              <div><strong>{learned.length}</strong><span>已遇见</span></div>
              <div><strong>{favorites.length}</strong><span>收藏</span></div>
              <div><strong>{due.length}</strong><span>待复习</span></div>
            </div>
            <button className="sound-toggle" onClick={() => setSfxEnabled(v => !v)}><Zap size={18} /><span>反馈音效</span><b>{sfxEnabled ? '开' : '关'}</b></button>
            {favoriteStories.length > 0 && (
              <div className="profile-favorites">
                <small>收藏的表达</small>
                <div className="topic-list">{favoriteStories.map(s => card(s))}</div>
              </div>
            )}
          </section>
        )}
        <nav className="bottom-nav-simple">
          {([{id: 'morning', label: '今朝', icon: Headphones}, {id: 'play', label: '世界', icon: Compass}, {id: 'review', label: '复习', icon: RotateCcw}, {id: 'atlas', label: '图鉴', icon: MapIcon}, {id: 'profile', label: '我的', icon: User}] as const).map(n => {
            const I = n.icon;
            return <button key={n.id} className={tab === n.id ? 'active' : ''} aria-label={n.label} onClick={() => setTab(n.id)}><I size={21} /></button>;
          })}
        </nav>
      </main>
    </div>
  );
}

export default App;
