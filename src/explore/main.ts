import './style.css';
import {createWorld,type World,type TargetId} from './world';
import {loadProgress,saveProgress,turnText,reply,PHRASES,price,recordSeen,markHint,type PhraseId,type Progress} from './state';
import {ROAD,ROAD_LENGTH,sampleRoad} from './geo';
import {SpeechPlayer} from './audio';

if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{});},{once:true});
const root=document.querySelector<HTMLDivElement>('#explore-root')!;
const icon=(name:string)=>{const paths:Record<string,string>={map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16m6-14v16"/>',book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',sound:'<path d="m3 9 5 0 5-4v14l-5-4H3Z"/><path d="M17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',bag:'<path d="M5 7h14l1 14H4Zm4 0V5a3 3 0 0 1 6 0v2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',home:'<path d="m3 10 9-7 9 7v11H3Zm6 11v-8h6v8"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',pause:'<path d="M8 5v14m8-14v14"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.spark}</svg>`;};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let loaded:ReturnType<typeof loadProgress>;
try{loaded=loadProgress(localStorage);}catch{loaded={progress:loadProgress({getItem(){throw Error();}}).progress,writable:false,warning:'浏览器禁止存储，本次只试玩，不会保存进度。'};}
let progress:Progress=loaded.progress,writable=loaded.writable,world:World|null=null,started=false,modal='',showHints=false,showTranslation=false,usedHint=false,lastReply='',currentSpeech='',audioState='idle',audioMessage='';
let lastFocus:HTMLElement|null=null,toastTimer=0;
root.innerHTML=`<canvas id="street" tabindex="0" aria-label="第一人称谷中街道。使用 WASD 行走，鼠标拖动转向，E 互动。"></canvas>
<div class="vignette" aria-hidden="true"></div>
<header class="topbar"><a class="brand" href="/" aria-label="返回 NHK 学习">${icon('spark')}<span>日本散步日记<small>Y A N A K A</small></span></a><div class="top-actions"><span class="build-label">可玩样片 01</span><a class="round-button old-entry" href="/" title="NHK 学习">${icon('book')}<span>NHK 学习</span></a><button class="round-button" id="about" aria-label="地图来源与操作帮助">${icon('help')}</button></div></header>
<div class="intro" id="intro"><div class="eyebrow"><span></span> TOKYO · YANAKA</div><h1 lang="ja">谷中を、<br>歩こう。</h1><p class="intro-zh">沿着小街走一走，<br>用日语，买一份今天的晚饭。</p><button class="start-button" id="start" disabled><span>正在铺开街道…</span>${icon('arrow')}</button><p class="intro-note">真实道路 · 游戏化街景 · 自由行走</p><p class="prototype-note">首个交互样片，非最终美术品质</p></div>
<div class="welcome-stamp" id="stamp"><span>さんぽ日和</span><small>01 / 街角のごはん</small></div>
<div id="hud" hidden><div class="chapter"><span class="chapter-index">01</span><div><small>谷中銀座</small><strong id="objective">去右侧的「よりみち弁当」</strong></div></div><nav class="toolbelt" aria-label="散步工具"><button id="map" title="小地图">${icon('map')}<span>地图</span></button><button id="notebook" title="散步笔记">${icon('book')}<span>笔记</span></button><button id="inventory" title="随身物品">${icon('bag')}<span>口袋</span></button><button id="pause" title="暂停">${icon('pause')}<span>暂停</span></button></nav><span class="crosshair" aria-hidden="true"></span><button id="interact" class="interact" hidden><kbd>E</kbd><span></span></button><div id="controls-hint" class="controls-hint"><kbd>W A S D</kbd> 行走 <span>·</span> 拖动 / 点击画面转向 <span>·</span> <kbd>E</kbd> 互动</div><div class="touch-controls"><div id="joystick" role="group" aria-label="移动摇杆"><span id="stick"></span></div><div id="lookpad" aria-label="滑动这里转向"><span>滑动转向</span></div></div><div class="held-item" id="held-item" hidden><div class="bento-drawing"><span>弁当</span></div><small>晚饭买好啦</small></div></div>
<div class="bottom-credit"><button id="credit">© OpenStreetMap contributors · 道路来源</button><span id="save-state">独立游戏存档</span></div>
<div class="portrait-hint">横过手机，街道更宽一点。</div>
<div id="toast" class="toast" role="status" hidden></div><div id="modal-layer" hidden></div>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const speech=new SpeechPlayer((state,message)=>{audioState=state;audioMessage=message;updateAudioUI();});
function updateAudioUI(){const button=document.getElementById('speak');if(button){button.innerHTML=icon('sound')+`<span>${audioState==='loading'?'准备中…':audioState==='playing'?'停止朗读':'重听这句话'}</span>`;button.setAttribute('aria-busy',String(audioState==='loading'));}const status=document.getElementById('audio-status');if(status)status.textContent=audioMessage;const fallback=document.getElementById('system-voice');if(fallback)fallback.hidden=audioState!=='error';}
function toast(text:string){window.clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=window.setTimeout(()=>{$('toast').hidden=true;},4500);}
function persist(){if(!world)return;progress={...progress,pose:world.getPose()};if(writable){try{if(!saveProgress(localStorage,progress)){writable=false;$('save-state').textContent='暂未保存';toast('游戏进度暂时无法保存，原有 NHK 记录没有被改动。');}else $('save-state').textContent='游戏进度已保存';}catch{writable=false;$('save-state').textContent='暂未保存';}}}
function updateHUD(){world?.setProgress(progress);$('objective').textContent=progress.purchase.paid?'晚饭买好了，继续随意走走':progress.purchase.step==='order'?'去右侧的「よりみち弁当」':'继续和便当店员聊聊';$('held-item').hidden=!progress.purchase.paid;$('held-item').classList.toggle('in-bag',Boolean(progress.purchase.bag));}
function closeModal(){speech.stop();$('modal-layer').hidden=true;$('modal-layer').replaceChildren();modal='';world?.pause(!started);lastFocus?.focus();lastFocus=null;persist();}
function modalFrame(kind:string,title:string,body:string,wide=false){
  speech.stop();if(!modal)lastFocus=document.activeElement as HTMLElement;modal=kind;world?.pause(true);
  const layer=$('modal-layer');layer.hidden=false;layer.innerHTML=`<section class="panel ${wide?'wide':''} ${kind==='shop'?'dialogue-panel':''}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><small>${kind==='shop'?'よりみち弁当 · 店员 美咲':'日本散步日记'}</small><h2 id="panel-title">${title}</h2></div><button class="icon-button close-panel" aria-label="关闭">${icon('close')}</button></header>${body}</section>`;
  layer.querySelector<HTMLButtonElement>('.close-panel')!.onclick=closeModal;
  window.setTimeout(()=>layer.querySelector<HTMLButtonElement>('button')?.focus(),0);
}
function voiceRow(text:string){currentSpeech=text;return `<div class="voice-row"><button class="text-button" id="speak">${icon('sound')}重听这句话</button><span id="audio-status" role="status"></span><button id="system-voice" class="text-button" hidden>改用系统日语声音</button></div>`;}
function wireVoice(){const button=document.getElementById('speak');if(button)button.onclick=()=>{if(audioState==='playing'||audioState==='loading')speech.stop();else void speech.play(currentSpeech);};const fallback=document.getElementById('system-voice');if(fallback)fallback.onclick=()=>speech.system(currentSpeech);updateAudioUI();}
function bookmark(id:PhraseId){progress={...progress,bookmarked:progress.bookmarked.includes(id)?progress.bookmarked.filter(k=>k!==id):[...progress.bookmarked,id]};persist();const button=document.getElementById('bookmark');if(button)button.textContent=progress.bookmarked.includes(id)?'已放入笔记':'收藏这句';}
function renderShop(){
  const turn=turnText(progress),done=progress.purchase.paid;
  modalFrame('shop',done?'一份晚饭，一次小小的交流。':'今天，想吃点什么？',`
    <div class="speaker-line"><span class="avatar-dot">美</span><div class="spoken"><p lang="ja" id="npc-line">${escape(turn.ja)}</p>${showTranslation?`<p class="translation">${escape(turn.zh)}</p>`:''}</div></div>
    ${voiceRow(turn.ja)}
    ${lastReply?`<p class="your-line"><small>你说</small><span lang="ja">${escape(lastReply)}</span></p>`:''}
    ${done?`<div class="receipt"><div class="receipt-stamp">ありがとう</div><h3>日替わり弁当 × 1</h3><p>${progress.purchase.warm?'热乎乎的':'未加热的'}便当 · ${progress.purchase.bag?'装进袋子':'不用袋子'}</p><dl><dt>本次支付</dt><dd>¥ ${price(progress)}</dd><dt>剩余游戏零钱</dt><dd>¥ ${progress.coins}</dd></dl></div><button id="leave" class="primary-button">拿上便当，继续散步 ${icon('arrow')}</button>`:`<form id="reply-form"><label for="reply-input">用自己的日语回应</label><div class="input-row"><input id="reply-input" lang="ja" type="text" autocomplete="off" maxlength="160" placeholder="慢慢说，不用着急。"/><button class="primary-button" type="submit">回应 ${icon('arrow')}</button></div></form><p id="reply-error" class="inline-error" role="status"></p><div class="help-row"><button class="text-button" id="hint-toggle">${showHints?'收起表达':'借一句表达'}</button><button class="text-button" id="translation-toggle">${showTranslation?'收起中文':'看看意思'}</button><button class="text-button" id="bookmark">${progress.bookmarked.includes(turn.phrase)?'已放入笔记':'收藏这句'}</button></div>${showHints?`<div class="choices">${turn.choices.map((text,i)=>`<button class="choice" data-choice="${i}" lang="ja">${escape(text)} ${icon('arrow')}</button>`).join('')}</div><div class="phrase-note"><strong lang="ja">${escape(PHRASES[turn.phrase].ja)}</strong><p>${escape(PHRASES[turn.phrase].note)}</p></div>`:''}`}
    <p class="dialogue-footnote">游戏内虚构店铺。当前为场景内常用表达识别，不是开放式 AI 对话。</p>`);
  wireVoice();
  if(done){$('leave').onclick=closeModal;return;}
  $('reply-form').onsubmit=e=>{e.preventDefault();submitReply($<HTMLInputElement>('reply-input').value,false);};
  $('hint-toggle').onclick=()=>{showHints=!showHints;if(showHints){usedHint=true;progress=markHint(progress);persist();}renderShop();};
  $('translation-toggle').onclick=()=>{showTranslation=!showTranslation;renderShop();};
  $('bookmark').onclick=()=>bookmark(turn.phrase);
  document.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b=>b.onclick=()=>submitReply(turn.choices[Number(b.dataset.choice)],true));
}
function submitReply(raw:string,assisted:boolean){
  const result=reply(progress,raw,assisted||usedHint);if(!result.accepted){$('reply-error').textContent=result.message;return;}
  progress=result.progress;lastReply=raw.trim();showHints=false;usedHint=false;updateHUD();persist();renderShop();void speech.play(currentSpeech);
}
function interact(id:TargetId){
  progress={...progress,visited:[...new Set([...progress.visited,id])]};persist();showHints=false;showTranslation=false;usedHint=false;lastReply='';
  if(id==='shop'){renderShop();void speech.play(currentSpeech);return;}
  const data={guide:{title:'一位熟悉这条街的居民',ja:'お弁当屋さんは、この先の右側です。',zh:'便当店就在前面右手边。',note:'沿街向前走，找到绿色门帘的「よりみち弁当」。',phrase:'directions' as PhraseId},menu:{title:'今天的菜单',ja:'日替わり弁当、六百五十円です。',zh:'每日便当，650 日元。',note:'日替わり（ひがわり）：每天更换内容。门帘中间可以走进去。',phrase:'order' as PhraseId},notice:{title:'路边的告示',ja:'今週末、まちの広場で小さな市を開きます。',zh:'这周末，街区广场会举办一个小市集。',note:'这是剧情告示，不是真实活动信息；市集尚未加入本样片。',phrase:null},cat:{title:'路地裏で、ひと休み。',ja:'猫が日なたで休んでいます。',zh:'猫正在向阳的地方休息。',note:'日なた（ひなた）：阳光照到的地方。走累了，就在这里停一会儿。',phrase:null}}[id];
  modalFrame(id,data.title,`<p class="observation-ja" lang="ja">${escape(data.ja)}</p>${voiceRow(data.ja)}<details class="meaning"><summary>看看意思</summary><p>${escape(data.zh)}</p><p>${escape(data.note)}</p></details>${data.phrase?`<button class="secondary-button" id="bookmark">${progress.bookmarked.includes(data.phrase)?'已放入笔记':'收藏这句'}</button>`:''}<button class="primary-button" id="keep-walking">继续散步 ${icon('arrow')}</button>`);
  wireVoice();if(data.phrase){const phrase=data.phrase;$('bookmark').onclick=()=>bookmark(phrase);progress=recordSeen(progress,phrase);persist();}$('keep-walking').onclick=closeModal;void speech.play(currentSpeech);
}
function notebook(){
  const ids=progress.bookmarked;
  modalFrame('notebook','沿途记下的日语',`<p class="muted">你愿意留下的句子，放在这里。记录「借助提示」和「无提示输入」，统计对应场景的回应，不代表逐字说出收藏句，也不把一次答对当作掌握。</p>${ids.length?ids.map(id=>{const p=PHRASES[id],counts=progress.learning[id];return `<article class="note-card"><p lang="ja">${escape(p.ja)}</p><p>${escape(p.zh)}</p><small>${escape(p.note)}</small><footer>${counts?`场景回应：借助提示 ${counts.assisted} 次 · 自己输入 ${counts.independent} 次`:'已收藏，尚未在交流中使用'}</footer></article>`;}).join(''):'<div class="empty-notes">还没有收藏。和人聊聊，或看看菜单，<br>遇到想留下的句子再放进来。</div>'}`);
}
function inventory(){modalFrame('inventory','今天的口袋',`<div class="wallet"><span>游戏零钱</span><strong>¥ ${progress.coins}</strong></div>${progress.purchase.paid?`<article class="note-card"><p lang="ja">日替わり弁当</p><p>${progress.purchase.warm?'已加热':'未加热'} · ${progress.purchase.bag?'有袋子':'没有袋子'}</p><small>你的表达确实决定了便当的状态。这个样片只购买一份，不会再次扣款。</small></article>`:'<div class="empty-notes">还没有买东西。<br>绿色门帘的便当店就在前面。</div>'}`);}
function showMap(){
  const sx=(x:number)=>135+x*4,sy=(z:number)=>350-z/ROAD_LENGTH*315;
  const path=ROAD.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)} ${sy(p.z).toFixed(1)}`).join(' '),pose=world?.getPose()||progress.pose,bento=sampleRoad(37.2);
  modalFrame('map','这一次，走在谷中',`<div class="map-layout"><svg class="street-map" viewBox="0 0 300 385" role="img" aria-label="谷中银座道路地图。圆点是你，便当店在街道右侧。"><defs><pattern id="paper" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#dbdfcf" stroke-width=".5"/></pattern></defs><rect x="0" y="0" width="300" height="385" rx="20" fill="url(#paper)"/><path d="${path}" fill="none" stroke="#c7cfb7" stroke-width="25" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#f7f1dd" stroke-width="15" stroke-linecap="round"/><circle cx="${sx(pose.x)}" cy="${sy(pose.z)}" r="6" fill="#325e53" stroke="white" stroke-width="3"/><rect x="${sx(bento.x)+20}" y="${sy(bento.z)-8}" width="14" height="14" rx="3" fill="#b67c4b"/><text x="${sx(bento.x)+41}" y="${sy(bento.z)+4}" font-size="12" fill="#43554a">便当店</text><text x="18" y="26" font-size="12" fill="#586b5d">街道示意 · 沿路方向</text></svg><div><p>谷中銀座 · 约 ${Math.round(ROAD_LENGTH)} 米</p><p class="muted">道路中心线来自 OpenStreetMap。建筑、店铺和人物是游戏创作，不是逐栋实景复刻。</p><p class="muted">当前可进入：よりみち弁当。其他店铺是街景，完整室内会逐步增加。</p><button class="secondary-button" id="return-start">回到街口</button></div></div>`,true);
  $('return-start').onclick=()=>{world?.resetPosition();closeModal();toast('回到街口。购买记录和笔记仍保留。');};
}
function about(){modalFrame('about','散步指南',`<div class="guide-grid"><article><h3>电脑</h3><p>WASD 移动。拖动或点击画面后用鼠标看四周。方向键也可以移动和转向。走近人物，看向对方，按 E 互动。Esc 打开暂停。</p></article><article><h3>手机</h3><p>建议横屏。左下摇杆移动，右侧滑动转向，出现提示后点互动按钮。进入对话时行走会自动暂停。</p></article></div><h3>本次样片的边界</h3><p class="muted">真实道路结构，创作的建筑、人物和店铺。当前为程序化风格美术，尚未接入 PLATEAU 建筑、精制角色资产、自由语音输入或跨设备云存档。</p><p class="muted">游戏存档单独保存在这个浏览器。不会清除或迁移 NHK 文章、收藏和备份。这里没有真实消费，也不是真实商家或营业信息。</p><div class="source-note"><strong>© OpenStreetMap contributors · ODbL</strong><p>道路摘录：2026-09-06。地图已为游戏旋转坐标并按平地处理。道路宽度与建筑布局为设计值。</p><a href="/explore/yanaka-roads.geojson" download>道路源数据</a> · <a href="/explore/map-source.json" target="_blank" rel="noopener">来源记录</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">许可与署名</a></div>`);}
function pauseMenu(){modalFrame('pause','在街角歇一会儿。',`<div class="pause-options"><button id="resume" class="primary-button">继续散步 ${icon('arrow')}</button><button id="pause-notes" class="secondary-button">看看散步笔记</button><a class="secondary-button" href="/">回到 NHK 学习</a></div><p class="muted">${writable?'游戏进度单独保存在本浏览器。':'当前游戏进度暂未保存。'}没有强制打卡，也不用一次走完。</p>`);$('resume').onclick=closeModal;$('pause-notes').onclick=notebook;persist();}
$('map').onclick=showMap;$('notebook').onclick=notebook;$('inventory').onclick=inventory;$('pause').onclick=pauseMenu;$('about').onclick=about;$('credit').onclick=about;
$('interact').onclick=()=>world?.interact();
$('start').onclick=()=>{if(!world)return;started=true;$('intro').hidden=true;$('stamp').hidden=true;$('hud').hidden=false;world.pause(false);updateHUD();persist();if(loaded.warning)toast(loaded.warning);window.setTimeout(()=>{$('controls-hint').classList.add('faded');},11000);};
// Pointer capture allows movement and look to run simultaneously on two fingers.
const joy=$('joystick'),stick=$('stick'),lookpad=$('lookpad');let joyId:number|null=null,lookId:number|null=null,lookX=0,lookY=0;
function joystick(e:PointerEvent){const r=joy.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.34),dy=(e.clientY-r.top-r.height/2)/(r.height*.34),n=Math.max(1,Math.hypot(dx,dy));world?.setMove(dx/n,dy/n);stick.style.transform=`translate(${dx/n*28}px,${dy/n*28}px)`;}
joy.onpointerdown=e=>{if(joyId!==null)return;e.preventDefault();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joystick(e);};joy.onpointermove=e=>{if(e.pointerId===joyId)joystick(e);};
const stopJoy=(e:PointerEvent)=>{if(e.pointerId===joyId){joyId=null;world?.setMove(0,0);stick.style.transform='';}};joy.onpointerup=stopJoy;joy.onpointercancel=stopJoy;joy.onlostpointercapture=stopJoy;
lookpad.onpointerdown=e=>{if(lookId!==null)return;e.preventDefault();lookId=e.pointerId;lookpad.setPointerCapture(e.pointerId);lookX=e.clientX;lookY=e.clientY;};lookpad.onpointermove=e=>{if(e.pointerId===lookId){world?.look((e.clientX-lookX)*1.6,(e.clientY-lookY)*1.6);lookX=e.clientX;lookY=e.clientY;}};lookpad.onpointerup=lookpad.onpointercancel=lookpad.onlostpointercapture=e=>{if(e.pointerId===lookId)lookId=null;};
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){e.preventDefault();if(modal)closeModal();else if(started)pauseMenu();}
  if(e.code==='Tab'&&modal){const elements=Array.from($('modal-layer').querySelectorAll<HTMLElement>('button:not([hidden]),input,a,summary'));const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
});
window.addEventListener('pagehide',()=>{persist();speech.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();speech.stop();}});
const saveTimer=window.setInterval(()=>{if(started&&!document.hidden)persist();},5000);
window.addEventListener('beforeunload',()=>{clearInterval(saveTimer);speech.dispose();world?.dispose();},{once:true});
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  try{
    world=createWorld($<HTMLCanvasElement>('street'),progress,{near(target){$('interact').hidden=!target;if(target)$('interact').querySelector('span')!.textContent=target.label;},interact,lock(v){$('controls-hint').textContent=v?'WASD 行走 · E 互动 · Esc 释放鼠标':'WASD 行走 · 拖动转向 · E 互动';},lost(){modalFrame('error','画面暂时中断',`<p>浏览器中断了 3D 渲染。已暂停移动，请重新打开页面恢复。</p><a class="primary-button" href="/explore.html">重新进入街道</a><a class="secondary-button" href="/">返回 NHK 学习</a>`);persist();}});
    const start=$<HTMLButtonElement>('start');start.disabled=false;start.querySelector('span')!.textContent=progress.purchase.paid||progress.visited.length?'继续上次的散步':'出门散步';
    root.dataset.ready='true';if(!writable)$('save-state').textContent='本次试玩不保存';
    // Read-only QA telemetry, explicitly opt-in; no teleport, task completion or storage mutation hooks.
    if(new URLSearchParams(location.search).get('qa')==='1')Object.defineProperty(window,'__explore',{value:{read:()=>({world:world?.diagnostics(),purchase:{...progress.purchase},coins:progress.coins,modal})},configurable:true});
  }catch(error){console.error('Exploration renderer failed',error);$('start').hidden=true;$('intro').querySelector('.intro-zh')!.textContent='这个浏览器暂时无法打开 3D 街道。请使用支持 WebGL 的浏览器，原有 NHK 学习仍可使用。';root.dataset.ready='error';}
}));
