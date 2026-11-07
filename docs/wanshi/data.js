/* 万世洞天 · 游戏数据
 * 所有数值都集中在这里，调手感只需要改这个文件。
 * 时间单位都是“游戏秒”：设置里的试玩加速会让游戏秒走得比现实快。
 */
(function (root) {
  'use strict';
  const WS = root.WS = root.WS || {};

  WS.VERSION = '0.1.1';

  // 资质：每一世投胎时转出来的稀有度
  WS.TIERS = [
    { name: '凡品', mult: 1,   life: 1.00, weight: 50 },
    { name: '良品', mult: 1.5, life: 1.10, weight: 28 },
    { name: '上品', mult: 2.5, life: 1.20, weight: 15 },
    { name: '极品', mult: 4,   life: 1.35, weight: 6 },
    { name: '仙品', mult: 7,   life: 1.60, weight: 1 },
  ];
  WS.PITY = 10;      // 连续 9 次没出极品以上，第 10 次必出
  WS.FOX_DAY = 90;   // 狐狸那一世，一昼夜有多少游戏秒（前一半是白天）
  WS.FULL_MOON_EVERY = 5; // 每 5 个夜晚有一次满月

  WS.FORM_ORDER = ['ant', 'fox', 'human'];

  WS.FORMS = {
    ant: {
      id: 'ant', name: '蚂蚁', glyph: '蚁', realm: '虫道',
      intro: '你成了一只蚂蚁。蚁群从你一只开始，慢慢长成一个地下王国。',
      unlockHint: '某一世蚁群过万',
      yearSec: 45, lifespan: 20,
      mainName: '食', tapName: '觅食', legacy: 'soil',
      popName: '蚁群', popUnit: '只',
      growth: 1.15,
      skill: { name: '倾巢而出', desc: '30 秒内产食 ×5', dur: 30, cd: 180, mult: 5 },
      gens: [
        { id: 'worker',  name: '工蚁',     glyph: '工', pop: 1,    prod: 0.6,   cost: 10 },
        { id: 'chamber', name: '蚁穴',     glyph: '穴', pop: 12,   prod: 7.2,   cost: 150 },
        { id: 'trail',   name: '蚁道',     glyph: '道', pop: 100,  prod: 60,    cost: 2000 },
        { id: 'mound',   name: '蚁丘',     glyph: '丘', pop: 800,  prod: 480,   cost: 3e4 },
        { id: 'kingdom', name: '地下王国', glyph: '王', pop: 7000, prod: 4200,  cost: 5e5 },
        { id: 'nation',  name: '蚁国',     glyph: '国', pop: 6e4,  prod: 3.6e4, cost: 1e7 },
        { id: 'empire',  name: '蚁界',     glyph: '界', pop: 5e5,  prod: 3e5,   cost: 2.5e8 },
        { id: 'tribute', name: '万蚁朝宗', glyph: '宗', pop: 4e6,  prod: 2.4e6, cost: 6e9 },
        { id: 'world',   name: '蚁之天下', glyph: '下', pop: 3e7,  prod: 1.8e7, cost: 1.5e11 },
      ],
      ups: [
        { id: 'pher',  name: '信息素',   desc: '产食 ×2',                cost: 200,  eff: { prod: 2 } },
        { id: 'queen', name: '蚁后苏醒', desc: '自动产卵，蚁群自己扩张', cost: 3000, eff: { auto: true } },
        { id: 'rain',  name: '雨季储粮', desc: '觅食收获 ×10',           cost: 2e4,  eff: { tap: 10 } },
        { id: 'guard', name: '兵蚁护巢', desc: '产食 ×2',                cost: 5e5,  eff: { prod: 2 } },
        { id: 'link',  name: '蚁丘相连', desc: '产食 ×3',                cost: 5e7,  eff: { prod: 3 } },
        { id: 'crown', name: '蚁后加冕', desc: '产食 ×5',                cost: 5e9,  eff: { prod: 5 } },
      ],
      milestones: [
        { id: 'p2', stat: 'pop', at: 100, name: '百蚁',     merit: 1 },
        { id: 'p3', stat: 'pop', at: 1e3, name: '千蚁',     merit: 2 },
        { id: 'p4', stat: 'pop', at: 1e4, name: '万蚁',     merit: 4, unlock: 'fox' },
        { id: 'p5', stat: 'pop', at: 1e5, name: '十万蚁',   merit: 7 },
        { id: 'p6', stat: 'pop', at: 1e6, name: '百万蚁国', merit: 12 },
        { id: 'p7', stat: 'pop', at: 1e7, name: '千万蚁',   merit: 20 },
        { id: 'p8', stat: 'pop', at: 1e8, name: '亿蚁',     merit: 35 },
        { id: 'p9', stat: 'pop', at: 1e9, name: '十亿蚁',   merit: 55 },
      ],
    },

    fox: {
      id: 'fox', name: '狐狸', glyph: '狐', realm: '兽道',
      intro: '你成了一只山野狐狸。白天藏身，夜里吐纳月华，一尾一尾地修。',
      unlockHint: '某一世蚁群过万',
      yearSec: 4, lifespan: 240,
      mainName: '月华', tapName: '拜月', legacy: 'foxwood',
      growth: 1.15,
      skill: { name: '摄取灵果', desc: '立刻得到 90 秒的月华', instant: 90, cd: 180 },
      tail: { base: 3000, growth: 50, mult: 1.3 },
      gens: [
        { id: 'breath',   name: '吐纳',     glyph: '吐', prod: 0.6,   cost: 10 },
        { id: 'fire',     name: '狐火',     glyph: '火', prod: 6,     cost: 140 },
        { id: 'illusion', name: '幻术',     glyph: '幻', prod: 50,    cost: 1800 },
        { id: 'den',      name: '洞府',     glyph: '府', prod: 420,   cost: 2.5e4 },
        { id: 'clone',    name: '灵狐分身', glyph: '分', prod: 3600,  cost: 4e5 },
        { id: 'shrine',   name: '狐仙庙',   glyph: '庙', prod: 3e4,   cost: 8e6 },
        { id: 'heaven',   name: '天狐洞',   glyph: '天', prod: 2.7e5, cost: 2e8 },
        { id: 'qingqiu',  name: '青丘',     glyph: '青', prod: 2.2e6, cost: 6e9 },
        { id: 'tushan',   name: '涂山',     glyph: '涂', prod: 1.6e7, cost: 1.5e11 },
      ],
      ups: [
        { id: 'glow',  name: '狐火通明', desc: '月华 ×2',                    cost: 300,  eff: { prod: 2 } },
        { id: 'scent', name: '闻香识果', desc: '自动修炼，自己添功法、凝尾', cost: 5000, eff: { auto: true } },
        { id: 'gaze',  name: '望月凝神', desc: '拜月收获 ×10',               cost: 8e4,  eff: { tap: 10 } },
        { id: 'night', name: '夜行百里', desc: '夜里的加成从 ×2 变成 ×3',     cost: 2e6,  eff: { night: 3 } },
        { id: 'blood', name: '天狐血脉', desc: '月华 ×3',                    cost: 1e8,  eff: { prod: 3 } },
        { id: 'nine',  name: '九转玄功', desc: '凝尾消耗减半',               cost: 5e9, eff: { tailCost: 0.5 } },
      ],
      milestones: [
        { id: 't2', stat: 'tails', at: 2, name: '二尾',     merit: 2 },
        { id: 't3', stat: 'tails', at: 3, name: '三尾',     merit: 3, unlock: 'human' },
        { id: 't4', stat: 'tails', at: 4, name: '四尾',     merit: 5 },
        { id: 't5', stat: 'tails', at: 5, name: '五尾',     merit: 8 },
        { id: 't6', stat: 'tails', at: 6, name: '六尾',     merit: 12 },
        { id: 't7', stat: 'tails', at: 7, name: '七尾',     merit: 18 },
        { id: 't8', stat: 'tails', at: 8, name: '八尾',     merit: 26 },
        { id: 't9', stat: 'tails', at: 9, name: '九尾天狐', merit: 40 },
      ],
    },

    human: {
      id: 'human', name: '凡人', glyph: '人', realm: '人道',
      intro: '人身难得。你生在山脚下的小村，开荒种地，成家立业，读书明理。',
      unlockHint: '某一世修成三尾',
      yearSec: 25, lifespan: 50,
      mainName: '粮', tapName: '耕作', legacy: 'village',
      growth: 1.15,
      skill: { name: '祈雨', desc: '60 秒内产粮 ×3', dur: 60, cd: 240, mult: 3 },
      gens: [
        { id: 'field',   name: '开荒', glyph: '田', prod: 1,     cost: 10 },
        { id: 'wheel',   name: '水车', glyph: '车', prod: 9,     cost: 150 },
        { id: 'mill',    name: '磨坊', glyph: '磨', prod: 75,    cost: 2000 },
        { id: 'market',  name: '集市', glyph: '市', prod: 650,   cost: 3e4 },
        { id: 'caravan', name: '商队', glyph: '商', prod: 5500,  cost: 5e5 },
        { id: 'bank',    name: '钱庄', glyph: '钱', prod: 4.8e4, cost: 9e6 },
        { id: 'guild',   name: '商会', glyph: '会', prod: 4e5,   cost: 2e8 },
        { id: 'imperial',name: '皇商', glyph: '皇', prod: 3.2e6, cost: 6e9 },
        { id: 'empire',  name: '富甲天下', glyph: '富', prod: 2.6e7, cost: 1.5e11 },
      ],
      specials: [
        { id: 'house',  name: '民居', glyph: '居', people: 2, cost: 50,  growth: 1.15 },
        { id: 'school', name: '学堂', glyph: '学', wen: 0.3,  cost: 400, growth: 1.35 },
      ],
      ups: [
        { id: 'farm',  name: '精耕细作', desc: '产粮 ×2',                    cost: 300,  eff: { prod: 2 } },
        { id: 'hire',  name: '雇长工',   desc: '自动经营，自己添置产业',     cost: 4000, eff: { auto: true } },
        { id: 'clan',  name: '宗族祠堂', desc: '每位人丁的加成从 3% 变成 6%', cost: 5e4, eff: { perPeople: 0.1 } },
        { id: 'water', name: '兴修水利', desc: '产粮 ×3',                    cost: 3e6,  eff: { prod: 3 } },
        { id: 'books', name: '书香门第', desc: '文气 ×3',                    cost: 3e7,  eff: { wen: 3 } },
        { id: 'silk',  name: '丝绸之路', desc: '产粮 ×4',                    cost: 5e8,  eff: { prod: 4 } },
      ],
      milestones: [
        { id: 'h1', stat: 'people', at: 10,  name: '人丁兴旺', merit: 1 },
        { id: 'w1', stat: 'wen',    at: 50,  name: '童生',     merit: 2,  prodMult: 1.3 },
        { id: 'h2', stat: 'people', at: 40,  name: '一方大户', merit: 3 },
        { id: 'w2', stat: 'wen',    at: 500, name: '秀才',     merit: 4,  prodMult: 1.3 },
        { id: 'h3', stat: 'people', at: 120, name: '名门望族', merit: 6 },
        { id: 'w3', stat: 'wen',    at: 5e3, name: '举人',     merit: 8,  prodMult: 1.3 },
        { id: 'h4', stat: 'people', at: 300, name: '一镇之主', merit: 12 },
        { id: 'w4', stat: 'wen',    at: 3e4, name: '进士',     merit: 16, prodMult: 1.3 },
        { id: 'h5', stat: 'people', at: 500, name: '一方诸侯', merit: 22 },
        { id: 'w5', stat: 'wen',    at: 2e5, name: '状元',     merit: 30, prodMult: 1.6 },
      ],
    },
  };

  // 以后版本的生灵，先在图鉴里占个位
  WS.FUTURE_FORMS = [
    { glyph: '修', name: '修士' },
    { glyph: '龙', name: '龙' },
    { glyph: '仙', name: '仙' },
  ];

  // 洞天里的东西。from 表示只能由那一种前世留下；其余的用灵气购买
  WS.FEATURES = [
    { id: 'soil',     name: '沃土',   glyph: '土', from: 'ant',   lingqi: 0.15, per: 30 },
    { id: 'foxwood',  name: '狐火林', glyph: '林', from: 'fox',   lingqi: 0.30, per: 30 },
    { id: 'village',  name: '小村',   glyph: '村', from: 'human', lingqi: 0.50, per: 30 },
    { id: 'spring',   name: '灵泉',   glyph: '泉', cost: 100, growth: 2.0 },
    { id: 'cloud',    name: '云海',   glyph: '云', cost: 120, growth: 2.0 },
    { id: 'peak',     name: '远山',   glyph: '山', cost: 150, growth: 2.2 },
    { id: 'pavilion', name: '凉亭',   glyph: '亭', cost: 180, growth: 2.2 },
    { id: 'pine',     name: '古松',   glyph: '松', cost: 200, growth: 2.3 },
    { id: 'terrace',  name: '望月台', glyph: '月', cost: 250, growth: 2.4 },
    { id: 'crane',    name: '仙鹤',   glyph: '鹤', cost: 300, growth: 2.5 },
  ];

  // 凡人那一世的村中事。grainPct 按当前存粮的比例增减
  WS.EVENTS = [
    { id: 'drought', title: '大旱', text: '今年大旱，邻村的灾民逃荒到了你家门口。',
      a: { label: '开仓赈灾', desc: '粮 -30%，功德 +3，人丁 +2', eff: { grainPct: -0.3, merit: 3, people: 2 } },
      b: { label: '闭门自保', desc: '什么也不发生', eff: {} } },
    { id: 'taoist', title: '游方道士', text: '一个游方道士路过，向你讨一碗斋饭。',
      a: { label: '施舍斋饭', desc: '粮 -10%，他留下一句口诀，洞天灵气增加', eff: { grainPct: -0.1, lingqi: 80 } },
      b: { label: '婉言谢绝', desc: '什么也不发生', eff: {} } },
    { id: 'harvest', title: '丰年', text: '风调雨顺，今年是个丰年。',
      a: { label: '多囤些粮', desc: '粮 +50%', eff: { grainPct: 0.5 } },
      b: { label: '办庙会', desc: '粮 -20%，功德 +2，此后产粮 +10%', eff: { grainPct: -0.2, merit: 2, prodBonus: 0.1 } } },
    { id: 'bandit', title: '山贼', text: '后山来了一伙山贼，扬言要下山抢粮。',
      a: { label: '组织乡勇', desc: '粮 -15%，人丁 +1', eff: { grainPct: -0.15, people: 1 } },
      b: { label: '破财消灾', desc: '粮 -40%', eff: { grainPct: -0.4 } } },
    { id: 'scholar', title: '书生借宿', text: '一个赶考的书生错过了宿头，想借宿一晚。',
      a: { label: '留他住下', desc: '他留下几本书，文气增加', eff: { wenSec: 120, wenMin: 20 } },
      b: { label: '不太方便', desc: '什么也不发生', eff: {} } },
    { id: 'plague', title: '时疫', text: '村里闹起了时疫，好几户人家病倒了。',
      a: { label: '请郎中来', desc: '粮 -25%', eff: { grainPct: -0.25 } },
      b: { label: '听天由命', desc: '人丁 -20%', eff: { peoplePct: -0.2 } } },
    { id: 'wedding', title: '喜事', text: '你家要办一门亲事。',
      a: { label: '大办三天', desc: '粮 -20%，人丁 +3', eff: { grainPct: -0.2, people: 3 } },
      b: { label: '简简单单', desc: '人丁 +1', eff: { people: 1 } } },
    { id: 'bridge', title: '修桥', text: '村口的石桥塌了，过路的人只能蹚水。',
      a: { label: '出钱修桥', desc: '粮 -35%，功德 +4', eff: { grainPct: -0.35, merit: 4 } },
      b: { label: '等官府来修', desc: '什么也不发生', eff: {} } },
    { id: 'stele', title: '古碑', text: '挖井时挖出一块刻满字的古碑。',
      a: { label: '请人拓下来', desc: '文气增加', eff: { wenSec: 60, wenMin: 10 } },
      b: { label: '填回去', desc: '什么也不发生', eff: {} } },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
