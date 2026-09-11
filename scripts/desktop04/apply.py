"""Apply the reviewed DESKTOP04 UI patch. No API, voice transport or learning-store writes."""
from pathlib import Path

BASE = Path('.')
def replace(path, old, new):
    p = BASE / path
    s = p.read_text()
    assert s.count(old) == 1, (path, s.count(old), old[:100])
    p.write_text(s.replace(old, new, 1))
def add(path, content):
    p = BASE / path
    assert not p.exists(), path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)

if Path('src/companion/desktopNotes.ts').exists():
    assert 'data-desktop-release="desktop-20260911-v4"' in Path('src/companion/CompanionApp.tsx').read_text()
    print('Desktop patch already applied; verify the committed source without reapplying.')
    raise SystemExit(0)

add('src/companion/desktopNotes.ts', '''import {useEffect,useState} from 'react';
import type {Line} from './model';
import type {WrittenNote} from './writtenFeedback';
import {noteStillApplies} from './writtenLane';
export const DESKTOP_QUERY='(min-width: 1100px)';
export function useDesktopLayout():boolean{
 const [desktop,setDesktop]=useState(()=>typeof window!=='undefined'&&window.matchMedia(DESKTOP_QUERY).matches);
 useEffect(()=>{const media=window.matchMedia(DESKTOP_QUERY);const update=()=>setDesktop(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return desktop;
}
/** The notice, transcript and sidebar must refer to the same currently valid notes. */
export function displayedNotes(notes:WrittenNote[],lines:Line[],automatic:boolean):WrittenNote[]{
 return notes.filter(note=>noteStillApplies(note,lines,automatic));
}
export function revealTarget(notes:WrittenNote[],unreadId:string):WrittenNote|undefined{
 return notes.find(note=>note.id===unreadId)||notes.at(-1);
}
''')
add('src/immersion/DesktopAtmosphere.tsx', '''import {useEffect,useRef,useState} from 'react';
export type AtmosphereLevel='off'|'gentle'|'rich';
interface Drop{x:number;y:number;speed:number;length:number;alpha:number;depth:number}
/** Silent foreground weather, not an additional video decoder or audio context. */
export function DesktopAtmosphere({enabled,level}:{enabled:boolean;level:AtmosphereLevel}){
 const canvas=useRef<HTMLCanvasElement>(null);const [running,setRunning]=useState(false);
 useEffect(()=>{
  const node=canvas.current;if(!node)return;const ctx=node.getContext('2d');if(!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
  let width=0,height=0,dpr=1,frame=0,last=0,elapsed=0,dead=false;let drops:Drop[]=[];
  let frameCount=0,slowFrames=0,renderStride=1000/30;
  let seed=4011;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const rich=level==='rich';
  const resize=()=>{
   width=window.innerWidth;height=window.innerHeight;
   dpr=Math.max(.5,Math.min(devicePixelRatio||1,2,Math.sqrt(6000000/Math.max(1,width*height))));
   node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);
   ctx.setTransform(dpr,0,0,dpr,0,0);seed=4011;
   const count=rich?220:85;drops=Array.from({length:count},(_,i)=>{
    const depth=i/count;
    return{x:random(),y:random(),depth,speed:70+depth*290+random()*85,length:7+depth*depth*(rich?53:25),alpha:.06+depth*(rich?.33:.16)};
   });
  };
  const glow=(x:number,y:number,rx:number,ry:number,alpha:number)=>{
   ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(101,178,211,${alpha})`);g.addColorStop(.4,`rgba(107,140,187,${alpha*.5})`);g.addColorStop(1,'rgba(87,131,176,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  };
  const draw=(seconds:number)=>{
   ctx.clearRect(0,0,width,height);
   // Broad drifting cloud layers move on different time scales; no full-screen flashes.
   for(let i=0;i<(rich?5:3);i++){
    const x=width*(.13+i*.21+.13*Math.sin(seconds*.065+i*2));
    const y=height*(.24+.13*(i%3)+.025*Math.sin(seconds*.11+i));
    glow(x,y,width*(.25+.04*(i%2)),height*(.045+.025*(i%2)),rich?.105:.05);
   }
   ctx.lineCap='round';
   for(const d of drops){
    const y=(d.y*height+seconds*d.speed)%(height+100)-50;
    const x=(d.x*width+seconds*d.speed*.12)%(width+90)-45;
    ctx.strokeStyle=`rgba(174,218,240,${d.alpha})`;ctx.lineWidth=d.depth>.88?1.4:.65;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+d.length*.18,y+d.length);ctx.stroke();
   }
   // Larger, slower near-window beads add depth instead of replacing the 4K city plate.
   for(let i=0;i<(rich?17:6);i++){
    const x=width*(.025+((i*.173)% .95));
    const y=((i*.217*height+seconds*(10+i%4*3))%(height+160))-80;
    ctx.strokeStyle='rgba(202,234,251,.30)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(x,y,1.6+(i%3)*.5,4+i%4,0,Math.PI*.8,Math.PI*1.85);ctx.stroke();
    const trail=ctx.createLinearGradient(x,y-48,x,y);trail.addColorStop(0,'rgba(157,213,239,0)');trail.addColorStop(1,'rgba(157,213,239,.13)');ctx.strokeStyle=trail;ctx.beginPath();ctx.moveTo(x-.8,y-48);ctx.lineTo(x,y-7);ctx.stroke();
   }
   frameCount++;node.dataset.renderedFrames=String(frameCount);
  };
  const tick=(now:number)=>{
   if(dead)return;
   frame=requestAnimationFrame(tick);
   if(!last){last=now;return;}
   const delta=now-last;if(delta<renderStride-1)return;
   if(delta>95)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
   if(slowFrames>12){renderStride=1000/20;node.dataset.throttled='true';}
   elapsed+=Math.min(delta,100)/1000;last=now;draw(elapsed);
  };
  const update=()=>{
   cancelAnimationFrame(frame);frame=0;last=0;
   const active=enabled&&level!=='off'&&!document.hidden&&!reduced.matches&&!connection?.saveData;
   setRunning(active);node.dataset.running=String(active);
   if(active){resize();frame=requestAnimationFrame(tick);}else ctx.clearRect(0,0,width,height);
  };
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);connection?.addEventListener('change',update);update();
  return()=>{dead=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);connection?.removeEventListener('change',update);ctx.clearRect(0,0,width,height);};
 },[enabled,level]);
 return <canvas ref={canvas} className="df-atmosphere" aria-hidden="true" data-atmosphere={level} data-active={running?'true':'false'}/>;
}
''')

app='src/companion/CompanionApp.tsx'
replace(app,"import {SelectionWorkspace,type SelectionWorkspaceRef}","import {useDesktopLayout,displayedNotes,revealTarget} from './desktopNotes';\nimport {DesktopAtmosphere,type AtmosphereLevel} from '../immersion/DesktopAtmosphere';\nimport {SelectionWorkspace,type SelectionWorkspaceRef}")
replace(app,"export default function CompanionApp(){", "export default function CompanionApp(){\n  const desktop=useDesktopLayout();\n  const teacherScroll=useRef<HTMLDivElement>(null);\n  const [atmosphere,setAtmosphere]=useState<AtmosphereLevel>('rich');")
old="  const revealNote=()=>{const note=notes.find(n=>n.id===unreadNote);if(!note)return;setShowText(true);setExpandedNote(note.id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{const cards=scroller.current?.querySelectorAll<HTMLElement>('[data-note-for]');Array.from(cards||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'center',behavior:'smooth'});}));};"
new="""  const visibleNotes=displayedNotes(notes,lines,writtenEnabled),latestNote=visibleNotes.at(-1);
  const revealNote=()=>{const note=revealTarget(visibleNotes,unreadNote);if(!note)return;
    // On phones the note belongs to history; scenery has no mounted note to scroll to.
    // Desktop notes are already mounted in the rail, independent of subtitles/history.
    if(!desktop)setScenery(false);setShowText(true);setExpandedNote(note.id);
    readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const host=desktop?teacherScroll.current:scroller.current;const cards=host?.querySelectorAll<HTMLElement>('[data-note-for]');Array.from(cards||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'nearest',behavior:'smooth'});}));
  };"""
replace(app,old,new)
replace(app,'note={n} expanded={expandedNote===n.id}','note={n} showSource={desktop} expanded={expandedNote===n.id}')
replace(app,'data-immersion-release="immersion-20260911-v3"','data-immersion-release="immersion-20260911-v3" data-desktop-release="desktop-20260911-v4" data-desktop-focus={desktop?\'true\':\'false\'}')
replace(app,'onState={setAmbientStatus}/>','onState={setAmbientStatus}/>\n    {desktop&&<DesktopAtmosphere level={atmosphere} enabled={motionOn&&!studyOpen&&!practice&&(!sheet||sheet===\'scene\')}/> }')
replace(app,'<NeonMark/><span className="kc-neon-version">IMMERSION / 03</span>','<NeonMark/><span className="kc-neon-version">{desktop?\'DESKTOP / 04\':\'IMMERSION / 03\'}</span>')
replace(app,"{!practice&&notes.filter(n=>n.anchorId===line.id&&noteStillApplies(n,lines,writtenEnabled)).map(n=>noteCard(n))}","{!desktop&&!practice&&visibleNotes.filter(n=>n.anchorId===line.id).map(n=>noteCard(n))}")
replace(app,"{!showText&&view==='chat'&&notes.filter(n=>n.mode!=='auto'&&noteStillApplies(n,lines,writtenEnabled)).map(n=>noteCard(n))}","{!desktop&&!showText&&view==='chat'&&visibleNotes.filter(n=>n.mode!=='auto').map(n=>noteCard(n))}")
replace(app,"{scenery&&!practice&&<aside className=\"imm-scenery-now\">", "{scenery&&!practice&&<aside className=\"imm-scenery-now\" aria-label=\"当前对话\">")
replace(app,'          <footer className="kc-controls">','''          {desktop&&<aside className="df-teacher" aria-label="常驻文字教师">
            <header className="df-teacher-heading"><div><span>TEACHER / LIVE NOTES</span><h2>随聊笔记</h2></div><BookOpen size={20}/></header>
            <div className="df-teacher-scroll" ref={teacherScroll}>
              {notePending&&<p className="df-teacher-status" role="status">正在整理这一句…</p>}
              {noteError&&<p className="df-teacher-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}
              {latestNote? <div className="df-current-note" data-current-note={latestNote.id}>{noteCard(latestNote)}</div>:
                <div className="df-teacher-empty"><span>一次，只看一个重点</span><p>{writtenEnabled?'有值得留意的表达，会直接出现在这里。':'自动提示已关闭；仍可主动问词义、选中学习或点「接不上」。'}</p><p>也可以选中一句日语，点「学这段」。</p></div>}
              {visibleNotes.length>1&&<details className="df-earlier-notes"><summary>本次较早提示 · {visibleNotes.length-1}</summary>{visibleNotes.slice(0,-1).reverse().map(n=>noteCard(n))}</details>}
            </div>
            <footer className="df-teacher-foot"><span>先看懂，再试着说</span><button disabled={['connecting','error','closed'].includes(phase)||studyOpen} onClick={()=>act('help')}>帮我接一句</button></footer>
          </aside>}
          <footer className="kc-controls">''')
replace(app,"{unreadNote&&notes.some(n=>n.id===unreadNote&&noteStillApplies(n,lines,writtenEnabled))&&<button", "{!desktop&&unreadNote&&visibleNotes.some(n=>n.id===unreadNote)&&<button")
replace(app,"{noteError&&<p className=\"kc-note-error\"", "{!desktop&&noteError&&<p className=\"kc-note-error\"")
replace(app,"{notePending&&<p className=\"kc-note-pending\"", "{!desktop&&notePending&&<p className=\"kc-note-pending\"")
replace(app,"<p>循环背景静音；首次加载先显示高清静帧。", "{desktop&&<fieldset className=\"df-atmosphere-controls\"><legend>桌面环境动态</legend><div>{([['off','关闭'],['gentle','舒缓'],['rich','增强']] as const).map(([value,label])=><button key={value} aria-pressed={atmosphere===value} disabled={!motionOn} onClick={()=>setAtmosphere(value)}>{label}</button>)}</div><small>增强景深雨幕、玻璃雨点与雾流；不增加声音，不改变语速。</small></fieldset>}<p>循环背景静音；首次加载先显示高清静帧。")
replace(app,'<small>版本 9.11 · TEACHER / 02 · IMMERSION / 03</small>','<small>版本 9.11 · TEACHER / 02 · IMMERSION / 03 · DESKTOP / 04</small>')

card='src/companion/WrittenNoteCard.tsx'
replace(card,'onSpeak?:()=>void}', 'onSpeak?:()=>void;showSource?:boolean}')
replace(card,'onSupport,onPractice,onSave,onSpeak}:Props)', 'onSupport,onPractice,onSave,onSpeak,showSource=false}:Props)')
replace(card,'{expanded&&<div className="kc-note-body"', '{expanded&&<div className="kc-note-body"') if False else None
replace(card,'      <span className="kc-note-label">', '''      {showSource&&<details className="df-note-source"><summary>对应原句</summary><p lang="ja" data-study-id={'note-source-'+note.id} data-study-role={note.mode==='help'?'assistant':'user'}>{note.source}</p></details>}
      <span className="kc-note-label">''')

add('src/companion/desktopFocus.css', '''/* DESKTOP04 — wide scenery/conversation stage and one persistent teacher rail. */
.df-atmosphere{position:fixed;inset:0;width:100%;height:100%;pointer-events:none!important;z-index:1;opacity:1;contain:strict}.df-atmosphere[data-active="false"]{visibility:hidden}
.df-atmosphere-controls{border:1px solid #345366;border-radius:12px;padding:14px;margin:16px 0}.df-atmosphere-controls legend{padding:0 6px;color:#d8f7ff}.df-atmosphere-controls>div{display:flex;gap:8px}.df-atmosphere-controls button{min-height:40px;flex:1}.df-atmosphere-controls small{display:block;font-size:12px;line-height:1.7;color:#afc5d7;margin-top:10px}
@media(min-width:1100px){
 .kc-root[data-desktop-focus="true"]>.kc-shell{position:relative;z-index:2}
 .kc-root[data-desktop-focus="true"] .kc-shell.kc-chat{--df-rail:clamp(330px,27vw,420px);width:100%!important;max-width:none!important;height:100dvh!important;min-height:0!important;padding:0 24px 18px!important;gap:12px 22px!important;display:grid!important;grid-template-columns:minmax(0,1fr) var(--df-rail)!important;grid-template-rows:66px 40px minmax(0,1fr) auto!important;grid-template-areas:"header header" "switches teacher" "conversation teacher" "controls teacher"!important;overflow:hidden!important;box-sizing:border-box}
 .kc-root[data-desktop-focus="true"] .kc-chat>.kc-top{grid-area:header!important;position:relative!important;inset:auto!important;min-height:0!important;margin:0 -24px!important;padding:8px 24px!important;background:linear-gradient(180deg,rgba(4,10,20,.83),rgba(4,10,20,.30))!important;border-bottom:1px solid rgba(146,208,231,.17)!important;backdrop-filter:blur(14px)}
 .kc-root[data-desktop-focus="true"] .kc-top .kc-icon{width:42px!important;height:42px!important}.kc-root[data-desktop-focus="true"] .kc-top h1{font-size:17px!important;margin:0!important}.kc-root[data-desktop-focus="true"] .kc-top .kc-topic{font-size:12px!important;margin-top:3px!important}
 .kc-root[data-desktop-focus="true"] .kc-chat>.imm-view-switch{grid-area:switches!important;margin:0!important;padding:0!important;justify-content:flex-start!important;align-self:center!important;background:transparent!important}
 .kc-root[data-desktop-focus="true"] .imm-view-switch button{min-height:36px;padding:8px 15px;font-size:12px;backdrop-filter:blur(12px)}
 .kc-root[data-desktop-focus="true"] .kc-chat>.kc-conversation{grid-area:conversation!important;min-width:0!important;min-height:0!important;width:100%!important;max-width:none!important;margin:0!important;border:1px solid rgba(118,184,211,.20)!important;border-radius:18px!important;padding:24px!important;box-sizing:border-box;background:rgba(5,13,25,.83)!important;backdrop-filter:blur(18px);overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#416275 transparent}
 .kc-root[data-desktop-focus="true"] .kc-chat>.kc-conversation.imm-scenery-space{display:flex!important;flex-direction:column!important;justify-content:flex-end!important;border-color:transparent!important;padding:0!important;background:transparent!important;backdrop-filter:none!important;overflow:auto!important}
 .kc-root[data-desktop-focus="true"] .imm-scenery-space>.imm-scenery-now{width:min(100%,860px)!important;margin:0!important;padding:20px 24px!important;box-sizing:border-box;background:linear-gradient(110deg,rgba(6,14,28,.86),rgba(8,18,32,.65))!important;backdrop-filter:blur(18px)!important;border:1px solid rgba(151,212,237,.36)!important;border-radius:16px!important;box-shadow:0 12px 45px rgba(0,0,0,.18)}
 .kc-root[data-desktop-focus="true"] .imm-scenery-now .kc-tag{font-size:11px!important;letter-spacing:.12em!important;color:#85d3e7!important;margin-bottom:10px!important}.kc-root[data-desktop-focus="true"] .imm-scenery-now .kc-line{font-size:clamp(22px,1.85vw,32px)!important;line-height:1.75!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important;color:#f1f5fc!important;text-shadow:0 1px 8px rgba(0,0,0,.45)}
 .kc-root[data-desktop-focus="true"] .imm-scenery-now>.teacher-link{margin-top:10px;color:#b8d6e6;font-size:12px}.kc-root[data-desktop-focus="true"] .imm-last-user{font-size:14px;color:#bfd0df;margin:12px 0 0;line-height:1.65}
 .kc-root[data-desktop-focus="true"] .imm-scenery-label{top:160px!important;left:36px!important;color:#b7dae8!important;font-size:10px!important;letter-spacing:.3em!important;text-shadow:0 1px 8px #020814}.kc-root[data-desktop-focus="true"] .imm-scenery-label small{font-size:11px;letter-spacing:.1em;opacity:.7}
 .kc-root[data-desktop-focus="true"] .kc-chat>.kc-controls{grid-area:controls!important;position:relative!important;inset:auto!important;width:100%!important;max-width:none!important;min-height:0!important;margin:0!important;padding:10px 20px 9px!important;box-sizing:border-box;background:rgba(4,12,24,.85)!important;backdrop-filter:blur(18px);border:1px solid rgba(129,190,216,.28)!important;border-radius:16px!important;display:grid!important;grid-template-columns:1fr auto!important;grid-template-rows:auto auto auto!important;gap:4px 18px!important;grid-template-areas:"activity activity" "actions tools" "state tools"!important}
 .kc-root[data-desktop-focus="true"] .kc-controls>.kc-activity{grid-area:activity!important;margin:0!important;min-height:22px!important;font-size:11px!important}.kc-root[data-desktop-focus="true"] .kc-controls>.kc-action-row{grid-area:actions!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:clamp(24px,6vw,100px)!important;margin:0!important;padding:0!important}.kc-root[data-desktop-focus="true"] .kc-action-row>.kc-small{min-height:48px!important;padding:0!important;font-size:11px!important;gap:3px!important}.kc-root[data-desktop-focus="true"] .kc-action-row>.kc-small svg{width:22px!important;height:22px!important}
 .kc-root[data-desktop-focus="true"] .kc-action-row>.kc-mic{width:66px!important;height:66px!important;min-width:66px!important;min-height:66px!important;margin:0!important;border-width:2px!important;box-shadow:0 0 20px rgba(220,30,164,.19)!important}.kc-root[data-desktop-focus="true"] .kc-mic>svg{width:29px;height:29px}
 .kc-root[data-desktop-focus="true"] .kc-controls>.kc-mic-caption{grid-area:state!important;text-align:center!important;font-size:11px!important;margin:1px 0 0!important}.kc-root[data-desktop-focus="true"] .kc-controls>.kc-neon-tools{grid-area:tools!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:4px!important;padding:0 0 0 18px!important;margin:0!important;border-top:0!important;border-left:1px solid rgba(147,190,212,.23)!important}.kc-root[data-desktop-focus="true"] .kc-neon-tools button{min-height:30px!important;font-size:11px!important;padding:3px 0!important;justify-content:flex-start!important;gap:8px!important}.kc-root[data-desktop-focus="true"] .kc-neon-tools button svg{width:15px;height:15px}
 .df-teacher{grid-area:teacher;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(113,199,221,.35);border-radius:18px;background:rgba(4,13,25,.89);backdrop-filter:blur(24px);box-shadow:0 16px 60px rgba(0,0,0,.20)}
 .df-teacher-heading{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 16px;border-bottom:1px solid rgba(122,183,209,.20);flex-shrink:0}.df-teacher-heading span{font-size:10px;letter-spacing:.17em;color:#7bb6ca}.df-teacher-heading h2{font-size:19px;letter-spacing:.08em;color:#e5f6ff;margin:7px 0 0}.df-teacher-heading>svg{color:#75d9e9}
 .df-teacher-scroll{min-height:0;flex:1;overflow-y:auto;padding:18px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#416275 transparent;scroll-padding:12px}
 .df-teacher .kc-written-note{margin:0 0 14px!important;width:100%!important;box-sizing:border-box;border-color:rgba(118,182,211,.32)!important;background:rgba(15,33,51,.75)!important;box-shadow:none!important;border-radius:13px!important;max-width:none!important}
 .df-teacher .kc-note-heading{padding:12px 14px!important;min-height:44px!important;font-size:12px!important;line-height:1.5!important;color:#addbeb!important}.df-teacher .kc-note-body{padding:0 16px 16px!important}.df-teacher .kc-note-label{display:block;color:#8babbc!important;font-size:11px!important;margin:5px 0 8px!important}.df-teacher .kc-note-japanese{font-size:22px!important;line-height:1.8!important;color:#def9ff!important;padding:0!important;background:transparent!important;margin:0 0 14px!important;border:0!important}.df-teacher .kc-note-reason{font-size:14px!important;line-height:1.9!important;color:#cbdae6!important;margin:0 0 12px!important}.df-teacher .kc-note-body>details:not(.df-note-source){font-size:13px;line-height:1.9;color:#c5d5e4}.df-teacher .kc-note-body>details>summary{cursor:pointer;min-height:30px;color:#98bed2}
 .df-teacher .kc-note-use,.df-teacher .teacher-note-actions button{font-size:12px!important;min-height:36px!important}.df-teacher .teacher-note-actions{display:flex;gap:7px;flex-wrap:wrap}.df-note-source{margin:0 0 14px;font-size:12px;line-height:1.8;color:#a5bfd1;border-bottom:1px solid rgba(160,194,215,.16);padding-bottom:8px}.df-note-source p{font-size:16px;color:#b2c7d9;line-height:1.9;margin:7px 0;overflow-wrap:anywhere}.df-note-source summary{cursor:pointer}
 .df-teacher-empty{padding:16px 8px;color:#a9c0d2;font-size:14px;line-height:1.9}.df-teacher-empty>span{font-size:17px;color:#d8e7f3;display:block;margin:6px 0 18px}.df-teacher-empty p{margin:0 0 12px}.df-teacher-status{font-size:13px;color:#a6d8e7;margin:0 0 14px}.df-teacher-error{border:1px solid #b38350;border-radius:10px;padding:12px;color:#f6d5a6;font-size:13px;line-height:1.75}.df-teacher-error button{display:block;margin-top:8px;min-height:36px;color:inherit;background:none;border:1px solid currentColor;border-radius:8px;padding:5px 10px;cursor:pointer}
 .df-earlier-notes{margin-top:22px;border-top:1px solid rgba(160,194,215,.2);padding-top:12px}.df-earlier-notes>summary{color:#9fb9cd;font-size:12px;cursor:pointer;line-height:1.7;min-height:38px}.df-teacher-foot{padding:13px 18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(147,190,212,.18);gap:10px;flex-shrink:0}.df-teacher-foot>span{font-size:11px;color:#89a8bc}.df-teacher-foot>button{border:1px solid #407d94;border-radius:8px;background:rgba(27,82,101,.28);color:#c8f3ff;min-height:36px;padding:7px 12px;font-size:12px;cursor:pointer}.df-teacher-foot>button:disabled{opacity:.45;cursor:default}
 .kc-root[data-desktop-focus="true"] .kc-conversation .teacher-studio{max-width:780px;margin:0 auto}.kc-root[data-desktop-focus="true"] .kc-conversation .kc-line{font-size:clamp(19px,1.7vw,28px)}
}
@media(min-width:1700px){.kc-root[data-desktop-focus="true"] .kc-shell.kc-chat{padding-left:40px!important;padding-right:40px!important;gap:16px 28px!important;grid-template-rows:72px 44px minmax(0,1fr) auto!important}.kc-root[data-desktop-focus="true"] .kc-chat>.kc-top{margin-left:-40px!important;margin-right:-40px!important;padding-left:40px!important;padding-right:40px!important}.kc-root[data-desktop-focus="true"] .imm-scenery-label{left:52px!important;top:175px!important}.df-teacher-scroll{padding:22px}}
@media(prefers-reduced-motion:reduce){.df-atmosphere{display:none!important}}
''')
replace('src/companion/main.tsx',"import '../immersion/immersion.css';", "import '../immersion/immersion.css';\nimport './desktopFocus.css';")
print('DESKTOP04 source prepared. Full regression and exact deployed-asset verification are required.')
