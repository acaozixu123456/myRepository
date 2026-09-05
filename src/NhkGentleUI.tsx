import {useRef, useState, type ReactNode} from 'react';
import {ArrowRight, BookOpen, Bookmark, Check, ChevronRight, Leaf, Plus, RotateCcw, Search, Trash2} from 'lucide-react';
import type {NhkArticleRecord, NhkKnowledgeItem} from './nhkLibrary';
import {gentleReviewBatch, gentleWeek, type GentleProgress, type GentleRating} from './nhkGentle';

export function GentleHome({article, progress, dueCount, articleCount, onContinue, onImport, onReview, onArchive, children}: {
  article?: NhkArticleRecord; progress: GentleProgress; dueCount: number; articleCount: number;
  onContinue: () => void; onImport: () => void; onReview: () => void; onArchive: () => void; children?: ReactNode;
}) {
  const days = gentleWeek(progress);
  const done = days.filter(day => day.active).length;
  return <>
    <header className="calm-home-header"><a className="calm-brand" href="#" onClick={e => e.preventDefault()} aria-label="NHK 精读首页"><span><Leaf size={22}/></span>NHK 精读</a><span className="calm-date">{new Intl.DateTimeFormat('zh-CN', {month: 'long', day: 'numeric', weekday: 'short'}).format(new Date())}</span></header>
    <div className="calm-home-grid">
      <section className="calm-home-main">
        <div className="calm-greeting"><span className="calm-eyebrow">日々、日本語。</span><h1>从一句开始，<br/>慢慢变成自己的日语。</h1><p>今天学多少，由你决定。</p></div>
        <section className="calm-feature-card">
          <div className="calm-card-top"><span className="calm-pill"><BookOpen size={15}/>{article ? '接着上次读' : '你自己的新闻读本'}</span><Leaf size={28} aria-hidden="true"/></div>
          <h2>{article?.title || '留下一篇，读懂一点。'}</h2>
          <p>{article ? '先读懂一句，再合上提示想一想。' : '分享 MOJi 链接，保存原文与精讲。随时回来，接着读。'}</p>
          <button className="calm-primary" onClick={onContinue}>{article ? '继续这一句' : '导入第一篇'}<ArrowRight size={20}/></button>
          {article && <button className="calm-text-button" onClick={onImport}><Plus size={16}/>导入新文章</button>}
        </section>
        <button className="calm-archive-link" onClick={onArchive}><span>我的文章</span><span>{articleCount} 篇<ChevronRight size={18}/></span></button>
      </section>
      <aside className="calm-home-side" aria-label="复习与学习足迹">
        <section className="calm-revisit-card"><span className="calm-eyebrow">让熟悉，再多一点</span><h2>{dueCount ? '和旧朋友见个面' : '留下值得再见的一句'}</h2><p>{dueCount ? '从收藏里回想几个表达，一次最多 3 个。' : '读文章时，收藏你真正想用的语法和单词。'}</p><button className="calm-secondary" onClick={onReview}><RotateCcw size={18}/>{dueCount ? '回想一小组' : '看看我的收藏'}</button></section>
        <section className="calm-week-card"><div><h2>最近的足迹</h2><span>{done ? `${done} 天有练习` : '从今天开始'}</span></div><div className="calm-week">{days.map(day => <span key={day.day} aria-label={`${day.day}${day.active ? '有练习' : '暂无记录'}`}><i className={day.active ? 'active' : ''}>{day.active ? <Check size={14}/> : ''}</i><small>{day.label}</small></span>)}</div><p>停一天也没关系，学过的都在。</p></section>
      </aside>
    </div>
    {children}
  </>;
}

export function GentleSentenceCheck({meaning, sentence, onFinish, onBack, initialAnswer = '', initialRevealed = false, onAnswer, onReveal}: {meaning: string; sentence: string; onFinish: (rating: GentleRating, answer: string) => void; onBack: () => void; initialAnswer?: string; initialRevealed?: boolean; onAnswer?: (answer: string) => void; onReveal?: () => void}) {
  const [revealed, setRevealed] = useState(initialRevealed);
  const [note, setNote] = useState(initialAnswer);
  const finished = useRef(false);
  return <section className="calm-recall-card" aria-label="一句回想">
    <span className="calm-eyebrow">小小回想</span><h2>这句话，你会怎么说？</h2><p className="calm-recall-prompt">{meaning || '回想刚刚读过的句子，先抓住它的意思。'}</p>
    <label className="calm-optional-note">在心里试一试，也可以写下来<textarea rows={3} value={note} onChange={e => {setNote(e.target.value); onAnswer?.(e.target.value);}} placeholder="关键词也可以（可选）"/></label>
    {!revealed ? <><button className="calm-primary" onClick={() => {setRevealed(true);onReveal?.();}}>看看原句<ArrowRight size={18}/></button><button className="calm-text-button" onClick={onBack}>再读一遍讲解</button></> : <><blockquote className="calm-revealed" lang="ja">{sentence}</blockquote><p className="calm-muted">想不起来很正常，这次回想本身也是练习。</p><div className="calm-rating">{(['again','good'] as const).map(rating => <button className={rating === 'good' ? 'calm-primary' : 'calm-secondary'} key={rating} onClick={() => {if (!finished.current) {finished.current = true; onFinish(rating, note);}}}>{rating === 'good' ? '想起来了' : '还有点模糊'}</button>)}</div></>}
  </section>;
}

export function GentleReview({items, onRate, onRemove, onOpenArticle, recallAction, onExit}: {
  items: NhkKnowledgeItem[]; onRate: (id: string, rating: GentleRating) => void; onRemove: (id: string) => void;
  onOpenArticle: (id: string) => void; recallAction?: ReactNode; onExit: () => void;
}) {
  const [mode, setMode] = useState<'review'|'browse'>('review');
  const [batch, setBatch] = useState(() => gentleReviewBatch(items).map(item => item.id));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState('');
  const rated = useRef(new Set<string>());
  const current = items.find(item => item.id === batch[index]);
  const rate = (rating: GentleRating) => {
    if (!revealed || !current || rated.current.has(current.id)) return;
    rated.current.add(current.id); onRate(current.id, rating); setRevealed(false); setIndex(value => value + 1);
  };
  const nextBatch = () => {setBatch(gentleReviewBatch(items).map(item => item.id)); setIndex(0); setRevealed(false); rated.current.clear();};
  const filtered = items.filter(item => (filter === 'all' || item.kind === filter) && `${item.title} ${item.reading} ${item.meaningZh}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <header className="nhk-studio-mainheader"><div><span className="calm-eyebrow">熟悉的，再遇见</span><h1>复习</h1><p>不是重新学一遍，只是试着想起来。</p></div><Bookmark size={26}/></header>
    <div className="calm-segment" role="group" aria-label="复习页面"><button aria-pressed={mode === 'review'} className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>回想一小组</button><button aria-pressed={mode === 'browse'} className={mode === 'browse' ? 'active' : ''} onClick={() => setMode('browse')}>全部收藏 · {items.length}</button></div>
    {mode === 'review' ? <>
      {current ? <section className="calm-recall-card" aria-label="收藏回想">
        <div className="calm-card-top"><span className="calm-eyebrow">{current.kind === 'grammar' ? '语法' : '单词'}</span><span>{index + 1} / {batch.length}</span></div>
        <h2 lang="ja">{current.title}</h2><p>这个表达是什么意思？先在心里想一想。</p>
        {!revealed ? <button className="calm-primary" onClick={() => setRevealed(true)}>揭晓解释<ArrowRight size={18}/></button> : <div className="calm-revealed" data-testid="review-answer">
          {current.reading && <small lang="ja">{current.reading}</small>}<strong>{current.meaningZh}</strong>
          {current.sources[0]?.sentence && <blockquote lang="ja">{current.sources[0].sentence}</blockquote>}
          {current.examples[0] && <div><p lang="ja">{current.examples[0].ja}</p><small>{current.examples[0].zh}</small></div>}
          <details><summary>再看看讲解</summary><p>{current.explanationZh}</p><p>{current.formation}</p><p>{current.nuanceZh}</p></details>
        </div>}
        <div className="calm-rating"><button className="calm-secondary" disabled={!revealed} onClick={() => rate('again')}>还有点模糊</button><button className="calm-primary" disabled={!revealed} onClick={() => rate('good')}>想起来了</button></div>
        <button className="calm-text-button" onClick={onExit}>今天先到这里</button>
      </section> : <section className="calm-finish-card"><span className="calm-finish-icon">{batch.length ? <Check size={28}/> : <Leaf size={28}/>}</span><h2>{batch.length ? '这一小组，回想完了。' : items.length ? '收藏先歇一歇。' : '让收藏成为你的日语。'}</h2><p>{batch.length ? `完成了 ${index} 次回想。留下的表达，会按复习安排再出现。` : items.length ? '到复习时间再回来，也可以随时翻看。' : '精读时点收藏，只留下你想再见的表达。'}</p><button className="calm-primary" onClick={onExit}>今天到这里<Check size={18}/></button>{gentleReviewBatch(items).length > 0 && <button className="calm-text-button" onClick={nextBatch}>再回想一小组</button>}</section>}
      {recallAction}
    </> : <>
      <label className="nhk-studio-search"><Search size={18}/><input aria-label="搜索收藏" placeholder="搜索表达或意思" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <div className="nhk-knowledge-filters" role="group" aria-label="收藏类型">{[['all','全部'],['grammar','语法'],['vocabulary','单词']].map(([id,label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      <div className="calm-bookmark-list">{filtered.map(item => <details key={item.id}><summary><span><small>{item.kind === 'grammar' ? '语法' : '单词'}</small><strong lang="ja">{item.title}</strong></span></summary><p>{item.meaningZh}</p>{item.reading && <p lang="ja">{item.reading}</p>}<p>{item.formation}</p><p>{item.explanationZh}</p><p>{item.nuanceZh}</p>{item.examples.map((example,i) => <blockquote key={i}><strong lang="ja">{example.ja}</strong><span>{example.zh}</span></blockquote>)}{item.sources[0] && <button className="calm-text-button" onClick={() => onOpenArticle(item.sources[0].articleId)}>回到原文<ChevronRight size={16}/></button>}<div className="calm-delete-row">{confirmDelete === item.id ? <><span>只移除收藏，原文保留。</span><button onClick={() => {onRemove(item.id); setConfirmDelete('');}}>确认移除</button><button onClick={() => setConfirmDelete('')}>保留</button></> : <button className="calm-text-button" onClick={() => setConfirmDelete(item.id)}><Trash2 size={16}/>移除收藏</button>}</div></details>)}{!filtered.length && <p className="calm-empty">这里暂时没有匹配的收藏。</p>}</div>
    </>}
  </>;
}
