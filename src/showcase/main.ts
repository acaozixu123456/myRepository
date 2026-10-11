import { catSvg } from '../art/cat';
import { FACTIONS, FACTION_ORDER } from '../data/factions';
import type { FactionId } from '../data/factions';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import type { HeroDef, Rarity, Role } from '../data/heroes';
import { SKILLS, SKILL_KIND_NAME } from '../data/skills';
import { STATUSES } from '../data/statuses';
import { BONDS, COUNTER_REASON, COUNTER_RING, ROLES, baseStats } from '../data/systems';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

// ---------- 立绘（SVG -> data URI，避免重复滤镜 id 冲突，也减轻 DOM） ----------
const imgCache = new Map<string, string>();
const FULL = '-40 -40 480 540';
const BUST = '30 20 340 330';
function art(h: HeroDef, view = FULL, flip = false): string {
  const key = `${h.id}|${view}|${flip}`;
  let uri = imgCache.get(key);
  if (!uri) {
    const svg = catSvg({ ...h.look, flip }, { width: 480, height: 540, viewBox: view, uid: `i${imgCache.size}` });
    uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    imgCache.set(key, uri);
  }
  return uri;
}
const img = (h: HeroDef, view = FULL, alt = h.name, flip = false) => `<img src="${art(h, view, flip)}" alt="${alt}" decoding="async">`;
const fcolor = (f: FactionId) => `var(--${f})`;

const PAW = `<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="21" rx="8" ry="6.5" fill="currentColor"/><ellipse cx="6.5" cy="14" rx="3" ry="4" fill="currentColor"/><ellipse cx="25.5" cy="14" rx="3" ry="4" fill="currentColor"/><ellipse cx="12" cy="8" rx="3" ry="4.2" fill="currentColor"/><ellipse cx="20" cy="8" rx="3" ry="4.2" fill="currentColor"/></svg>`;

const URS = ['wei_caomiaode', 'shu_liumiaobei', 'wu_zhoumiaoyu', 'qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci'].map((id) => HERO_BY_ID[id]);

// ---------- 页面骨架 ----------
function renderPage(): string {
  const skillCount = Object.values(SKILLS).reduce((n, a) => n + a.length, 0);
  return `
<div class="wrap">
  <header class="top">
    <div class="brand" style="color:var(--accent)">${PAW}<span style="color:var(--ink)">猫国志</span></div>
    <nav aria-label="章节">
      <a href="#world">世界观</a><a href="#factions">六大阵营</a><a href="#dex">猫猫图鉴</a><a href="#system">战斗系统</a><a href="#ui">界面风格</a><a href="#road">路线</a>
    </nav>
    <button class="themebtn" id="themebtn" type="button">切换明暗</button>
  </header>

  <section class="hero" style="padding-top:8px">
    <div>
      <div class="eyebrow">放置挂机卡牌 RPG · 阶段一 · 设定集与角色美术</div>
      <h1>猫国<span>志</span></h1>
      <p class="lede">九命天子只剩最后一命。六大猫族各举旗号，争夺“九命印”。你是新上任的铲屎官军师，带着一群毛茸茸的将军，在挂机与养成里打下天下。</p>
      <div class="stats">
        <span class="chip"><b>6</b>大阵营</span><span class="chip"><b>${HEROES.length}</b>只猫猫（首批）</span><span class="chip"><b>${skillCount}</b>个技能</span><span class="chip"><b>${STATUSES.length}</b>种状态</span><span class="chip"><b>${BONDS.length}</b>组羁绊</span>
      </div>
    </div>
    <div class="lineup" aria-label="六位 UR 猫猫">
      ${URS.map((h) => `<button type="button" data-open="${h.id}" aria-label="查看${h.name}">${img(h)}</button>`).join('')}
    </div>
  </section>

  <section id="world">
    <div class="sec-head"><div><div class="eyebrow">世界观</div><h2>喵洲大陆与九命印</h2></div><p>三国的骨架，猫的血肉。历史人物全部换成一只只有性格的猫，名字是谐音，梗是真的。</p></div>
    <div class="world">
      <div class="panel">
        <h3>故事</h3>
        <p>喵洲大陆由“九命天子”坐镇中喵。传说天子有九条命，每一条命守护一方安宁。如今命数只剩最后一条，北有魏的铁壁军，西有蜀的仁义盟，东南有吴的赤焰水师，中原群雄并起，南疆蛮寨磨牙，云端的玄门看着一切摇头晃脑。</p>
        <p>谁拿到“九命印”，谁就能续上天子的命，成为新的喵洲之主。而你，是一位被意外召唤来的铲屎官。你不会打架，但猫猫们认你这个会开罐头的人。</p>
        <p class="muted" style="margin-top:14px">基调：轻松、暖、带点冷幽默。战斗再激烈，也不会有血，倒下的猫猫只是“睡着了”。</p>
      </div>
      <div class="panel">
        <h3>大事记（剧情章节骨架）</h3>
        <ol class="timeline">
          <li><span class="when">序章</span><span>黄昏的纸箱里，铲屎官捡到第一只猫：诸葛喵亮，它说“让我再想想”。</span></li>
          <li><span class="when">第一卷</span><span>群猫讨董。董桌掀翻了天下的饭桌，各路猫雄会盟。</span></li>
          <li><span class="when">第二卷</span><span>官渡·赤壁。曹喵德与周喵瑜隔江对峙，火与水的联动战。</span></li>
          <li><span class="when">第三卷</span><span>七擒七纵。南蛮山林的图腾与藤甲。</span></li>
          <li><span class="when">终卷</span><span>云端玄门开启，九命印现世，新的命运选择。</span></li>
        </ol>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <h3>货币与养成资源</h3>
      <div class="cur">
        <div><b>小鱼干</b><span>金币。升级、突破、商店。</span></div>
        <div><b>金铃铛</b><span>钻石。招募、体力、礼包。</span></div>
        <div><b>猫薄荷</b><span>养成素材。觉醒、升星、技能升级。</span></div>
        <div><b>毛线球</b><span>挂机加速券。立即领取一段离线收益。</span></div>
        <div><b>招福符</b><span>招募券。普通招募与阵营定向招募。</span></div>
        <div><b>猫爪印</b><span>竞技场与公会商店通用货币。</span></div>
      </div>
    </div>
  </section>

  <section id="factions">
    <div class="sec-head"><div><div class="eyebrow">六大阵营</div><h2>六族猫猫，各有各的脾气</h2></div><p>每个阵营有独立的机制、猫种和审美。组队时同阵营越多，阵营加成越强；混搭又有群雄的“乱世”加成，两条路都能玩。</p></div>
    <div class="fac-grid">
      ${FACTION_ORDER.map((id) => {
        const f = FACTIONS[id];
        const hs = HEROES.filter((h) => h.faction === id);
        return `<article class="fac" style="--c:${fcolor(id)}">
          <div class="band"><div class="glyph">${f.glyph}</div><div><h3>${f.full}</h3><small>${f.land} · ${f.role}</small></div></div>
          <div class="body">
            <div class="motto">“${f.motto}”</div>
            <p>${f.vibe}</p>
            <dl class="kv"><dt>猫种</dt><dd>${f.breeds}</dd><dt>克制</dt><dd>${FACTIONS[f.counters].name}（伤害 +20%）</dd></dl>
            <div class="mech"><b>${f.mechanic}</b>${f.mechanicDesc}</div>
            <div class="faces">${hs.map((h) => `<button type="button" data-open="${h.id}" class="face" aria-label="${h.name}">${img(h, BUST)}</button>`).join('')}</div>
          </div>
        </article>`;
      }).join('')}
    </div>
    <div class="ring-wrap">
      ${counterRing()}
      <div>
        <h3 style="font-size:24px;margin-bottom:10px">阵营克制环</h3>
        <p style="color:var(--ink2);margin-bottom:12px">六个阵营首尾相接，每个阵营克制一个、被一个克制。克制方伤害 +20%，被克制方 -20%。没有万能阵容，也不会有人被彻底锁死，因为羁绊和技能能补偿。</p>
        <ul class="ring-list">
          ${COUNTER_RING.map((id, i) => {
            const t = COUNTER_RING[(i + 1) % 6];
            return `<li style="--c:${fcolor(id)}"><span class="pill">${FACTIONS[id].name}</span><span>克制</span><span class="pill" style="--c:${fcolor(t)}">${FACTIONS[t].name}</span><span style="color:var(--ink2)">${COUNTER_REASON[id]}</span></li>`;
          }).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section id="dex">
    <div class="sec-head"><div><div class="eyebrow">猫猫图鉴</div><h2>首批 ${HEROES.length} 只猫猫</h2></div><p>点开任意一张卡，可以看完整立绘、背景故事、属性和 4 个技能。</p></div>
    <div class="filters" id="filters"></div>
    <div class="dex" id="dex-grid"></div>
  </section>

  <section id="system">
    <div class="sec-head"><div><div class="eyebrow">战斗系统</div><h2>挂机不无脑，策略藏在阵容里</h2></div><p>5 个位置，前排 3 后排 2，自动战斗。玩家决定的是“谁上场、站哪里、带什么羁绊”，以及关键时刻手动放一次绝技。</p></div>
    <div class="loop">
      <div class="step"><b>挂机收益</b><p>离线也在推关，随时间产出小鱼干、经验和装备，领取上限随主城等级提升。</p></div>
      <div class="step"><b>推图与关卡</b><p>章节制主线，每章有剧情、Boss、阵营限制关，推图进度决定挂机收益档位。</p></div>
      <div class="step"><b>招募</b><p>金铃铛抽卡，保底、阵营定向池、UP 池，重复猫猫转为专属碎片。</p></div>
      <div class="step"><b>养成</b><p>升级、突破、升星、觉醒、装备、技能升级，一只猫能练出三四种玩法。</p></div>
      <div class="step"><b>阵容与羁绊</b><p>同阵营加成、指定组合羁绊、克制环，搭配空间大。</p></div>
      <div class="step"><b>长线玩法</b><p>爬塔、竞技场、公会、秘境、世界 Boss，每周轮换词缀保持新鲜。</p></div>
    </div>

    <div class="two" style="margin-top:26px">
      <div class="panel">
        <h3>元气与回合</h3>
        <p>每只猫有 100 点元气槽。普攻回复 20 点，受击回复 10 点，满了自动或手动释放绝技。速度决定出手顺序。被动技能在战斗开始、回合开始、受击、击杀等时机触发。</p>
        <h3 style="margin-top:16px">职业定位</h3>
        <div class="stl" style="grid-template-columns:1fr;margin-top:8px">
          ${(Object.keys(ROLES) as Role[]).map((r) => `<div class="st" style="grid-template-columns:70px 1fr"><b style="grid-row:span 1">${r}</b><p>${ROLES[r].row} · ${ROLES[r].desc}</p></div>`).join('')}
        </div>
      </div>
      <div class="panel">
        <h3>稀有度</h3>
        <p><span class="tag r" style="--rc:var(--r-sr)">SR</span> 基础，数量最多，阵容过渡与资源喂养。</p>
        <p><span class="tag r" style="--rc:var(--r-ssr)">SSR</span> 主力，阵营核心，绝技效果明确。</p>
        <p><span class="tag r" style="--rc:var(--r-ur)">UR</span> 阵营旗帜，每个阵营 1 只，自带体系级机制，获取难度最高。</p>
        <h3 style="margin-top:16px">成长线</h3>
        <p style="color:var(--ink2)">等级上限 → 突破（解锁属性与技能位）→ 升星（★1~★5，★5 解锁“觉醒”技能）→ 装备（武器 / 服饰 / 饰品 / 铃铛，四件套）→ 专属羁绊。</p>
      </div>
    </div>

    <div style="margin-top:26px">
      <h3 style="font-size:26px;margin-bottom:12px">状态效果</h3>
      <div class="stl">
        ${STATUSES.map((s) => `<div class="st ${s.kind}"><span class="ic">${s.icon}</span><b>${s.name}<small>${s.kind === 'buff' ? '增益' : '减益'}</small></b><p>${s.desc}</p></div>`).join('')}
      </div>
    </div>

    <div style="margin-top:26px">
      <h3 style="font-size:26px;margin-bottom:12px">羁绊</h3>
      <div class="bonds" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
        ${BONDS.map((b) => `<div class="bond"><div class="faces">${b.heroes.map((id) => img(HERO_BY_ID[id], BUST)).join('')}</div><b>${b.name}</b><p>${b.desc}</p></div>`).join('')}
      </div>
    </div>
  </section>

  <section id="ui">
    <div class="sec-head"><div><div class="eyebrow">界面风格</div><h2>软萌绘本，按钮像软糖</h2></div><p>界面和角色同一个方向：厚实的圆角、带高光的糖果按钮、纸张底色、肉垫图案。不用玻璃拟态，也不用冷冰冰的科幻线框。</p></div>
    <div class="ui-board">
      <div class="panel">
        <h3>色彩</h3>
        <div class="swatches">
          ${[['纸绿', '#e9ede2', '底色'], ['墨紫', '#2b2833', '文字'], ['橘爪', '#d9703a', '主操作'], ['魏蓝', '#3f63ad', '阵营'], ['蜀绿', '#4f9e5e', '阵营'], ['吴红', '#d6483c', '阵营'], ['群紫', '#7d5aa8', '阵营'], ['蛮橙', '#d98a24', '阵营'], ['仙青', '#2a9d98', '阵营'], ['UR 金', '#e8b73c', '稀有度']]
            .map(([n, c, u]) => `<div class="sw"><i style="background:${c}"></i><span><b>${n}</b>${c} · ${u}</span></div>`).join('')}
        </div>
        <h3 style="margin-top:18px">按钮</h3>
        <div class="btns"><button class="gbtn" type="button">出征</button><button class="gbtn green" type="button">领取收益</button><button class="gbtn blue" type="button">招募</button><button class="gbtn ghost" type="button">返回</button></div>
      </div>
      <div class="panel">
        <h3>界面规则</h3>
        <ul class="mini-rules">
          <li><b>字体</b><span>标题用圆润手写感字体，正文用无衬线；数字用等宽对齐，伤害数字带描边。</span></li>
          <li><b>形状</b><span>所有面板大圆角，描边用同色深色而非纯黑；按钮底部有“厚度”，按下时下沉。</span></li>
          <li><b>稀有度</b><span>SR 银蓝、SSR 紫、UR 金，卡牌边框与角标一致；UR 带缓慢扫光。</span></li>
          <li><b>阵营</b><span>每个阵营一种主题色和一个字徽，出现在卡牌角标、技能图标和战场底座。</span></li>
          <li><b>反馈</b><span>点击有轻微弹性，领取有鱼干飞入动画，抽卡有光柱与剪影揭晓。</span></li>
          <li><b>图标</b><span>正式版全部手绘：肉垫、鱼骨、毛线球、铃铛、猫抓板，代替通用图标库。</span></li>
        </ul>
      </div>
    </div>
    <div class="phones">
      <div class="phone-col">${phoneIdle()}<div class="ph-cap">主界面·挂机战斗（示意）</div></div>
      <div class="phone-col">${phoneGacha()}<div class="ph-cap">招募·抽卡（示意）</div></div>
    </div>
  </section>

  <section id="road">
    <div class="sec-head"><div><div class="eyebrow">推进计划</div><h2>接下来怎么做</h2></div><p>每个阶段结束都会给你看成果，确认方向后再往下走。</p></div>
    <div class="road">
      <div class="phase now"><div class="n">阶段一<small>进行中</small></div><p>世界观、六大阵营、24 只猫猫的设定与立绘样稿、技能设定、UI 风格板。<b>你正在看的就是这一阶段的成果。</b></p></div>
      <div class="phase"><div class="n">阶段二<small>下一步</small></div><p>可玩原型：自动战斗引擎（按本稿技能实现）、主界面、阵容、招募、挂机收益，先用现有立绘跑通核心循环。</p></div>
      <div class="phase"><div class="n">阶段三</div><p>养成与内容：升级突破升星觉醒、装备、羁绊、章节关卡与剧情、爬塔与竞技场；补齐第二批猫猫（每阵营 5~8 只）。</p></div>
      <div class="phase"><div class="n">阶段四</div><p>打磨与打包：动效与音效、新手引导、数值平衡、存档与离线收益、Capacitor 打包安卓 / iOS。</p></div>
    </div>
    <div class="ask">
      <h3 style="font-size:24px">想请你看看的几件事</h3>
      <ol>
        <li>猫猫的画风、比例（现在是约 2 头身站立）是否接近你想要的？要更萌、更帅，还是更写意？</li>
        <li>哪些猫猫的设定你喜欢或不喜欢？可以直接说“把 X 换成…”，我来改。</li>
        <li>六个阵营的主题和克制关系是否满意？有没有想加的三国人物（赵云、司马懿、孙权、黄忠…）？</li>
        <li>是否要加入“战斗中猫猫有简单动作”（攻击、受击、待机呼吸），还是先保持静态立绘？</li>
      </ol>
    </div>
  </section>

  <footer>猫国志 · 阶段一设定集 · 所有立绘由程序化矢量绘制，为可迭代的样稿。</footer>
</div>
<div id="modal-root"></div>`;
}

// ---------- 克制环 SVG ----------
function counterRing(): string {
  const R = 118;
  const cx = 160;
  const cy = 150;
  const pts = COUNTER_RING.map((id, i) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return { id, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
  });
  const arrows = pts
    .map((p, i) => {
      const q = pts[(i + 1) % 6];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const sx = p.x + ux * 32;
      const sy = p.y + uy * 32;
      const ex = q.x - ux * 34;
      const ey = q.y - uy * 34;
      const nx = -uy;
      const ny = ux;
      const mx = (sx + ex) / 2 + nx * 8;
      const my = (sy + ey) / 2 + ny * 8;
      const ang = Math.atan2(ey - my, ex - mx);
      const hx = ex - 9 * Math.cos(ang - 0.45);
      const hy = ey - 9 * Math.sin(ang - 0.45);
      const hx2 = ex - 9 * Math.cos(ang + 0.45);
      const hy2 = ey - 9 * Math.sin(ang + 0.45);
      return `<path d="M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}" fill="none" stroke="${fcolor(p.id)}" stroke-width="4" stroke-linecap="round"/><path d="M ${hx} ${hy} L ${ex} ${ey} L ${hx2} ${hy2}" fill="none" stroke="${fcolor(p.id)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  const nodes = pts
    .map(
      (p) =>
        `<g><circle cx="${p.x}" cy="${p.y}" r="28" fill="${fcolor(p.id)}" stroke="var(--card)" stroke-width="4"/><text x="${p.x}" y="${p.y + 10}" text-anchor="middle" font-size="28" fill="#fff" style="font-family:var(--font-display)">${FACTIONS[p.id].glyph}</text></g>`,
    )
    .join('');
  return `<svg viewBox="0 0 320 300" role="img" aria-label="阵营克制环：魏克群，群克蜀，蜀克蛮，蛮克吴，吴克仙，仙克魏">${arrows}${nodes}<text x="160" y="146" text-anchor="middle" font-size="15" fill="var(--ink2)">克制 +20%</text><text x="160" y="168" text-anchor="middle" font-size="13" fill="var(--ink2)">被克 -20%</text></svg>`;
}

// ---------- 手机界面示意 ----------
function phoneIdle(): string {
  const mine = ['wei_xuhuchi', 'shu_guanyunmiao', 'wu_zhoumiaoyu', 'xian_shuijing', 'shu_zhugemiaoliang'].map((id) => HERO_BY_ID[id]);
  const foes = ['man_wutugu', 'man_mulu', 'man_zhurong'].map((id) => HERO_BY_ID[id]);
  const navIcon = (label: string, on = false) => `<span class="${on ? 'on' : ''}">${PAW}${label}</span>`;
  return `<div class="phone"><div class="screen scr-idle">
    <div class="hud"><div class="pf"><span class="av">${img(HERO_BY_ID.shu_liumiaobei, BUST)}</span>Lv.32</div><div class="res"><span><i style="background:#8fd0ff"></i>126k</span><span><i style="background:#ffcf6a"></i>680</span></div></div>
    <div class="field" style="--c:#3f63ad">
      <div class="wave">第 3 章 · 7-12 · 南蛮山口</div>
      <div class="skillbar">${mine.map((h, i) => `<i style="--c:${fcolor(h.faction)}">${img(h, BUST)}<s style="height:${[100, 60, 30, 80, 45][i]}%"></s></i>`).join('')}</div>
      <div class="vs">VS</div>
      <span class="dmg" style="left:50%;top:40%;z-index:20">2,480</span><span class="dmg" style="left:58%;top:24%;font-size:22px;z-index:20">暴击 5,912</span><span class="dmg" style="left:6%;top:42%;color:#d9f7c8;z-index:20">+640</span>
      ${mine.map((h, i) => `<span class="cat" style="left:${[24, 27, 24, 0, 2][i]}%;bottom:${[44, 23, 2, 36, 14][i]}%;z-index:${10 - ([44, 23, 2, 36, 14][i] / 10 | 0)}">${img(h)}</span>`).join('')}
      ${foes.map((h, i) => `<span class="cat" style="right:${[24, 26, 0][i]}%;bottom:${[40, 16, 30][i]}%;z-index:${10 - ([40, 16, 30][i] / 10 | 0)}">${img(h, FULL, h.name, true)}</span>`).join('')}
    </div>
    <div class="idle-box"><div class="chest">鱼</div><div><b>挂机收益 12:48:05</b><span>小鱼干 +18,240 · 经验 +9,600</span></div><button class="gbtn" type="button">领取</button></div>
    <div class="nav">${navIcon('主城', true)}${navIcon('阵容')}${navIcon('招募')}${navIcon('征战')}${navIcon('背包')}</div>
  </div></div>`;
}

function phoneGacha(): string {
  const h = HERO_BY_ID.wu_zhoumiaoyu;
  return `<div class="phone"><div class="screen scr-gacha">
    <div class="hud"><div class="pf"><span class="av">${img(HERO_BY_ID.shu_liumiaobei, BUST)}</span>Lv.32</div><div class="res"><span><i style="background:#ffcf6a"></i>680</span><span><i style="background:#f6a8c8"></i>12</span></div></div>
    <div class="gacha-art"><div class="ray"></div><span class="up">UR 概率 UP</span>${img(h)}<span class="nm">周喵瑜 · 赤壁美周郎</span></div>
    <div>
      <div class="rates"><span>UR 1.5%</span><span>SSR 12%</span><span>SR 86.5%</span></div>
      <div class="gacha-btns"><button class="gbtn blue" type="button">招募 ×1<small>招福符 1 / 铃铛 160</small></button><button class="gbtn" type="button">招募 ×10<small>铃铛 1440 · 必出 SSR</small></button></div>
    </div>
  </div></div>`;
}

// ---------- 图鉴与弹窗 ----------
const state = { faction: 'all' as FactionId | 'all', rarity: 'all' as Rarity | 'all', role: 'all' as Role | 'all' };

function renderFilters() {
  const el = $('#filters');
  const btn = (kind: string, val: string, label: string, color?: string) =>
    `<button type="button" class="fbtn${color ? '' : ' plain'}" data-k="${kind}" data-v="${val}" aria-pressed="${(state as Record<string, string>)[kind] === val}" ${color ? `style="--c:${color}"` : ''}>${label}</button>`;
  el.innerHTML =
    `<div class="frow"><span class="lab">阵营</span>${btn('faction', 'all', '全部')}${FACTION_ORDER.map((f) => btn('faction', f, FACTIONS[f].name, fcolor(f))).join('')}</div>` +
    `<div class="frow"><span class="lab">稀有度</span>${btn('rarity', 'all', '全部')}${(['UR', 'SSR', 'SR'] as Rarity[]).map((r) => btn('rarity', r, r)).join('')}</div>` +
    `<div class="frow"><span class="lab">定位</span>${btn('role', 'all', '全部')}${(Object.keys(ROLES) as Role[]).map((r) => btn('role', r, r)).join('')}</div>`;
}

function renderDex() {
  const list = HEROES.filter((h) => (state.faction === 'all' || h.faction === state.faction) && (state.rarity === 'all' || h.rarity === state.rarity) && (state.role === 'all' || h.role === state.role));
  const order = { UR: 0, SSR: 1, SR: 2 } as Record<Rarity, number>;
  list.sort((a, b) => order[a.rarity] - order[b.rarity]);
  $('#dex-grid').innerHTML = list.length
    ? list
        .map(
          (h) => `<button type="button" class="hcard" data-open="${h.id}" data-r="${h.rarity}" style="--c:${fcolor(h.faction)}" aria-label="${h.name}，${FACTIONS[h.faction].name}，${h.rarity}，${h.role}">
        <div class="art"><span class="rar">${h.rarity}</span><span class="fg">${FACTIONS[h.faction].glyph}</span>${img(h)}</div>
        <div class="info"><b>${h.name}</b><span>${h.title} · ${h.role}</span></div></button>`,
        )
        .join('')
    : '<div class="empty">没有符合条件的猫猫，换个筛选试试。</div>';
}

let currentId: string | null = null;
let lastFocus: HTMLElement | null = null;

function openHero(id: string) {
  const h = HERO_BY_ID[id];
  if (!h) return;
  currentId = id;
  const f = FACTIONS[h.faction];
  const st = baseStats(h.role, h.rarity);
  const max = { hp: 1500, atk: 190, def: 100, spd: 140 };
  const bar = (label: string, v: number, m: number) => `<div class="stat"><span>${label}</span><i><s style="width:${Math.min(100, (v / m) * 100)}%"></s></i><em>${v}</em></div>`;
  const bonds = BONDS.filter((b) => b.heroes.includes(h.id));
  const skills = SKILLS[h.id] ?? [];
  const idx = HEROES.indexOf(h);
  $('#modal-root').innerHTML = `
  <div class="modal" role="dialog" aria-modal="true" aria-label="${h.name}">
    <div class="modal-box" style="--c:${fcolor(h.faction)};--rc:var(--r-${h.rarity.toLowerCase()})">
      <button class="close" type="button" data-close aria-label="关闭">×</button>
      <div class="stage">
        ${img(h, FULL, h.name)}
        <div class="navb" style="width:100%;max-width:360px"><button type="button" data-step="-1" aria-label="上一只">‹ ${HEROES[(idx + HEROES.length - 1) % HEROES.length].name}</button><button type="button" data-step="1" aria-label="下一只">${HEROES[(idx + 1) % HEROES.length].name} ›</button></div>
      </div>
      <div class="meta">
        <div><div class="sub">${h.title} · 原型 ${h.origin}</div><h3>${h.name}</h3></div>
        <div class="tags"><span class="tag f">${f.name} · ${f.full}</span><span class="tag r">${h.rarity}</span><span class="tag">${h.role}（${ROLES[h.role].row}）</span><span class="tag">${h.breed}</span><span class="tag">${h.age}</span></div>
        <p>${h.lore}</p>
        <div class="quote">“${h.quote}”</div>
        <p class="sub">喜好：${h.likes}</p>
        <div class="stats">${bar('生命', st.hp, max.hp)}${bar('攻击', st.atk, max.atk)}${bar('防御', st.def, max.def)}${bar('速度', st.spd, max.spd)}</div>
        <div class="skills">
          ${skills
            .map(
              (s) => `<div class="skill"><div class="h"><span class="k ${s.kind}">${SKILL_KIND_NAME[s.kind]}</span><b>${s.name}</b><span class="tg">${s.target}</span></div><p>${s.desc}</p><div class="sts">${s.tags.map((t) => `<span>${t}</span>`).join('')}</div></div>`,
            )
            .join('')}
        </div>
        ${bonds.length ? `<div><div class="eyebrow">羁绊</div>${bonds.map((b) => `<p><b>${b.name}</b>（${b.heroes.map((i) => HERO_BY_ID[i].name).join('、')}）：${b.desc}</p>`).join('')}</div>` : ''}
        <p class="sub">阵营机制 · ${f.mechanic}：${f.mechanicDesc}</p>
      </div>
    </div>
  </div>`;
  document.body.style.overflow = 'hidden';
  ($('#modal-root .close') as HTMLElement).focus();
}

function closeHero() {
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
  currentId = null;
  lastFocus?.focus();
}

// ---------- 启动 ----------
function boot() {
  $('#app').innerHTML = renderPage();
  renderFilters();
  renderDex();
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const open = t.closest('[data-open]') as HTMLElement | null;
    if (open) {
      lastFocus = open;
      openHero(open.dataset.open!);
      return;
    }
    if (t.closest('[data-close]') || (t.classList.contains('modal') && t === e.target)) {
      closeHero();
      return;
    }
    const step = t.closest('[data-step]') as HTMLElement | null;
    if (step && currentId) {
      const i = HEROES.findIndex((h) => h.id === currentId);
      openHero(HEROES[(i + +step.dataset.step! + HEROES.length) % HEROES.length].id);
      return;
    }
    const fb = t.closest('.fbtn') as HTMLElement | null;
    if (fb) {
      (state as Record<string, string>)[fb.dataset.k!] = fb.dataset.v!;
      renderFilters();
      renderDex();
    }
    if (t.closest('#themebtn')) {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!currentId) return;
    if (e.key === 'Escape') closeHero();
    if (e.key === 'ArrowRight') openHero(HEROES[(HEROES.findIndex((h) => h.id === currentId) + 1) % HEROES.length].id);
    if (e.key === 'ArrowLeft') openHero(HEROES[(HEROES.findIndex((h) => h.id === currentId) + HEROES.length - 1) % HEROES.length].id);
  });
}
boot();
