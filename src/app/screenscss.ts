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
.ten .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px 6px;width:100%}
.ten .cell{position:relative;opacity:0;animation:cardin .5s cubic-bezier(.2,1.4,.4,1) forwards}
.ten .cell .hcard .info{display:none}
.ten .cell .hcard .art{aspect-ratio:1/1.35}
.ten .cell .hcard .stars{bottom:5px}
.ten .cell .tagn{position:absolute;left:50%;top:-6px;transform:translateX(-50%);z-index:6;font-size:10px;font-weight:700;padding:0 7px;border-radius:999px;background:var(--red);color:#fff;white-space:nowrap}
.ten .cell .tagd{position:absolute;left:0;right:0;bottom:-2px;z-index:6;text-align:center;font-size:10px;font-weight:700;color:#fff6dc;text-shadow:0 1px 2px #000}
.ten .cell[data-r=UR] .hcard{box-shadow:0 0 18px 3px rgba(255,210,74,.8)}
.ten .cell[data-r=SSR] .hcard{box-shadow:0 0 12px 2px rgba(165,106,216,.7)}
.reveal .okbar{position:absolute;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:12px;z-index:6}
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
`;
