from pathlib import Path

def edit(name,before,after):
 p=Path(name);s=p.read_text();assert s.count(before)==1,(name,s.count(before),before[:90]);p.write_text(s.replace(before,after,1))
if 'data-desktop-release="desktop-20260911-v4"' in Path('src/companion/CompanionApp.tsx').read_text():
 print('Desktop04 already applied; verify committed source.');raise SystemExit(0)
app='src/companion/CompanionApp.tsx'
edit(app,"import {SelectionWorkspace", "import {DesktopAtmosphere,type AtmosphereLevel} from '../immersion/DesktopAtmosphere';\nimport {LearningSoundControl,playLearningCue,updateLearningSoundGate,stopLearningCues} from './learningSound';\nimport {SelectionWorkspace")
edit(app,"export default function CompanionApp(){", """export default function CompanionApp(){
  const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width: 1100px)').matches);
  const [atmosphere,setAtmosphere]=useState<AtmosphereLevel>('rich');
  const teacherScroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{const media=window.matchMedia('(min-width: 1100px)');const update=()=>setDesktop(media.matches);media.addEventListener('change',update);return()=>{media.removeEventListener('change',update);stopLearningCues();};},[]);""")
edit(app,"activity:a=>{if(current())setActivity(a);}","activity:a=>{if(current()){updateLearningSoundGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});setActivity(a);}}")
edit(app,"const begin=(nextSeed?:Seed,deferOpening=false)=>{conn.current?.dispose();", "const begin=(nextSeed?:Seed,deferOpening=false)=>{stopLearningCues();conn.current?.dispose();")
edit(app,"const finish=()=>{setPractice(null);", "const finish=()=>{stopLearningCues();setPractice(null);")
old=next(line for line in Path(app).read_text().splitlines() if 'const revealNote=()' in line)
edit(app,old,"""  const revealNote=()=>{const valid=notes.filter(n=>noteStillApplies(n,lines,writtenEnabled));const note=valid.find(n=>n.id===unreadNote)||valid.at(-1);if(!note)return;if(!desktop)setScenery(false);setShowText(true);setExpandedNote(note.id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{const host=desktop?teacherScroll.current:scroller.current;Array.from(host?.querySelectorAll<HTMLElement>('[data-note-for]')||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'nearest',behavior:'smooth'});}));};""")
edit(app,'note={n} expanded={expandedNote===n.id}', 'note={n} showSource={desktop} expanded={expandedNote===n.id}')
edit(app,"if(learning.remember(subject,subject.phrase,true))setNotice('已加入本机表达本。');", "if(learning.remember(subject,subject.phrase,true)){setNotice('已加入本机表达本。');playLearningCue('saved');}")
edit(app,'data-immersion-release="immersion-20260911-v3"','data-immersion-release="immersion-20260911-v3" data-desktop-release="desktop-20260911-v4" data-desktop-focus={desktop} data-practice={!!practice}')
edit(app,'paused={studyOpen||!!sheet} onStatus={setAmbientStatus}/>','paused={studyOpen||!!sheet} onStatus={setAmbientStatus}/>\n    {desktop&&<DesktopAtmosphere level={atmosphere} enabled={motionOn&&!studyOpen&&!practice&&(!sheet||sheet===\'scene\')}/> }')
edit(app,'<span className="imm-edition">IMMERSION / 03</span>',"<span className=\"imm-edition\">{desktop?'DESKTOP / 04':'IMMERSION / 03'}</span>")
edit(app,'{!line.interrupted&&eligibleNotes.filter(n=>n.anchorId===line.id).map(noteCard)}','{!desktop&&!line.interrupted&&eligibleNotes.filter(n=>n.anchorId===line.id).map(noteCard)}')
edit(app,'{!showText&&!practice&&<div className="teacher-captionless-notes">','{!desktop&&!showText&&!practice&&<div className="teacher-captionless-notes">')
edit(app,'        <footer className="kc-chat-bottom">', '''        {desktop&&<aside className="df-teacher" aria-label="常驻文字教师">
          <header className="df-teacher-heading"><div><span>TEACHER / LIVE NOTES</span><h2>随聊笔记</h2></div><BookOpen size={20}/></header>
          <div className={`df-teacher-scroll ${!showText?'teacher-captionless-notes':''}`} ref={teacherScroll}>
            {notePending&&<p className="df-teacher-status" role="status">正在整理这一句…</p>}
            {noteError&&<p className="df-teacher-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}
            {eligibleNotes.length>1&&<details className="df-earlier-notes"><summary>较早的提示 · {eligibleNotes.length-1}</summary>{eligibleNotes.slice(0,-1).reverse().map(noteCard)}</details>}
            {eligibleNotes.length?<div className="df-current-note">{noteCard(eligibleNotes.at(-1)!)}</div>:<div className="df-teacher-empty"><span>一次，只看一个重点</span><p>{writtenEnabled?'有值得留意的表达，会直接出现在这里。':'自动提示已关闭；仍可主动问词义或点「接不上」。'}</p><p>也可以选中一句日语，点「学这段」。</p></div>}
          </div>
          <footer className="df-teacher-foot"><LearningSoundControl compact/><button disabled={phase==='connecting'||phase==='error'||!!practice} onClick={()=>act('help')}>帮我接一句</button></footer>
        </aside>}
        <footer className="kc-chat-bottom">''')
edit(app,'{unreadNote&&notes.some(', '{!desktop&&unreadNote&&notes.some(')
edit(app,'{noteError&&<p className="kc-note-error"','{!desktop&&noteError&&<p className="kc-note-error"')
edit(app,'{notePending&&<p className="kc-note-pending"','{!desktop&&notePending&&<p className="kc-note-pending"')
edit(app,'onClick={()=>void conn.current?.toggleMic()}', 'onClick={()=>{stopLearningCues();void conn.current?.toggleMic();}}')
edit(app,'<section className="teacher-preferences">','<LearningSoundControl/><section className="teacher-preferences">')
edit(app,'<b>IMMERSION / 03</b>','<b>DESKTOP / 04</b>')
edit(app,'版本 9.11 · IMMERSION 03 / TEACHER 02。','版本 9.11 · DESKTOP 04 / IMMERSION 03 / TEACHER 02。')
edit(app,'<div className="imm-quality">', '''{desktop&&<fieldset className="df-atmosphere-controls"><legend>桌面环境动态</legend><div>{([['off','关闭'],['gentle','舒缓'],['rich','增强']] as const).map(([value,label])=><button key={value} aria-pressed={atmosphere===value} disabled={!motionOn} onClick={()=>setAtmosphere(value)}>{label}</button>)}</div><small>更明显的景深雨幕、玻璃雨滴与雾流。声音独立；练习时暂停前景特效。</small></fieldset>}<div className="imm-quality">''')
card='src/companion/WrittenNoteCard.tsx'
edit(card,'onSupport?:(text:string)=>void};','onSupport?:(text:string)=>void;showSource?:boolean};')
edit(card,'onSpeak,onSupport}:Props)','onSpeak,onSupport,showSource=false}:Props)')
edit(card,'   {step<3&&note.scaffold&&','''   {showSource&&<details className="df-note-source"><summary>对应原句</summary><p lang="ja" data-study-source={note.mode==='help'?'assistant':'user'}>{note.source}</p></details>}
   {step<3&&note.scaffold&&''')
t='src/companion/TeacherStudio.tsx'
edit(t,"import {useEffect", "import {FeedbackMoment} from './FeedbackMoment';\nimport {playLearningCue} from './learningSound';\nimport {useEffect")
edit(t,'ChevronRight,Volume2,X,Bookmark,RotateCcw','ChevronRight,Volume2,X')
edit(t,'callbacks.current.onLesson(next);',"callbacks.current.onLesson(next);playLearningCue('ready');")
edit(t,'connection.useSupport(text);};',"connection.useSupport(text);playLearningCue('hint');};")
edit(t,'setResult(verdict);callbacks.current.onResult',"setResult(verdict);playLearningCue(verdict.verdict==='communicated'?'progress':'adjust');callbacks.current.onResult")
edit(t,'data-testid="teacher-studio">',"data-testid=\"teacher-studio\" data-step={result?'feedback':answer?'answer':'prepare'}>")
edit(t,'  {lesson&&<>','''  {lesson&&<>
   <div className="df-lesson-steps" aria-label="练习阶段"><span className={!answer&&!result?'current':''}>01 想表达</span><span className={answer&&!result?'current':''}>02 试一句</span><span className={result?'current':''}>03 带走</span></div>''')
old=next(l for l in Path(t).read_text().splitlines() if '{result&&<div className="teacher-result"' in l)
edit(t,old,'   {result&&<FeedbackMoment lesson={lesson} result={result} answer={answer} onRetry={retry} onSave={onSave} onListen={text=>void connection.demonstrate(text)}/>}')
p=Path('src/companion/main.tsx');p.write_text(p.read_text()+"\nimport './desktopFocus.css';\n")
p=Path('src/immersion/SelectionStudyLayer.tsx');s=p.read_text()
s=s.replace("const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);", "const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),identity=useRef('');")
s=s.replace('const changed=()=>{clearTimeout(timer.current);',"const changed=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('.imm-selection-tools'))return;clearTimeout(timer.current);")
s=s.replace('setFocus(found?.focus||null);setMore(false);',"const f=found?.focus;const key=f?JSON.stringify([f.sourceId,f.revision,f.start,f.end]):'';if(key!==identity.current){identity.current=key;setFocus(f||null);setMore(false);}")
assert 'identity.current=key' in s;p.write_text(s)
# An opt-out or page close must win over an in-flight AudioContext.resume().
p=Path('src/companion/learningSound.tsx');s=p.read_text().replace('let context:AudioContext|null=null,gate=', 'let enableEpoch=0;\nlet context:AudioContext|null=null,gate=')
s=s.replace("window.addEventListener('pagehide',()=>{stopLearningCues();", "window.addEventListener('pagehide',()=>{enableEpoch++;stopLearningCues();")
s=s.replace('stopLearningCues();preferences={...preferences,enabled:false,error:', 'const epoch=++enableEpoch;stopLearningCues();preferences={...preferences,enabled:false,error:')
s=s.replace("await context.resume();if(context.state!=='running')", "await context.resume();if(epoch!==enableEpoch)return;if(context.state!=='running')")
s=s.replace("}catch{preferences={...preferences,enabled:false,error:'当前", "}catch{if(epoch!==enableEpoch)return;preferences={...preferences,enabled:false,error:'当前")
p.write_text(s)
print('Applied Desktop04 against actual inspected Immersion03 source. No backend or storage migrations.')
