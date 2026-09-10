"""One-time, reviewable source edit on the independent preview branch. Not a build-time transform.
Every replacement must match exactly once; generated edits are committed before acceptance tests.
No credentials, database operations, old learning schemas or production refs are touched.
"""
from pathlib import Path
p=Path('.')
def edit(f,a,b):
 s=(p/f).read_text(); assert s.count(a)==1,(f,a[:90],s.count(a)); (p/f).write_text(s.replace(a,b))
edit('src/companion/connection.ts',"import {NativeTurnGate} from './turns';","import {NativeTurnGate} from './turns';\nimport {WrittenLane} from './writtenLane';\nimport type {WrittenNote} from './writtenFeedback';")
edit('src/companion/connection.ts','policy:(p:Policy)=>void};','policy:(p:Policy)=>void;written?:(note:WrittenNote)=>void;writtenPending?:(busy:boolean)=>void};')
edit('src/companion/connection.ts','private heartbeatBusy=false;','private heartbeatBusy=false;\n  private written:WrittenLane|null=null;private policyEpoch=0;private noteSeen=new Set<string>();')
edit('src/companion/connection.ts','this.publishActivity();});}',"this.publishActivity();});if(hooks.written)this.written=new WrittenLane(async(input,signal)=>{if(this.ended||!this.ticket)throw new Error('session_closed');const r=await companionApi('feedback',{...this.ticket,input},signal);return r.note;},hooks.written,hooks.writtenPending);}")
edit('src/companion/connection.ts','private changed(){this.hooks.lines(this.ledger.ordered());}',"private changed(){const lines=this.ledger.ordered();this.hooks.lines(lines);this.written?.update(lines,this.policy.target);}\n  writtenHelp(){this.written?.help();}\n  setWrittenEnabled(value:boolean){this.written?.setEnabled(value);}\n  setReadingNote(value:boolean){this.written?.setReading(value);}\n  dismissNote(anchorId:string){this.written?.dismiss(anchorId);}\n  exposeNote(id:string){if(this.noteSeen.has(id)||this.ended)return;this.noteSeen.add(id);this.pendingAssistance='hint';this.policyEpoch++;this.nextPolicy=null;this.observerAbort?.abort();}")
edit('src/companion/connection.ts','const unfinished=this.gate.speaking;this.gate.speaking=false;','const unfinished=this.gate.speaking;this.gate.speaking=false;this.written?.setSpeaking(false);')
edit('src/companion/connection.ts','this.gate.commit(id);this.changed();this.flushSoon();}','this.gate.commit(id);this.userTurns++;this.changed();this.flushSoon();}')
edit('src/companion/connection.ts','this.seed=seed;this.topicEpoch++;','this.seed=seed;this.topicEpoch++;this.written?.reset();')
edit('src/companion/connection.ts','changeDifficulty(delta:number){this.policy=changeChallenge','changeDifficulty(delta:number){this.policyEpoch++;this.nextPolicy=null;this.observerAbort?.abort();this.policy=changeChallenge')
edit('src/companion/connection.ts','const epoch=this.topicEpoch,revision=this.policy.revision;','const epoch=this.topicEpoch,revision=this.policy.revision,policyEpoch=this.policyEpoch;')
edit('src/companion/connection.ts','revision!==this.policy.revision)return;','revision!==this.policy.revision||policyEpoch!==this.policyEpoch)return;')
edit('src/companion/connection.ts',"this.gate.speaking=true;this.speakingItem=String(e.item_id||'');","this.gate.speaking=true;this.written?.setSpeaking(true);this.speakingItem=String(e.item_id||'');")
edit('src/companion/connection.ts',"this.gate.speaking=false;this.speakingItem='';if(this.gate.hasPending)","this.gate.speaking=false;this.written?.setSpeaking(false);this.speakingItem='';if(this.gate.hasPending)")
edit('src/companion/connection.ts',"this.gate.speaking=false;this.speakingItem='';}this.ledger.upsert(id","this.gate.speaking=false;this.written?.setSpeaking(false);this.speakingItem='';}this.ledger.upsert(id")
edit('src/companion/connection.ts','this.ended=true;this.wantsMic=false;','this.ended=true;this.written?.dispose();this.noteSeen.clear();this.wantsMic=false;')
edit('server/companionProxy.ts',"'topics','observe'","'topics','observe','feedback'")
edit('supabase/functions/nihongo-companion/index.ts',"import {topics,observe} from './content.ts';","import {topics,observe} from './content.ts';\nimport {writtenFeedback} from './writtenFeedback.ts';")
edit('supabase/functions/nihongo-companion/index.ts',"['heartbeat','stop','observe']","['heartbeat','stop','observe','feedback']")
edit('supabase/functions/nihongo-companion/index.ts','return reply({ok:true,observations:await observe(k,body)});',"if(action==='feedback')return reply({ok:true,...await writtenFeedback(k,body)});\n      return reply({ok:true,observations:await observe(k,body)});")
for f in ['src/companion/prompt.ts','supabase/functions/nihongo-companion/prompt.ts']:
 edit(f,"  '# 真实与边界","  '# 安静的文字老师（优先于前面的教学示例）\\n主动语法修正、句子扩展、词义解释由独立文字便签提供；你不要把便签读出来，不点评用户日语，不让用户听完一段课才能接话。用户问日语时，普通情况只简短回应“文字で説明しますね。”然后等，不追加新问题；只有明确要求用声音解释/读一下/讲给我听，才给一句直接答案或朗读。普通聊天照常听懂本意、接内容，允许单词和半句。不要宣称我也看猫视频、我也喝咖啡、我昨天经历过；没有这些真人生活经历。对于只说词的用户，一次一个很熟悉的小意思，不顺手追加长句或高级抽象词。',\n  '# 真实与边界")
f='src/companion/CompanionApp.tsx'
edit(f,"import type {VoiceActivity}","import {WrittenNoteCard} from './WrittenNoteCard';\nimport type {WrittenNote} from './writtenFeedback';\nimport type {VoiceActivity}")
edit(f,'  const [memory,setMemory]',"  const [notes,setNotes]=useState<WrittenNote[]>([]),[expandedNote,setExpandedNote]=useState(''),[writtenEnabled,setWrittenEnabled]=useState(true),[notePending,setNotePending]=useState(false);\n  const readingNote=useRef(false),followBottom=useRef(true);\n  const [memory,setMemory]")
edit(f,'useEffect(()=>{if(scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[lines,phase]);','useEffect(()=>{const el=scroller.current;if(el&&followBottom.current&&!readingNote.current)el.scrollTop=el.scrollHeight;},[lines,phase]);\n  useEffect(()=>{conn.current?.setWrittenEnabled(writtenEnabled&&showText);},[writtenEnabled,showText]);')
edit(f,"setLines([]);setActivity(silent);setError('');setNotice('');","setLines([]);setNotes([]);setExpandedNote('');setNotePending(false);readingNote.current=false;followBottom.current=true;setActivity(silent);setError('');setNotice('');")
edit(f,'policy:p=>{if(current())',"written:n=>{if(current()){setNotes(old=>[...old.filter(x=>x.anchorId!==n.anchorId),n].slice(-24));if(!readingNote.current)setExpandedNote(n.id);}},writtenPending:v=>{if(current())setNotePending(v);},policy:p=>{if(current())")
edit(f,'conn.current=c;c.setPace(speed);void c.start();','conn.current=c;c.setPace(speed);c.setWrittenEnabled(writtenEnabled&&showText);void c.start();')
edit(f,'const finish=()=>{setSheet(null);conn.current?.end();setLines([]);};','const finish=()=>{setSheet(null);conn.current?.end();setLines([]);setNotes([]);setNotePending(false);};')
edit(f,'const useSeed=(next:Seed)=>{setSeed(next);',"const useSeed=(next:Seed)=>{setNotes([]);setExpandedNote('');readingNote.current=false;conn.current?.setReadingNote(false);setSeed(next);")
edit(f,"const act=(action:'help'|'repeat'|'simpler'|'repair')=>{setSheet(null);conn.current?.action(action);};","const act=(action:'help'|'repeat'|'simpler'|'repair')=>{setSheet(null);if(action==='help'){setShowText(true);readingNote.current=false;conn.current?.setReadingNote(false);conn.current?.writtenHelp();return;}conn.current?.action(action);};\n  const toggleNote=(id:string)=>{const next=expandedNote===id?'':id;setExpandedNote(next);readingNote.current=!!next;followBottom.current=false;conn.current?.setReadingNote(!!next);};")
edit(f,"const visible=lines.filter(l=>l.text).slice(-5);","const visible=lines.filter(l=>l.text).slice(-32);")
edit(f,'<main className="kc-conversation" ref={scroller} aria-label="当前对话">','<main className="kc-conversation" ref={scroller} aria-label="当前对话" onScroll={e=>{const el=e.currentTarget;followBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;}}>')
edit(f,'<article key={line.id} className=','<article key={line.id} data-line-id={line.id} className=')
edit(f,'{line.interrupted&&<small>刚才这一句已打断</small>}</article>','{line.interrupted&&<small>刚才这一句已打断</small>}{!line.interrupted&&notes.filter(n=>n.anchorId===line.id&&n.source===line.text.slice(0,700)).map(n=><WrittenNoteCard key={n.id} note={n} expanded={expandedNote===n.id} onToggle={()=>toggleNote(n.id)} onDismiss={()=>{conn.current?.dismissNote(n.anchorId);setNotes(old=>old.filter(x=>x.id!==n.id));readingNote.current=false;conn.current?.setReadingNote(false);}} onSeen={()=>conn.current?.exposeNote(n.id)}/>)}</article>')
edit(f,'<footer className="kc-chat-bottom">','<footer className="kc-chat-bottom">\n          {notePending&&<p className="kc-note-pending">在想一个你用得上的说法，聊天照常。</p>}')
edit(f,'<p>先听一句，点麦克风后才收音。</p>','<p>先听一句，点麦克风后才收音。<br/>文字小提示会安静出现，可以在偏好里关闭。</p>')
edit(f,'<button onClick={toggleMemory}','<button className="kc-note-setting" onClick={()=>setWrittenEnabled(v=>!v)} aria-pressed={writtenEnabled}><span><strong>随句文字小提示</strong><small>修一点、接长一点，不插入语音。仅本次聊天。</small></span><span className={`kc-switch ${writtenEnabled?\'checked\':\'\'}`}/></button>\n          <button onClick={toggleMemory}')
edit(f,'可以随时用中文问“什么意思”或“怎么说”。<br/>','可以随时用中文问“什么意思”或“怎么说”，默认用文字说明；说“讲给我听”才语音讲解。<br/>')
# News anchors are chosen by index and attached from the original publisher excerpt, not recopied by a model.
f='supabase/functions/nihongo-companion/content.ts'
edit(f,"'sourceIndex','sourceQuote'","'sourceIndex','evidenceIndex'")
edit(f,"sourceQuote:{type:'string',description:'新闻为正文中连续20至260字符的原句，逐字复制，不翻译；非新闻为空字符串。'}","evidenceIndex:{type:'integer',description:'新闻从所选article.evidence中选择支持背景的原文下标，从0开始；非新闻为-1。'}")
edit(f,'let articles:VerifiedNews[]=[];',"let articles:Array<VerifiedNews&{evidence:string[]}>=[];const trace=(stage:string,count:number)=>console.info(JSON.stringify({event:'companion_news_stage',stage,count}));")
edit(f,"articles=await publisherNews();\n  if(!articles.length)throw new ServiceError('news_unavailable',503);","articles=(await publisherNews()).map(a=>({...a,evidence:(a.excerpt.match(/[^。.!?]+[。.!?]?/gu)||[]).map(t=>t.trim()).filter(t=>t.length>=20).slice(0,10).map(t=>t.slice(0,250))})).filter(a=>a.evidence.length);trace('verified_articles',articles.length);\n  if(!articles.length)throw new ServiceError('news_source_unavailable',503);")
edit(f,'必须逐字复制sourceQuote并填sourceIndex。','sourceIndex是articles数组从0开始的下标，evidenceIndex是该原文evidence数组从0开始的下标。选择支持背景的原句，依据由程序原样附上。')
edit(f,'sourceIndex=-1,sourceQuote=""','sourceIndex=-1,evidenceIndex=-1')
edit(f,'if(!article||!sourceQuoteSupported(item.sourceQuote,article)',"const quote=article&&Number.isInteger(item.evidenceIndex)?article.evidence[item.evidenceIndex]:null;\n   if(!article||!sourceQuoteSupported(quote,article)")
edit(f,'${item.sourceQuote}','${quote}')
edit(f,'let accepted=candidates;',"if(lane==='news')trace('grounded_candidates',candidates.length);\n let accepted=candidates;")
edit(f,'const result:Seed[]=[];',"if(lane==='news')trace('aligned_candidates',accepted.length);\n const result:Seed[]=[];")
edit(f,"lane==='news'?'news_unavailable':'topics_unavailable'","lane==='news'?(candidates.length?'news_alignment_rejected':'news_evidence_rejected'):'topics_unavailable'")
f='supabase/functions/nihongo-companion/publisherFeed.ts'
edit(f,"if(!r.ok||Number(r.headers.get('content-length'))>MAX_BYTES)return '';","console.info(JSON.stringify({event:'companion_feed',host:new URL(url).hostname,status:r.status}));if(!r.ok||Number(r.headers.get('content-length'))>MAX_BYTES)return '';")
edit(f,"}catch{return '';}\n}","}catch{console.info(JSON.stringify({event:'companion_feed',host:new URL(url).hostname,status:'fetch_failed'}));return '';}\n}")
edit(f,'const articles=await Promise.all',"console.info(JSON.stringify({event:'companion_feed_candidates',count:urls.length}));\n const articles=await Promise.all")
# Existing phone smoke must exercise the new silent UI behavior, not fabricate another audio turn.
f='scripts/companion-phone.mjs'
edit(f,"if(body.action==='companion_topics')", "if(body.action==='companion_feedback'){const i=body.input;return route.fulfill({json:{ok:true,note:i.mode==='help'?{id:i.requestId,anchorId:i.anchorId,source:i.source,kind:'wording',mode:i.mode,certainty:'clear',meaningPreserved:true,suggestion:'寝ている猫を見るのが好きです。',reasonZh:'借用这句，也可以换成自己的意思。',detailZh:''}:null}});}if(body.action==='companion_topics')")
edit(f,"await page.getByRole('button',{name:'接不上',exact:true}).click();await page.waitForTimeout(500);await reply('例えば、「寝ている猫を見るのが好きです」。');", "const beforeHelp=await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').length);await page.getByRole('button',{name:'接不上',exact:true}).click();await page.locator('.kc-written-note').waitFor();assert.equal(await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').length),beforeHelp);await page.screenshot({path:`artifacts/companion-phone/written-${viewport.width}.png`,fullPage:true});")
print('Reviewed source edits applied. Commit exact generated files before acceptance; no production/data/credential changes.')
