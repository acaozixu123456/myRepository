import './style.css';
import './visual-v2.css';
import './cinematic-v3.css';
import {createWorld,type World,type TargetId} from './world';
import {loadProgress,saveProgress,turnText,reply,PHRASES,price,recordSeen,markHint,type PhraseId,type Progress} from './state';
import {ROAD,ROAD_LENGTH,sampleRoad} from './geo';
import {SpeechPlayer} from './audio';

if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{});},{once:true});
const root=document.querySelector<HTMLDivElement>('#explore-root')!;
const icon=(name:string)=>{const paths:Record<string,string>={map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16m6-14v16"/>',book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',sound:'<path d="m3 9 5 0 5-4v14l-5-4H3Z"/><path d="M17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',bag:'<path d="M5 7h14l1 14H4Zm4 0V5a3 3 0 0 1 6 0v2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',home:'<path d="m3 10 9-7 9 7v11H3Zm6 11v-8h6v8"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',pause:'<path d="M8 5v14m8-14v14"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.spark}</svg>`;};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]!));
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
