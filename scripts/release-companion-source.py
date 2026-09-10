from pathlib import Path

def replace(path, before, after):
    p=Path(path);text=p.read_text()
    if after in text: return
    if text.count(before)!=1: raise RuntimeError('Non-unique integration anchor: '+path+' '+before[:60])
    p.write_text(text.replace(before,after))

replace('src/companion/connection.ts','private written:WrittenLane|null=null;', 'private reconnectGrace:ReturnType<typeof setTimeout>|undefined;private written:WrittenLane|null=null;')
replace('src/companion/connection.ts',"pc.onconnectionstatechange=()=>{if(!this.ended&&['disconnected','failed','closed'].includes(pc.connectionState))this.fail('connection_lost');};", "pc.onconnectionstatechange=()=>{if(this.ended)return;if(pc.connectionState==='connected'){clearTimeout(this.reconnectGrace);return;}if(pc.connectionState==='disconnected'){clearTimeout(this.reconnectGrace);this.reconnectGrace=setTimeout(()=>{if(!this.ended&&pc.connectionState==='disconnected')this.fail('connection_lost');},6000);return;}if(['failed','closed'].includes(pc.connectionState))this.fail('connection_lost');};")
replace('src/companion/connection.ts',"action(action:Action){if(this.ended||!this.linked)return;if(action==='help')this.pendingAssistance='example';", "action(action:Action){if(this.ended||!this.linked)return;if(action==='help'){this.writtenHelp();return;}")
replace('src/companion/connection.ts','this.ended=true;this.written?.dispose();', 'this.ended=true;clearTimeout(this.reconnectGrace);this.written?.dispose();')
replace('src/companion/connection.ts',"catch(e){if(!this.ended)this.fail(e instanceof Error?e.message:'heartbeat_failed');}finally{this.heartbeatBusy=false;}", "catch(e){if(this.ended)return;try{await companionApi('heartbeat',{...this.ticket},this.abort.signal);}catch{if(!this.ended)this.fail(e instanceof Error?e.message:'heartbeat_failed');}}finally{this.heartbeatBusy=false;}")
replace('src/companion/writtenFeedback.ts','什么意思|怎么说|怎么读|语法|助词|自然吗|说得对吗|区别|どういう意味|という意味|何と言|どう言|文法|自然ですか|意味を教', '什么意思|什么含义|怎么说|怎么表达|如何表达|怎么读|语法|助词|自然吗|说得对吗|区别|どういう意味|という意味|って何|とは何|何と言|どう言|文法|自然ですか|意味を教')
Path('supabase/functions/nihongo-companion/writtenContract.ts').write_text(Path('src/companion/writtenFeedback.ts').read_text())
replace('supabase/functions/nihongo-companion/writtenFeedback.ts', "For no-pet/video contrast, preserve both parts.", "The latest question takes priority over an older prepared sentence: for WHY busy, merely repeating 昨日は忙しかったです does NOT answer it. Supply a short possible answer or starter, explicitly labelled as an example when unknown; do not pretend to know a job/reason/preference. Preserve relevant contrasts when the current question calls for them.")
replace('supabase/functions/nihongo-companion/writtenFeedback.ts',"const common='You are a careful Japanese teacher", "const common='Match the requested target: 0 or 1 needs one short familiar clause or starter; 2 may add one concrete detail; 3 may connect ideas. Never make a grammatical response harder for decoration. Examples are illustrative, not claims about the user. You are a careful Japanese teacher")
replace('scripts/companion-preview-access.mjs',"const base='https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app';", "const base=process.env.TEST_BASE_URL||'https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app';")
replace('src/companion/CompanionApp.tsx', 'data-companion="native-v3"', 'data-companion="native-v3" data-release="quiet-20260910"')
replace('src/companion/CompanionApp.tsx','日语陪聊 · 试用','日语陪聊')
print('Reviewed release integration applied; only named companion files changed.')
