// 界面素材库（UI Kit）：色板、面板、糖果按钮、标签、导航、卡牌边框、弹层。
// 画风：软萌绘本 —— 厚实圆角、纸张与木板质感、糖果按钮（有“厚度”，按下会下沉）、肉垫与鱼骨图案。
// 所有新界面都应该只用这里的类与变量；需要新组件时在这里加，不要在页面里写零散样式。
export const KIT_CSS = `
:root{
  --wood-1:#8a6240; --wood-2:#684630; --wood-3:#432b1c; --wood-hi:#b08458;
  --paper:#fff7e2; --paper-2:#f4e6c2; --paper-3:#e6d3a6; --paper-line:#cdb583;
  --ink:#3b2a1d; --ink-2:#7a6650; --ink-3:#a8977c;
  --sky-1:#bfe3f3; --sky-2:#e8f4dc; --grass:#8ec46a;
  --orange:#f08a2b; --orange-d:#b95f12; --green:#55b24b; --green-d:#2f7d29; --blue:#4a95e0; --blue-d:#2563a8; --pink:#e8648c; --pink-d:#a22a52; --red:#d6483c;
  --r-sr:#8aa4c8; --r-ssr:#a56ad8; --r-ur:#f0b73c;
  --wei:#3f63ad; --shu:#4f9e5e; --wu:#d6483c; --qun:#7d5aa8; --man:#d98a24; --xian:#2a9d98;
  --f-d:'ZCOOL KuaiLe','Noto Sans SC','PingFang SC','Microsoft YaHei','WenQuanYi Zen Hei',sans-serif;
  --f-b:'Noto Sans SC','PingFang SC','Microsoft YaHei','WenQuanYi Zen Hei',sans-serif;
  --nav-h:72px;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;margin:0}
body{background:#2b2236;font-family:var(--f-b);color:var(--ink);overflow:hidden;-webkit-user-select:none;user-select:none}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
.ic{display:inline-block;flex:none;line-height:0}.ic svg{width:100%;height:100%;display:block}

/* ---------- 应用外壳 ---------- */
.app{position:relative;width:min(100vw,430px);height:min(100%,932px);margin:0 auto;overflow:hidden;background:linear-gradient(#cfe9f2,#eaf3dd 30%,#8ec46a 100%);box-shadow:0 0 60px rgba(0,0,0,.5)}
@media (min-width:520px) and (min-height:700px){.app{margin-top:max(0px,calc((100% - 900px)/2));height:min(100%,900px);border-radius:34px;border:8px solid #1d1624}}
.screen{position:absolute;inset:0 0 var(--nav-h) 0;display:none;flex-direction:column;overflow:hidden}
.screen.on{display:flex}
.scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 12px 18px;-webkit-overflow-scrolling:touch}
.scroll::-webkit-scrollbar{width:0}
.title{font-family:var(--f-d);font-size:22px;letter-spacing:.04em}
.muted{color:var(--ink-2)}
.num{font-variant-numeric:tabular-nums}

/* ---------- 顶栏 ---------- */
.hud{display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(var(--wood-1),var(--wood-2));border-bottom:4px solid var(--wood-3);box-shadow:0 3px 0 rgba(0,0,0,.18);position:relative;z-index:3}
.hud::after{content:'';position:absolute;left:0;right:0;bottom:-8px;height:4px;background:repeating-linear-gradient(90deg,var(--wood-3) 0 8px,transparent 8px 14px);opacity:.35}
.avatar{width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff3d6,#f0c88a);border:3px solid #ffe9b8;box-shadow:0 0 0 2px var(--wood-3);padding:5px;flex:none}
.who{min-width:0;flex:1}
.who b{display:block;font-family:var(--f-d);font-weight:400;font-size:16px;color:#fff6dc;line-height:1.1;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.xp{height:7px;border-radius:5px;background:rgba(0,0,0,.35);overflow:hidden;margin-top:3px}
.xp i{display:block;height:100%;background:linear-gradient(#ffe08a,#f0a62e);border-radius:5px}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 6px 3px 4px;border-radius:999px;background:rgba(40,24,12,.55);color:#fff6dc;font-weight:700;font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.18)}
.chip .plus{width:20px;height:20px;margin-left:2px}
.chip.light{background:var(--paper);color:var(--ink);box-shadow:inset 0 0 0 2px var(--paper-line)}

/* ---------- 面板 / 卡片 ---------- */
.panel{position:relative;background:var(--paper);border-radius:18px;padding:12px 14px;box-shadow:0 3px 0 var(--paper-line),0 8px 14px -8px rgba(60,36,12,.45);border:2px solid #fff;outline:2px solid var(--paper-line);outline-offset:-5px}
.panel.dark{background:linear-gradient(#7a5436,#5b3d28);color:#fff6dc;border-color:#9a7048;outline-color:rgba(0,0,0,.25)}
.panel h3{margin:0 0 6px;font-family:var(--f-d);font-weight:400;font-size:17px}
.row{display:flex;align-items:center;gap:8px}
.grow{flex:1;min-width:0}
.tag{display:inline-flex;align-items:center;gap:4px;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;background:var(--paper-2);color:var(--ink-2)}
.tag.f{color:#fff;background:var(--c,var(--wei))}
.tag.r{color:#2b2833;font-family:var(--f-d);font-weight:400;background:var(--rc,var(--r-ssr))}

/* ---------- 按钮 ---------- */
.btn{position:relative;top:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:8px 18px 10px;border-radius:16px;font-family:var(--f-d);font-size:18px;letter-spacing:.05em;color:#5a2a05;background:linear-gradient(#ffc06a,#f08a2b);box-shadow:0 5px 0 var(--orange-d),0 9px 12px -6px rgba(120,60,10,.6),inset 0 2px 0 rgba(255,255,255,.55);transition:top .06s,box-shadow .06s}
.btn:active:not(:disabled){top:4px;box-shadow:0 1px 0 var(--orange-d),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.green{color:#14400f;background:linear-gradient(#a8e895,#55b24b);box-shadow:0 5px 0 var(--green-d),0 9px 12px -6px rgba(30,100,30,.6),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.green:active:not(:disabled){box-shadow:0 1px 0 var(--green-d),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.blue{color:#0f2f57;background:linear-gradient(#9bd6ff,#4a95e0);box-shadow:0 5px 0 var(--blue-d),0 9px 12px -6px rgba(30,70,140,.6),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.blue:active:not(:disabled){box-shadow:0 1px 0 var(--blue-d),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.pink{color:#4a0f26;background:linear-gradient(#ffb5ce,#e8648c);box-shadow:0 5px 0 var(--pink-d),inset 0 2px 0 rgba(255,255,255,.55)}
.btn.ghost{color:var(--ink);background:linear-gradient(var(--paper),var(--paper-2));box-shadow:0 4px 0 var(--paper-line),inset 0 2px 0 #fff}
.btn.sm{min-height:34px;padding:5px 12px 7px;font-size:15px;border-radius:13px}
.btn.lg{min-height:52px;font-size:22px;padding:10px 26px 12px}
.btn:disabled{filter:grayscale(.85) brightness(1.05);opacity:.7;cursor:default}
.btn small{display:block;font-family:var(--f-b);font-size:11px;font-weight:700;opacity:.85;letter-spacing:0}
.btn .cost{display:inline-flex;align-items:center;gap:3px;font-family:var(--f-b);font-size:12px;font-weight:700}

/* ---------- 分段 / 筛选 ---------- */
.seg{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px}.seg::-webkit-scrollbar{height:0}
.pill{flex:none;display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:3px 12px;border-radius:999px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);font-weight:700;font-size:13px;color:var(--ink-2)}
.pill[aria-pressed=true]{background:var(--c,var(--orange));color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.22);text-shadow:0 1px 0 rgba(0,0,0,.2)}
.pill.glyph{width:34px;padding:0;justify-content:center;font-family:var(--f-d);font-size:16px}

/* ---------- 底部导航 ---------- */
.nav{position:absolute;left:0;right:0;bottom:0;height:var(--nav-h);display:grid;grid-template-columns:repeat(5,1fr);background:linear-gradient(var(--wood-1),var(--wood-2) 40%,var(--wood-3));border-top:4px solid var(--wood-hi);padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));z-index:5;box-shadow:0 -4px 14px rgba(0,0,0,.25)}
.nav button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:14px;color:#e8d4b0;font-family:var(--f-d);font-size:13px;letter-spacing:.06em;position:relative;transition:transform .15s}
.nav button .ic{width:30px;height:30px;filter:grayscale(.35) brightness(.9);transition:transform .15s}
.nav button.on{color:#fff;background:linear-gradient(rgba(255,235,190,.28),rgba(255,235,190,.06));box-shadow:inset 0 0 0 2px rgba(255,235,190,.35)}
.nav button.on .ic{filter:none;transform:translateY(-4px) scale(1.14)}
.nav button .dot{position:absolute;top:4px;right:calc(50% - 24px);width:11px;height:11px;border-radius:50%;background:var(--red);border:2px solid #fff;display:none}
.nav button.hasdot .dot{display:block}

/* ---------- 英雄卡牌 ---------- */
.hcard{--c:var(--wei);--rc:var(--r-ssr);position:relative;border-radius:14px;overflow:hidden;background:var(--paper);box-shadow:0 3px 0 rgba(60,36,12,.25);transition:transform .12s;text-align:left;display:block;width:100%}
.hcard:active{transform:scale(.97)}
.hcard::before{content:'';position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 3px var(--rc)}
.hcard[data-r=UR]{--rc:var(--r-ur)}.hcard[data-r=SSR]{--rc:var(--r-ssr)}.hcard[data-r=SR]{--rc:var(--r-sr)}
.hcard .art{position:relative;aspect-ratio:1/1.06;background:radial-gradient(circle at 50% 66%,color-mix(in srgb,var(--c) 38%,#fff7e2),#efe2bf 74%);overflow:hidden}
.hcard .art img{position:absolute;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.hcard .rar{position:absolute;left:5px;top:5px;z-index:4;font-family:var(--f-d);font-size:12px;padding:0 8px;border-radius:999px;background:var(--rc);color:#2b2833;box-shadow:0 1px 0 rgba(0,0,0,.25)}
.hcard .fg{position:absolute;right:5px;top:5px;z-index:4;width:22px;height:22px;border-radius:8px;background:var(--c);color:#fff;display:grid;place-items:center;font-family:var(--f-d);font-size:13px;box-shadow:0 1px 0 rgba(0,0,0,.3)}
.hcard .role{position:absolute;left:5px;bottom:5px;z-index:4;width:20px;height:20px;border-radius:50%;background:rgba(255,247,226,.92);padding:2px;box-shadow:0 1px 0 rgba(0,0,0,.25)}
.hcard .info{padding:3px 6px 5px;background:linear-gradient(var(--paper),var(--paper-2));display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:34px}
.hcard .info b{font-family:var(--f-d);font-weight:400;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hcard .info .lv{font-size:11px;font-weight:700;color:var(--ink-2);white-space:nowrap}
.hcard .stars{position:absolute;left:0;right:0;bottom:30px;z-index:4;display:flex;justify-content:center;gap:1px;pointer-events:none}
.hcard .stars .ic{width:12px;height:12px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.35))}
.hcard .badge{position:absolute;right:4px;bottom:36px;z-index:4;font-size:10px;font-weight:700;padding:0 6px;border-radius:999px;background:var(--green);color:#fff;box-shadow:0 1px 0 rgba(0,0,0,.3)}
.hcard.off .art img{filter:grayscale(1) brightness(.55) contrast(.9)}
.hcard.off .info{opacity:.6}
.hcard[data-r=UR]::after{content:'';position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:2;background:linear-gradient(115deg,transparent 40%,rgba(255,244,190,.5) 50%,transparent 60%);background-size:260% 100%;animation:shine 4.5s ease-in-out infinite}
@keyframes shine{0%,55%{background-position:130% 0}100%{background-position:-40% 0}}

/* ---------- 弹层 / 底部抽屉 ---------- */
.mask{position:absolute;inset:0;background:rgba(24,14,34,.62);z-index:20;display:flex;align-items:flex-end;justify-content:center;animation:fadein .18s}
.mask.center{align-items:center;padding:16px}
.sheet{width:100%;max-height:92%;overflow-y:auto;background:var(--paper);border-radius:24px 24px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 24px rgba(0,0,0,.4);animation:rise .24s cubic-bezier(.2,.9,.3,1.1);position:relative}
.sheet::before{content:'';display:block;width:44px;height:5px;border-radius:3px;background:var(--paper-line);margin:0 auto 10px}
.dialog{width:100%;background:var(--paper);border-radius:22px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.5);animation:pop .22s cubic-bezier(.2,.9,.3,1.2)}
.close{position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:50%;background:var(--wood-2);padding:7px;box-shadow:0 2px 0 var(--wood-3)}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes rise{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes pop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}

/* ---------- 其它 ---------- */
.bar{height:9px;border-radius:6px;background:rgba(60,36,12,.18);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.2)}
.bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(#ffd96a,#f0a62e)}
.bar.green i{background:linear-gradient(#a8e895,#55b24b)}
.toast{position:absolute;left:50%;top:84px;transform:translateX(-50%);z-index:40;background:rgba(43,28,16,.92);color:#fff6dc;padding:8px 16px;border-radius:999px;font-weight:700;font-size:14px;box-shadow:0 6px 16px rgba(0,0,0,.4);animation:toast 1.9s forwards;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
@keyframes toast{0%{opacity:0;transform:translate(-50%,-10px)}10%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
.floaty{position:absolute;z-index:30;pointer-events:none;font-family:var(--f-d);font-size:20px;color:#fff;text-shadow:-1px -1px 0 #b95f12,1px -1px 0 #b95f12,-1px 1px 0 #b95f12,1px 1px 0 #b95f12;animation:floaty 1.2s ease-out forwards;display:flex;align-items:center;gap:4px}
@keyframes floaty{from{opacity:1;transform:translateY(0) scale(.8)}20%{transform:translateY(-8px) scale(1.1)}to{opacity:0;transform:translateY(-46px) scale(1)}}
.empty{padding:26px 12px;text-align:center;color:var(--ink-2)}
@media (prefers-reduced-motion:reduce){.hcard[data-r=UR]::after{animation:none}.sheet,.dialog,.mask{animation:none}}
`;
