// 横屏布局：窗口比竖屏手机宽（宽 ≥ 640 且 宽高比 ≥ 1.12）时给 #root 加 .land。
// 外壳铺满窗口；底部导航变成左侧竖栏；主城是「左：战斗 + 队伍，右：挂机 / 按钮 / 入口」；
// 其余页面把竖着堆的面板排成多列，卡片网格按宽度自动铺满。只写样式，不改任何页面逻辑。
export const LAND_CSS = `
.app.land{width:100vw;max-width:none;height:100%;margin:0;border:0;border-radius:0;--nav-w:92px;--nav-h:0px}
.app.land .nav{left:0;top:0;bottom:0;right:auto;width:var(--nav-w);height:auto;grid-template-columns:1fr;grid-template-rows:repeat(6,1fr);padding:6px 6px;gap:4px;border-top:0;border-right:4px solid var(--wood-3);background:linear-gradient(90deg,var(--wood-1),var(--wood-2) 60%,var(--wood-3))}
.app.land .nav button{font-size:12px}
.app.land .screen{inset:0 0 0 var(--nav-w)}
.app.land .scroll{padding:12px 18px 22px}

/* ----- 主城 ----- */
.app.land .screen.home.on{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);grid-template-rows:auto auto minmax(0,1fr) auto auto;column-gap:6px;align-content:stretch}
.app.land .home #hud{grid-column:1/3;grid-row:1}
.app.land .home .stagebar{grid-column:1;grid-row:2}
.app.land .home .arena{grid-column:1;grid-row:3;min-height:0;display:flex;align-items:center;justify-content:center;background:#000}
.app.land .home .arena canvas{width:100%;height:100%;max-height:100%;aspect-ratio:960/600;object-fit:contain}
.app.land .home .teamstrip{grid-column:1;grid-row:4}
.app.land .home .ticker{grid-column:1;grid-row:5;margin-bottom:8px}
.home .side{display:contents}
.app.land .home .side{grid-column:2;grid-row:2/6;display:flex;flex-direction:column;gap:12px;padding-bottom:8px;min-height:0;overflow-y:auto}
.app.land .home .side>*{margin-left:10px;margin-right:10px;margin-top:0;flex:none}
.app.land .home .side .idle{margin-top:8px}
.app.land .home .side .quick{grid-template-columns:repeat(4,1fr);margin-top:auto}
.app.land .home .side .tip{order:9}

/* ----- 阵容：左阵型 + 羁绊，右名册 ----- */
.lcols,.lleft,.lright{display:contents}
.app.land .lcols{display:grid;grid-template-columns:minmax(360px,.78fr) minmax(0,1.5fr);gap:18px;align-items:start}
.app.land .lleft,.app.land .lright{display:block;min-width:0}
.app.land .roster{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}

/* ----- 招募：左大图，右概率 / 按钮 ----- */
.app.land .gacha .scroll{display:grid!important;grid-template-columns:minmax(0,1.25fr) minmax(300px,1fr);column-gap:18px;align-content:start;padding:12px 18px 18px!important}
.app.land .gacha .banner{grid-column:1;grid-row:1/7;margin:0;height:min(100%,560px);min-height:360px}
.app.land .gacha .scroll>:not(.banner){grid-column:2;margin-left:0!important;margin-right:0!important}

/* ----- 背包 / 商店 / 宠物 / 征战：卡片按宽度自动铺 ----- */
.app.land .bag-equip-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
.app.land .bag-hero-grid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.app.land .shop-grid{grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
.app.land .pets-screen .pt-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}
.app.land .cmap{grid-template-columns:repeat(6,1fr)}

.app.land .pets-screen .scroll{display:grid;grid-template-columns:minmax(320px,.8fr) minmax(0,1.4fr);column-gap:16px;align-content:start}
.app.land .pets-screen .scroll>*{grid-column:1;margin-left:0!important;margin-right:0!important}
.app.land .pets-screen .pt-grid{grid-column:2;grid-row:1/5;align-self:start;margin-top:10px!important}
.app.land .pets-screen .pt-stage{height:210px}

/* ----- 任务 / 充值：面板排成多列 ----- */
.app.land .qst-screen .scroll,.app.land [data-screen=pay] .scroll{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:12px 16px;align-content:start;align-items:start}
.app.land .qst-screen .scroll>*,.app.land [data-screen=pay] .scroll>*{margin:0!important}
.app.land .qst-screen .scroll>.seg,.app.land .qst-screen .scroll>.ev-tabs,.app.land [data-screen=pay] .scroll>.seg{grid-column:1/-1}
.app.land .qst-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:12px 16px;align-items:start}
.app.land .qst-scroll>.qst-summary,.app.land .qst-scroll>.qst-list,.app.land .qst-scroll>.qst-complete{grid-column:1/-1}

/* ----- 弹层：别铺满整个宽屏 ----- */
.app.land .mask{left:var(--nav-w)}
.app.land .sheet{width:min(860px,96%);border-radius:24px;margin-bottom:12px;max-height:94%}
.app.land .dialog{max-width:560px}
`;
