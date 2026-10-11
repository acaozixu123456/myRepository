export const SCREEN_CSS = `
/* ---------- 主城 ---------- */
.home .stagebar{margin:8px 10px 0;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:14px;background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 3px 0 var(--paper-line);position:relative;z-index:2}
.home .stagebar .nm{font-family:var(--f-d);font-size:16px;line-height:1.15;min-width:0}
.home .stagebar .nm small{display:block;font-family:var(--f-b);font-size:11px;color:var(--ink-2);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.home .stagebar .pw{margin-left:auto;text-align:right;font-size:11px;font-weight:700;color:var(--ink-2);white-space:nowrap}
.home .stagebar .pw b{font-family:var(--f-d);font-weight:400;font-size:16px;color:var(--ink)}
.home .stagebar .pw.low b{color:var(--red)}
.arena{position:relative;margin:8px 10px 0;border-radius:18px;overflow:hidden;border:4px solid var(--wood-2);box-shadow:0 0 0 2px var(--wood-hi),0 6px 0 var(--wood-3),0 10px 16px -8px rgba(0,0,0,.5);background:#000}
.arena canvas{display:block;width:100%;aspect-ratio:960/600;height:auto}
.arena .tools{position:absolute;right:8px;top:8px;display:flex;gap:6px;z-index:3}
.arena .tools button{min-width:40px;height:30px;padding:0 10px;border-radius:999px;background:rgba(43,28,16,.72);color:#fff6dc;font-weight:700;font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25)}
.arena .stagebadge{position:absolute;left:8px;top:8px;z-index:3;padding:2px 10px;border-radius:999px;background:rgba(43,28,16,.72);color:#fff6dc;font-family:var(--f-d);font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25)}
.arena .rule{position:absolute;left:8px;right:8px;bottom:6px;z-index:3;text-align:center;font-size:11px;font-weight:700;color:#fff6dc;text-shadow:0 1px 2px rgba(0,0,0,.8);pointer-events:none}
.avatar{position:relative}.avatar .gb{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:#fff6dc;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--wood-3)}
.teamstrip{margin:12px 10px 0;display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:16px;background:rgba(255,248,226,.55);box-shadow:inset 0 0 0 2px rgba(255,255,255,.6),0 3px 0 rgba(95,143,67,.35);cursor:pointer}
.teamstrip .m{position:relative;width:48px;height:48px;border-radius:14px;overflow:hidden;background:linear-gradient(#fff3d6,#f3dcae);box-shadow:0 0 0 2.5px var(--rc,#b99a6a),0 2px 0 rgba(0,0,0,.18)}
.teamstrip .m.ur{--rc:var(--r-ur)}.teamstrip .m.ssr{--rc:var(--r-ssr)}.teamstrip .m.sr{--rc:var(--r-sr)}
.teamstrip .m img{width:100%;height:100%;object-fit:cover;display:block}
.teamstrip .m em{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:10px;font-weight:900;text-align:center;color:#fff;background:rgba(43,28,16,.7);line-height:13px}
.teamstrip .m.empty{display:flex;align-items:center;justify-content:center;color:#a9946a;background:rgba(255,255,255,.35);box-shadow:0 0 0 2.5px rgba(150,120,70,.35)}
.teamstrip .go{margin-left:auto;font-family:var(--f-d);font-size:14px;color:var(--ink-2)}
.idle{margin:12px 10px 0;display:flex;align-items:center;gap:10px}
.idle .figs{flex:1;min-width:0}
.idle .big{display:flex;gap:12px;align-items:center;font-family:var(--f-d);font-size:20px}
.idle .big span{display:inline-flex;align-items:center;gap:4px}
.idle .sub{font-size:11px;color:var(--ink-2);font-weight:700;margin-top:2px}
.actions{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:8px;margin:12px 10px 0}
.actions .btn{padding:6px 8px 9px;font-size:16px;min-height:46px;flex-direction:column;gap:0;line-height:1.1}
.tip{margin:12px 10px 0;font-size:12px;color:#2b4a22;text-align:center;font-weight:700;text-shadow:0 1px 0 rgba(255,255,255,.5)}

/* ---------- 阵容 ---------- */
.field{position:relative;border-radius:16px;padding:10px;background:linear-gradient(#a6d27a,#7fb85a);box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 4px 0 #5f8f43;overflow:hidden}
.field::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(100deg,rgba(255,255,255,.06) 0 14px,transparent 14px 30px);pointer-events:none}
.field .grid{position:relative;display:grid;grid-template-columns:1fr 1.1fr;gap:8px;align-items:center}
.field .col{display:flex;flex-direction:column;gap:8px}
.field .lab{font-family:var(--f-d);font-size:13px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.3);text-align:center}
.slot{position:relative;min-height:84px;border-radius:14px;background:rgba(255,255,255,.28);box-shadow:inset 0 0 0 2px rgba(255,255,255,.55),inset 0 -4px 0 rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;overflow:hidden}
.slot.empty{border:2px dashed rgba(255,255,255,.8);background:rgba(255,255,255,.18)}
.slot .ic{opacity:.9}
.slot .mini{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;gap:6px;padding:4px 4px 2px}
.slot .mini .portrait{width:58px;height:70px;flex:none;position:relative;border-radius:12px;background:radial-gradient(circle at 50% 70%,color-mix(in srgb,var(--c) 45%,#fff7e2),#efe2bf);box-shadow:0 0 0 3px var(--rc,var(--r-ssr));overflow:hidden}
.slot .mini img{position:absolute;left:0;bottom:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.slot .mini .t{min-width:0;align-self:center;color:#fff;font-size:11px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.6);line-height:1.25}
.slot .mini .t b{display:block;font-family:var(--f-d);font-weight:400;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px}
.syn{display:flex;gap:6px;flex-wrap:wrap}
.syn .s{display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 4px;border-radius:999px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);font-size:12px;font-weight:700}
.syn .s .g{width:20px;height:20px;border-radius:7px;display:grid;place-items:center;color:#fff;font-family:var(--f-d);font-size:12px;background:var(--c)}
.syn .s.on{background:#e4f6d8;box-shadow:inset 0 0 0 2px #7fc86a;color:#235a1c}
.syn .s.off{opacity:.6}
.roster{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.pwr{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-d);font-size:18px;padding:2px 12px;border-radius:999px;background:var(--wood-2);color:#fff6dc;box-shadow:inset 0 0 0 2px rgba(255,235,190,.3)}
.pwr small{font-family:var(--f-b);font-size:11px;opacity:.8}

/* ---------- 英雄详情 ---------- */
.detail .hero{display:grid;grid-template-columns:128px 1fr;gap:10px;align-items:stretch}
.detail .portrait{position:relative;border-radius:16px;background:radial-gradient(circle at 50% 70%,color-mix(in srgb,var(--c) 45%,#fff7e2),#efe2bf 78%);box-shadow:0 0 0 3px var(--rc),0 4px 0 rgba(0,0,0,.18);overflow:hidden;min-height:168px}
.detail .portrait img{position:absolute;left:0;bottom:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.detail h2{margin:0;font-family:var(--f-d);font-weight:400;font-size:24px;line-height:1.1}
.detail .sub{font-size:12px;color:var(--ink-2);font-weight:700}
.detail .stat{display:grid;grid-template-columns:34px 1fr 46px;gap:6px;align-items:center;font-size:12px;font-weight:700;margin-top:4px}
.detail .stat .bar{height:8px}
.detail .stat em{font-style:normal;text-align:right}
.skillrow{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;padding:8px 10px;border-radius:14px;background:var(--paper-2);margin-top:7px}
.skillrow .k{grid-row:span 2;align-self:start;margin-top:2px;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;background:var(--ink);color:var(--paper)}
.skillrow .k.ultimate{background:var(--orange);color:#fff}.skillrow .k.passive{background:var(--c);color:#fff}
.skillrow b{font-family:var(--f-d);font-weight:400;font-size:15px}
.skillrow p{margin:0;font-size:12.5px;line-height:1.5;color:var(--ink)}
.skillrow .mods{display:flex;flex-direction:column;gap:2px;margin-top:3px}
.skillrow .mod{font-size:11.5px;color:var(--ink-3);display:flex;gap:6px}
.skillrow .mod.on{color:#2b6a22;font-weight:700}
.awk{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.awk button{text-align:left;padding:8px 10px;border-radius:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);font-size:12px;line-height:1.45}
.awk button b{display:block;font-family:var(--f-d);font-weight:400;font-size:14px;margin-bottom:2px}
.awk button[aria-pressed=true]{background:#fff0c4;box-shadow:inset 0 0 0 3px var(--r-ur)}
.awk button:disabled{opacity:.55}
.slots4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px}
.slots4 div{aspect-ratio:1;border-radius:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);display:grid;place-items:center;color:var(--ink-3);font-size:11px;font-weight:700;position:relative}
.slots4 .ic{opacity:.45}
.footbar{position:sticky;bottom:-18px;margin:12px -14px -18px;padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px));background:linear-gradient(rgba(255,247,226,0),var(--paper) 30%);display:flex;gap:8px}
.footbar .btn{flex:1}

/* ---------- 招募 ---------- */
.gacha .banner{position:relative;margin:10px 10px 0;height:300px;border-radius:22px;overflow:hidden;background:radial-gradient(circle at 50% 62%,#fff3c4 0%,#ffd78a 26%,#c97fd8 66%,#5b3a86 100%);box-shadow:0 0 0 4px var(--wood-2),0 0 0 6px var(--wood-hi),0 8px 0 var(--wood-3)}
.gacha .banner .rays{position:absolute;left:50%;top:60%;width:640px;height:640px;margin:-320px 0 0 -320px;background:repeating-conic-gradient(rgba(255,255,255,.34) 0 7deg,transparent 7deg 20deg);border-radius:50%;-webkit-mask-image:radial-gradient(circle,#000 14%,transparent 66%);mask-image:radial-gradient(circle,#000 14%,transparent 66%);animation:spin 40s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.gacha .banner img{position:absolute;left:50%;bottom:-6px;height:96%;transform:translateX(-50%);filter:drop-shadow(0 8px 10px rgba(60,20,80,.45))}
.gacha .banner .up{position:absolute;left:10px;top:10px;padding:2px 12px;border-radius:999px;background:var(--r-ur);font-family:var(--f-d);font-size:14px;box-shadow:0 2px 0 rgba(0,0,0,.25)}
.gacha .banner .nm{position:absolute;left:0;right:0;bottom:10px;text-align:center}
.gacha .banner .nm span{display:inline-block;padding:3px 18px;border-radius:999px;background:rgba(43,28,16,.82);color:#ffe9a0;font-family:var(--f-d);font-size:18px;box-shadow:inset 0 0 0 2px rgba(255,235,190,.35)}
.gacha .tabs{display:flex;gap:8px;margin:12px 10px 0}
.gacha .tabs button{flex:1;padding:7px 4px 9px;border-radius:14px;font-family:var(--f-d);font-size:15px;color:#fff6dc;background:linear-gradient(var(--wood-1),var(--wood-2));box-shadow:0 4px 0 var(--wood-3),inset 0 0 0 2px rgba(255,235,190,.2);position:relative;top:0}
.gacha .tabs button[aria-pressed=true]{background:linear-gradient(#ffd27a,#f0a22e);color:#5a2a05;box-shadow:0 4px 0 var(--orange-d),inset 0 2px 0 rgba(255,255,255,.5)}
.pity{margin:12px 10px 0;display:grid;gap:8px}
.pity .r{display:grid;grid-template-columns:62px 1fr 56px;gap:8px;align-items:center;font-size:12px;font-weight:700}
.pity .r em{font-style:normal;text-align:right;color:var(--ink-2)}
.pullbar{display:grid;grid-template-columns:1fr 1.2fr;gap:10px;margin:14px 10px 0}
.pullbar .btn{flex-direction:column;gap:0;min-height:58px;padding:6px 8px 10px}
.pullbar .btn .cost{margin-top:1px}
.gacha .note{margin:10px 14px 0;font-size:11.5px;color:var(--ink-2);text-align:center;line-height:1.6}
.gacha .note a{color:var(--blue-d);font-weight:700;text-decoration:underline}

/* ---------- 抽卡动画 ---------- */
.reveal{position:absolute;inset:0;z-index:30;background:radial-gradient(circle at 50% 46%,#4a2f6a,#1b1226 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;animation:fadein .2s}
.reveal .rays{position:absolute;left:50%;top:44%;width:900px;height:900px;margin:-450px 0 0 -450px;background:repeating-conic-gradient(var(--glow,#ffd24a) 0 6deg,transparent 6deg 18deg);opacity:0;border-radius:50%;-webkit-mask-image:radial-gradient(circle,#000 8%,transparent 62%);mask-image:radial-gradient(circle,#000 8%,transparent 62%);animation:spin 18s linear infinite}
.reveal.burst .rays{opacity:.55;transition:opacity .4s}
.reveal .boxwrap{position:relative;width:230px;height:230px;margin-top:-40px}
.reveal .boxwrap svg{width:100%;height:100%;overflow:visible}
.reveal .boxwrap.shake{animation:shake .5s infinite}
.reveal .glowbox{position:absolute;left:50%;top:46%;width:220px;height:220px;margin:-110px 0 0 -110px;border-radius:50%;background:radial-gradient(circle,var(--glow,#ffd24a) 0%,transparent 68%);opacity:0;transition:opacity .5s}
.reveal .glowbox.on{opacity:.9}
.reveal .flapL,.reveal .flapR{transform-box:fill-box;transition:transform .45s cubic-bezier(.3,1.6,.5,1)}
.reveal .flapL{transform-origin:0 100%}.reveal .flapR{transform-origin:100% 100%}
.reveal.open .flapL{transform:rotate(-112deg)}.reveal.open .flapR{transform:rotate(112deg)}
@keyframes shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-4deg) translateX(-3px)}40%{transform:rotate(4deg) translateX(3px)}60%{transform:rotate(-3deg)}80%{transform:rotate(3deg)}}
.reveal .hint{position:absolute;bottom:90px;color:#ffe9a0;font-family:var(--f-d);font-size:18px;letter-spacing:.1em;animation:blink 1.2s infinite}
@keyframes blink{50%{opacity:.4}}
.reveal .skip{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:5}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:6}
.flash.go{animation:flash .6s ease-out}
@keyframes flash{0%{opacity:.95}100%{opacity:0}}
.one{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:4;padding:20px}
.one .big{width:236px;--c:var(--wei);animation:cardin .6s cubic-bezier(.2,1.5,.4,1)}
.one .big .hcard{pointer-events:none;transform:none}
.one .meta{text-align:center;color:#fff6dc}
.one .meta b{display:block;font-family:var(--f-d);font-weight:400;font-size:30px;text-shadow:0 3px 0 rgba(0,0,0,.4)}
.one .meta span{font-size:14px;font-weight:700;color:#ffe9a0}
.one .new{position:absolute;left:50%;top:76px;margin-left:46px;z-index:5;padding:2px 12px;border-radius:999px;background:var(--red);color:#fff;font-family:var(--f-d);font-size:15px;transform:rotate(8deg);box-shadow:0 2px 0 rgba(0,0,0,.3)}
@keyframes cardin{0%{transform:translateY(60px) scale(.4) rotate(-8deg);opacity:0}100%{transform:none;opacity:1}}
.ten{position:absolute;inset:0;z-index:4;padding:calc(56px + env(safe-area-inset-top,0px)) 12px 90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.ten .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:8px 6px;width:100%}
.ten .cell{position:relative;opacity:0;animation:cardin .5s cubic-bezier(.2,1.4,.4,1) forwards}
.ten .cell .hcard .info{display:none}
.ten .cell .hcard .art{aspect-ratio:1/1.35}
.ten .cell .hcard .stars{bottom:5px}
.ten .cell .tagn{position:absolute;left:50%;top:-6px;transform:translateX(-50%);z-index:6;font-size:10px;font-weight:700;padding:0 7px;border-radius:999px;background:var(--red);color:#fff;white-space:nowrap}
.ten .cell .tagd{position:absolute;left:0;right:0;bottom:-2px;z-index:6;text-align:center;font-size:10px;font-weight:700;color:#fff6dc;text-shadow:0 1px 2px #000}
.ten .cell[data-r=SP] .hcard{box-shadow:0 0 22px 5px rgba(255,106,208,.9)}
.ten .cell[data-r=UR] .hcard{box-shadow:0 0 18px 3px rgba(255,210,74,.8)}
.ten .cell[data-r=SSR] .hcard{box-shadow:0 0 12px 2px rgba(165,106,216,.7)}
.reveal .okbar{position:absolute;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:12px;z-index:6}
.urcut.sp .band{background:linear-gradient(90deg,transparent,#ffb83a 12%,#ff6ad0 50%,#ffb83a 88%,transparent);box-shadow:0 0 40px 8px rgba(255,200,80,.6)}
.urcut.sp .txt b{-webkit-text-stroke:7px rgba(90,16,56,.95)}
.urcut.sp::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(255,236,160,.5),transparent 60%);animation:fadein .6s}
.gacha .banner.sp{background:radial-gradient(circle at 50% 62%,#fff7d0 0%,#ffd0ee 28%,#c77ee8 62%,#3a2370 100%)}
.gacha .tabs button.sp-tab{background:linear-gradient(#ffb7e6,#ff6ad0);color:#5a1038;box-shadow:0 4px 0 #b02f8a,inset 0 2px 0 rgba(255,255,255,.5)}
.gacha .tabs button.sp-tab[aria-pressed=true]{background:linear-gradient(#ffe27a,#ffb02e);box-shadow:0 4px 0 #b9741a,inset 0 2px 0 rgba(255,255,255,.6)}
.btn.dim{filter:saturate(.55);opacity:.9}
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:6px;margin:8px 10px 0;flex:none}
.quick button{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px 5px;border-radius:14px;background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 3px 0 var(--paper-line),inset 0 0 0 2px rgba(255,255,255,.65);font-family:var(--f-d);font-size:12.5px}
.quick button:active{transform:translateY(2px)}
.quick button .rd{position:absolute;right:6px;top:3px;width:10px;height:10px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px #fff}
.quick button.pay{background:linear-gradient(#ffe9a0,#ffc84a)}
.urcut{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;background:rgba(10,4,20,.82);animation:fadein .15s}
.urcut .band{position:relative;width:118%;height:200px;flex:none;background:linear-gradient(90deg,transparent,var(--c) 14%,var(--c) 86%,transparent);transform:rotate(-7deg);display:flex;align-items:center;box-shadow:0 0 0 4px rgba(255,255,255,.85) inset}
.urcut .band img{position:absolute;left:9%;bottom:-2px;height:150%;filter:drop-shadow(0 10px 10px rgba(0,0,0,.5));transform:rotate(7deg);animation:slidein .5s cubic-bezier(.2,1.2,.4,1)}
.urcut .txt{margin-left:47%;max-width:48%;transform:rotate(7deg);color:#fff;animation:slidein2 .5s .1s both}
.urcut .txt small{font-size:13px;font-weight:700;display:block;opacity:.9}
.urcut .txt b{font-family:var(--f-d);font-weight:400;font-size:44px;line-height:1.05;display:block;color:#fff8d2;-webkit-text-stroke:7px rgba(60,20,70,.95);paint-order:stroke fill;text-shadow:0 4px 0 rgba(60,20,70,.5)}
@keyframes slidein{from{transform:translateX(-90px) rotate(7deg);opacity:0}to{transform:rotate(7deg);opacity:1}}
@keyframes slidein2{from{transform:translateX(70px) rotate(7deg);opacity:0}to{transform:rotate(7deg);opacity:1}}

.dialog.result{text-align:center;padding-top:22px}
.dialog.result .banner-r{display:inline-block;padding:4px 30px 6px;border-radius:999px;font-family:var(--f-d);font-size:30px;color:#fff;letter-spacing:.06em;text-shadow:0 3px 0 rgba(0,0,0,.28);box-shadow:0 4px 0 rgba(0,0,0,.22),inset 0 0 0 3px rgba(255,255,255,.4)}
.dialog.result.win .banner-r{background:linear-gradient(#ffd27a,#f0a22e)}
.dialog.result.lose .banner-r{background:linear-gradient(#b8a8d8,#7e6aa6)}
/* ---------- 背包 ---------- */
.bag-scroll{padding-top:12px}
.bag-tabs{gap:8px;margin-bottom:8px}
.bag-tabs .pill{flex:1;min-width:0;min-height:42px;justify-content:center;padding:4px 10px;font-size:14px}
.bag-summary{margin-bottom:14px}
.bag-summary h3{margin-bottom:0}
.bag-summary .tag{font-size:11px;white-space:nowrap}
.bag-summary p{margin:6px 0 0;font-size:12px;line-height:1.5;color:var(--ink-2)}
.bag-equip-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 9px}
.bag-equip-card{min-width:0;min-height:160px}
.bag-equip-art{position:relative;display:flex;align-items:center;justify-content:center;min-height:86px;padding:22px 4px 14px;background:linear-gradient(var(--paper),var(--paper-2))}
.bag-equip-art>.ic{filter:drop-shadow(0 3px 0 rgba(60,36,12,.1))}
.bag-quality{position:absolute;left:6px;top:6px;border-radius:8px;padding:1px 6px;background:var(--rc);font-size:10px;font-weight:700}
.bag-equip-level{position:absolute;right:7px;bottom:3px;font-size:10px;font-weight:700;color:var(--ink-2)}
.bag-equip-info{padding:5px 7px 9px}
.bag-equip-info>b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-family:var(--f-d);font-size:13px;font-weight:400;line-height:1.3;min-height:34px;overflow-wrap:anywhere}
.bag-equip-info>small{display:block;font-size:10px;color:var(--ink-2);margin:3px 0}
.bag-wearer{display:block;font-size:10px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bag-wearing{color:var(--green-d);font-weight:700}
.bag-item-list{display:grid;gap:10px}
.bag-item-row{display:flex;align-items:flex-start;gap:10px;padding:12px}
.bag-item-icon{width:46px;height:46px;flex:none;display:grid;place-items:center;background:var(--paper-2);box-shadow:none}
.bag-item-copy{flex:1;min-width:0}
.bag-item-heading{display:flex;align-items:flex-start;gap:6px;justify-content:space-between}
.bag-item-heading>b{font-family:var(--f-d);font-size:15px;font-weight:400;line-height:1.35;overflow-wrap:anywhere}
.bag-item-count{flex:none;font-size:13px;font-weight:700;color:var(--ink-2)}
.bag-item-copy p{margin:4px 0 0;font-size:11.5px;line-height:1.6;color:var(--ink-2);overflow-wrap:anywhere}
.bag-yarn-use{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-top:8px}
.bag-yarn-use>span{font-size:11px;font-weight:700;color:var(--ink-2)}
.bag-yarn-use .btn{min-height:40px;font-size:14px;padding:5px 12px 7px}
.bag-shard-list{display:grid;gap:9px}
.bag-shard-card{display:flex;align-items:center;gap:10px;min-height:78px;padding:8px 12px 8px 8px}
.bag-hero-portrait{flex:none;width:48px;height:52px;overflow:hidden;border-radius:11px;background:color-mix(in srgb,var(--c) 22%,var(--paper-2));display:grid;place-items:center}
.bag-hero-portrait img{width:100%;height:100%;object-fit:contain}
.bag-shard-name{flex:1;min-width:0}
.bag-shard-name b{display:block;font-family:var(--f-d);font-size:16px;font-weight:400}
.bag-shard-name small{display:block;font-size:11px;line-height:1.4;color:var(--ink-2);margin-top:3px}
.bag-shard-number{flex:none;text-align:right;min-width:48px}
.bag-shard-number b{font-family:var(--f-d);font-size:21px;font-weight:400}
.bag-shard-number small{display:block;font-size:10px;font-weight:700;color:var(--ink-2)}
.bag-zero-shards{margin-bottom:12px}
.bag-zero-shards p{font-size:12px;line-height:1.6;color:var(--ink-2);margin:0}
.bag-empty{text-align:center;padding:32px 22px;margin-top:5px}
.bag-empty-art{width:92px;height:92px;display:grid;place-items:center;margin:0 auto 14px;background:var(--paper-2);border-radius:50%;box-shadow:inset 0 0 0 2px var(--paper-line)}
.bag-empty h3{font-size:20px}
.bag-empty p{max-width:250px;margin:8px auto 0;font-size:13px;line-height:1.8;color:var(--ink-2)}
.bag-sheet{overflow-x:hidden}
.bag-close{width:42px;height:42px;padding:10px;z-index:4}
.bag-detail-head{display:flex;align-items:center;gap:12px;margin-bottom:9px;padding-right:34px}
.bag-detail-icon{flex:none;width:80px;height:86px;display:grid;place-items:center;background:var(--paper-2)}
.bag-detail-title{min-width:0;flex:1}
.bag-detail-title h2{margin:4px 0 5px;font-family:var(--f-d);font-weight:400;font-size:21px;line-height:1.3;overflow-wrap:anywhere}
.bag-detail-title>div{font-size:12px;font-weight:700;color:var(--ink-2)}
.bag-owner{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ink-2);margin:8px 1px 12px}
.bag-attributes,.bag-set,.bag-flavor{margin-top:12px}
.bag-attributes .tag{font-size:10px}
.bag-stat{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--paper-2);font-size:13px}
.bag-stat:last-child{border-bottom:0}
.bag-stat>span:first-child{flex:1;min-width:0;color:var(--ink-2)}
.bag-stat>b{font-size:13px}
.bag-stat-next{font-size:12px;color:var(--green-d);font-weight:700;min-width:76px;text-align:right}
.bag-note{margin:4px 0;font-size:11px;line-height:1.6;color:var(--ink-2)}
.bag-set-step{margin-top:8px;padding:8px 10px;border-radius:12px;background:var(--paper-2);box-shadow:inset 0 0 0 1.5px var(--paper-line)}
.bag-set-step>b{font-size:12px;color:var(--ink-2)}
.bag-set-step p{font-size:12px;line-height:1.6;margin:4px 0 0}
.bag-set-on{background:#e4f6d8;box-shadow:inset 0 0 0 2px #7fc86a}
.bag-set-on>b{color:var(--green-d)}
.bag-set>.bag-note:last-child{margin-top:9px}
.bag-flavor p{font-size:12.5px;line-height:1.7;color:var(--ink-2);margin:0}
.bag-actions{position:sticky;bottom:-18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px -14px -18px;padding:12px 14px calc(18px + env(safe-area-inset-bottom,0px));background:linear-gradient(rgba(255,247,226,0),var(--paper) 15%);z-index:3}
.bag-actions .btn{min-height:44px;padding:7px 10px 10px;font-size:16px;min-width:0}
.bag-actions .bag-enhance{grid-column:1/-1;min-height:48px}
.bag-picker-note{margin:12px 0}
.bag-picker-note p{margin:0;font-size:12px;line-height:1.6;color:var(--ink-2)}
.bag-hero-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bag-hero-choice{display:flex;align-items:center;gap:7px;min-height:102px;padding:9px 8px}
.bag-hero-choice-copy{min-width:0;flex:1}
.bag-hero-choice-copy>b{font-family:var(--f-d);font-weight:400;font-size:14px;display:block}
.bag-hero-choice-copy>small{font-size:10px;color:var(--ink-2);display:block;margin-top:3px}
.bag-hero-choice-copy>span{font-size:10px;color:var(--green-d);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin-top:4px;overflow-wrap:anywhere}
.bag-hero-choice:disabled{opacity:.65;cursor:default}
.bag-picker-foot{margin-top:18px;text-align:center;padding-bottom:6px}
.bag-picker-foot .btn{width:100%;min-height:42px}
.bag-hero-slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:102px;padding:8px 5px;text-align:center;min-width:0}
.bag-hero-slot>.ic{opacity:1}
.bag-hero-slot>b{font-family:var(--f-d);font-weight:400;font-size:11px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;max-width:100%}
.bag-hero-slot>small{font-size:10px;color:var(--ink-2)}
.bag-browse{min-height:40px}

/* ---------- 任务 ---------- */
.qst-screen{bottom:0;z-index:8;background:linear-gradient(var(--sky-1),var(--sky-2) 28%,var(--grass))}
.qst-entry-row{display:flex;justify-content:center;margin:10px 10px 0;flex:none}
.qst-entry{position:relative;min-width:122px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 22px;border-radius:14px;background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 3px 0 var(--paper-line),inset 0 0 0 2px rgba(255,255,255,.65);font-family:var(--f-d);font-size:16px}
.qst-entry:active{transform:translateY(2px)}
.qst-red{position:absolute;top:4px;right:9px;width:11px;height:11px;border-radius:50%;background:var(--red);border:2px solid var(--paper)}
.qst-red[hidden]{display:none}
.qst-back{min-width:54px;min-height:40px!important;padding:5px 10px 7px!important;flex:none}
.qst-tabs{padding:12px 12px 0;flex:none}
.qst-tabs .seg{gap:7px;overflow:visible}
.qst-tabs .pill{min-height:42px;min-width:40px;flex:1;justify-content:center;padding:6px 8px;font-size:14px}
.qst-scroll{padding-top:7px;padding-bottom:24px}
.qst-summary{margin:0 0 13px;padding:12px}
.qst-summary-row{display:flex;align-items:center;gap:8px}
.qst-summary-copy{flex:1;min-width:0}
.qst-summary-copy h3{font-size:19px;margin-bottom:4px}
.qst-summary-copy>div{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:11px;color:var(--ink-2)}
.qst-summary-copy b{color:var(--green-d);font-weight:800}
.qst-all{min-height:42px!important;min-width:96px;flex:none;padding:7px 10px 9px!important}
.qst-summary>p{font-size:11px;line-height:1.65;color:var(--ink-2);margin:10px 0 0;overflow-wrap:anywhere}
.qst-list{display:flex;flex-direction:column;gap:12px}
.qst-card{padding:12px}
.qst-card-head{display:flex;align-items:center;gap:10px}
.qst-card-title{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 7px}
.qst-card-title h3{margin:0;font-size:17px;line-height:1.4;overflow-wrap:anywhere}
.qst-card-title .tag{font-size:10px;padding:1px 7px}
.qst-action{min-height:42px!important;min-width:78px;flex:none;padding:6px 9px 8px!important;font-size:14px!important}
.qst-desc{margin:8px 0;font-size:12px;line-height:1.7;color:var(--ink-2);overflow-wrap:anywhere}
.qst-progress{display:flex;align-items:center;gap:9px;margin:8px 0 9px}
.qst-progress .bar{flex:1;min-width:0;height:8px}
.qst-progress>span{flex:none;font-size:11px;font-weight:800;color:var(--ink-2)}
.qst-rewards{display:flex;flex-wrap:wrap;gap:5px 9px;padding-top:8px;border-top:1px solid var(--paper-2)}
.qst-reward{display:inline-flex;align-items:center;gap:3px;min-width:0;max-width:100%;font-size:10.5px;color:var(--ink-2)}
.qst-reward>span:not(.ic){overflow-wrap:anywhere}
.qst-reward>b{font-size:11px;white-space:nowrap;font-weight:800;color:var(--ink)}
.qst-ready{border-color:#e0f5cd;outline-color:#89ba68}
.qst-claimed{background:var(--paper-2);opacity:.68;box-shadow:0 2px 0 var(--paper-line)}
.qst-claimed .qst-rewards{border-color:var(--paper-line)}
.qst-unavailable .qst-progress .bar{opacity:.6}
.qst-complete{display:flex;align-items:center;gap:11px;margin:0 0 13px;padding:14px}
.qst-complete h3{font-size:17px;margin:0 0 4px}
.qst-complete p{font-size:12px;line-height:1.7;margin:0;color:var(--ink-2)}
/* ---------- 商店 ---------- */
.shop-screen{bottom:0;z-index:8;background:linear-gradient(var(--sky-1),var(--sky-2) 28%,var(--grass))}
.shop-entry-row{display:flex;justify-content:center;margin:10px 10px 0;flex:none}
.shop-entry{position:relative;min-width:122px;min-height:40px;margin:0 5px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:7px 22px;border-radius:14px;background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 3px 0 var(--paper-line),inset 0 0 0 2px rgba(255,255,255,.65);font-family:var(--f-d);font-size:16px}
.shop-entry:active{transform:translateY(2px)}
.shop-back{min-height:40px!important;min-width:54px;padding:5px 10px 7px!important;flex:none}
.shop-tabs{flex:none;padding:12px 12px 0}
.shop-tabs .seg{gap:6px;overflow:visible}
.shop-tabs .pill{min-height:42px;min-width:40px;flex:1;justify-content:center;padding:6px 5px;font-size:13px}
.shop-scroll{padding-top:7px;padding-bottom:24px}
.shop-summary{padding:12px;margin-bottom:13px}
.shop-summary h3{font-size:19px;margin:0 0 8px}
.shop-wallets{display:flex;flex-wrap:wrap;gap:7px}
.shop-wallets .chip{gap:4px;font-size:11px;max-width:100%;padding:4px 7px}
.shop-wallets .chip>b{font-size:12px}
.shop-wallet-note{margin-top:6px;color:var(--ink-2);font-size:11px;font-weight:800}
.shop-summary>p{font-size:12px;line-height:1.65;color:var(--ink-2);margin:8px 0}
.shop-restock{font-size:10px;font-weight:700;color:var(--ink-2);border-top:1px solid var(--paper-2);padding-top:7px}
.shop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
.shop-card{display:flex;flex-direction:column;padding:11px 9px;min-width:0}
.shop-product-head{display:flex;align-items:center;gap:6px;min-width:0}
.shop-product-icon{flex:none;width:48px;height:50px;display:grid;place-items:center;background:var(--paper-2)}
.shop-product-title{flex:1;min-width:0}
.shop-product-title h3{font-size:14px;line-height:1.35;margin:0;overflow-wrap:anywhere}
.shop-product-title>small{display:block;font-size:10px;font-weight:800;color:var(--ink-2);margin-top:4px}
.shop-product-desc{font-size:10.5px;line-height:1.6;margin:8px 0;min-height:34px;color:var(--ink-2);overflow-wrap:anywhere}
.shop-price{display:flex;align-items:center;flex-wrap:wrap;gap:3px;font-size:12px;margin-top:auto}
.shop-price>b{font-size:13px}
.shop-price>small{font-size:10px;color:var(--ink-2)}
.shop-limit{font-size:10px;font-weight:700;color:var(--ink-2);margin:5px 0 9px}
.shop-buy{min-height:42px!important;min-width:40px;width:100%;padding:6px 5px 8px!important;font-size:15px!important}
.shop-unavailable{opacity:.62;background:var(--paper-2)}
.shop-soldout{opacity:.75}
.shop-mask{padding:16px!important}
.shop-dialog{max-height:90%;overflow-y:auto;overflow-x:hidden;padding:17px}
.shop-dialog>h2{font-family:var(--f-d);font-weight:400;font-size:22px;margin:0 0 14px}
.shop-order-product{display:flex;align-items:center;gap:10px}
.shop-order-icon{flex:none;width:70px;height:74px;display:grid;place-items:center;background:var(--paper-2)}
.shop-order-product>div:last-child{flex:1;min-width:0}
.shop-order-product h3{font-family:var(--f-d);font-weight:400;font-size:18px;line-height:1.4;margin:0;overflow-wrap:anywhere}
.shop-order-product p{font-size:11px;line-height:1.65;color:var(--ink-2);margin:5px 0 0}
.shop-order-desc{font-size:12px;line-height:1.7;color:var(--ink-2);margin:12px 0;overflow-wrap:anywhere}
.shop-order-label{font-size:12px;font-weight:800;margin:14px 0 7px}
.shop-quantities{gap:8px;overflow:visible;margin-bottom:9px}
.shop-quantities .pill{flex:1;min-width:40px;min-height:42px;justify-content:center}
.shop-quantities .pill:disabled{opacity:.45;cursor:default}
.shop-order-total{padding:11px;margin-top:5px}
.shop-order-total>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;font-size:11px}
.shop-order-total span{color:var(--ink-2);flex:none}
.shop-order-total b{display:flex;align-items:center;justify-content:flex-end;gap:3px;min-width:0;text-align:right;font-size:12px;overflow-wrap:anywhere}
.shop-order-total .shop-order-balance{border-top:1px solid var(--paper-line);margin-top:4px;padding-top:9px}
.shop-order-reason{font-size:12px;line-height:1.6;color:var(--red);font-weight:800;margin:11px 0 0;overflow-wrap:anywhere}
.shop-order-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;padding-bottom:5px}
.shop-order-actions .btn{min-height:44px;padding:8px 8px 10px;font-size:17px}
`;
