import { FACTIONS, FACTION_ORDER } from '../data/factions';
import type { ItemDef } from './types';

// 使用效果目前只能写在 desc；消费逻辑与数值字段由后续养成系统接入。
// 碎片的银蓝 / 紫 / 金边框分别对应英雄稀有度 SR / SSR / UR。
export const ITEMS: ItemDef[] = [
  {
    id: 'fish', name: '小鱼干', kind: 'currency', quality: 'common', stack: 999999999,
    desc: '用于猫猫升级、突破与装备强化的通用货币；军需官数完，总要再数一遍自己的盘子。',
  },
  {
    id: 'bells', name: '金铃铛', kind: 'currency', quality: 'legend', stack: 999999999,
    desc: '用于招募与珍品兑换的货币；摇一摇，连午睡的掌柜都愿意开门。',
  },
  {
    id: 'paw_seal', name: '猫爪印', kind: 'currency', quality: 'rare', stack: 999999999,
    desc: '竞技场获得的兑换货币；爪印越整齐，越像认真比试过才去舔毛的猫。',
  },
  {
    id: 'guild_token', name: '同袍鱼牌', kind: 'currency', quality: 'rare', stack: 999999999,
    desc: '参与公会活动获得，可在公会商店兑换；一块牌记着许多双一起端饭的爪子。',
  },
  {
    id: 'tower_token', name: '登楼铃签', kind: 'currency', quality: 'rare', stack: 999999999,
    desc: '登塔获得，可在爬塔商店兑换；爬得再高，午饭仍要下楼领取。',
  },
  {
    id: 'faction_token', name: '六族盟笺', kind: 'currency', quality: 'epic', stack: 999999999,
    desc: '参与阵营活动获得，可在阵营商店兑换；六族都认这张笺，签名处偶尔有一撮毛。',
  },
  {
    id: 'catnip_small', name: '初阶猫薄荷', kind: 'material', quality: 'common',
    desc: '为一只英雄提供 500 点成长经验；一小撮清香，够把午睡的眼睛睁开一条缝。',
  },
  {
    id: 'catnip_medium', name: '中阶猫薄荷', kind: 'material', quality: 'fine',
    desc: '为一只英雄提供 2000 点成长经验；军师说学有所长，猫猫说闻有所长。',
  },
  {
    id: 'catnip_large', name: '高阶猫薄荷', kind: 'material', quality: 'rare',
    desc: '为一只英雄提供 8000 点成长经验；香气装了满满一罐，盖子仍是最受欢迎的部分。',
  },
  {
    id: 'fishbone_small', name: '细纹突破鱼骨', kind: 'material', quality: 'fine',
    desc: '用于英雄初阶突破；细细一根，能撑起将军第一次认真挺起的小胸脯。',
  },
  {
    id: 'fishbone_medium', name: '青纹突破鱼骨', kind: 'material', quality: 'rare',
    desc: '用于英雄中阶突破；青纹如军旗，许虎痴会先把它排得整整齐齐。',
  },
  {
    id: 'fishbone_large', name: '金纹突破鱼骨', kind: 'material', quality: 'epic',
    desc: '用于英雄高阶突破；磨得金亮的鱼骨，连关云喵都愿意借出梳胡须的布来擦。',
  },
  {
    id: 'awaken_jade', name: '九命醒玉', kind: 'material', quality: 'legend',
    desc: '用于五星英雄觉醒；玉里藏着暖光，揣在怀中总让猫以为到了晒太阳的时辰。',
  },
  {
    id: 'awaken_dew', name: '月华喵露', kind: 'material', quality: 'epic',
    desc: '用于五星英雄觉醒；水镜喵收来的一瓶月光，喝之前记得先听他说三个好。',
  },
  {
    id: 'claw_scroll_small', name: '初学爪印卷', kind: 'material', quality: 'fine',
    desc: '用于英雄初阶技能升级；第一课是收好爪尖，免得翻完只剩卷轴两头。',
  },
  {
    id: 'claw_scroll_medium', name: '精研爪印卷', kind: 'material', quality: 'rare',
    desc: '用于英雄中阶技能升级；军师在页边画了落爪的位置，猫猫又补了一枚肉垫印。',
  },
  {
    id: 'claw_scroll_large', name: '名将爪印卷', kind: 'material', quality: 'epic',
    desc: '用于英雄高阶技能升级；名将心得写得很厚，关于午睡的附录尤其厚。',
  },
  {
    id: 'bell_thread', name: '金铃纺线', kind: 'material', quality: 'fine',
    desc: '用于装备强化；把甲边和铃扣缝牢，行军就少丢一份清脆。',
  },
  {
    id: 'yarn_small', name: '小毛线球', kind: 'consumable', quality: 'fine',
    desc: '立即领取当前关卡 1 小时的小鱼干与经验挂机收益；追着滚一圈，仿佛多睡了一觉。',
  },
  {
    id: 'yarn_medium', name: '中毛线球', kind: 'consumable', quality: 'rare',
    desc: '立即领取当前关卡 2 小时的小鱼干与经验挂机收益；将军宣布加速，尾巴宣布打结。',
  },
  {
    id: 'yarn_large', name: '大毛线球', kind: 'consumable', quality: 'epic',
    desc: '立即领取当前关卡 4 小时的小鱼干与经验挂机收益；军师刚松开线头，半营猫都醒了。',
  },
  {
    id: 'recruit_ticket', name: '招福符', kind: 'ticket', quality: 'rare',
    desc: '用于普通招募一次；请把鱼香的一面朝外，来客才肯把爪子伸进门。',
  },
  ...FACTION_ORDER.map((faction): ItemDef => ({
    id: `recruit_${faction}`,
    name: `${FACTIONS[faction].name}阵营招福符`,
    kind: 'ticket',
    quality: 'epic',
    desc: `用于${FACTIONS[faction].full}阵营招募一次；旗上写着诚邀，门口的小鱼干摆得更诚恳。`,
  })),
  {
    id: 'equip_chest_rare', name: '行军鱼骨装备箱', kind: 'chest', quality: 'rare', stack: 999,
    desc: '开启随机获得 1 件稀有品质装备，来自四个部位之一；装备领走，箱子留给值夜的猫。',
  },
  {
    id: 'equip_chest_epic', name: '锦帐肉垫装备箱', kind: 'chest', quality: 'epic', stack: 999,
    desc: '开启随机获得 1 件史诗品质装备，来自四个部位之一；锦缎包得严实，先解开那条尾巴。',
  },
  {
    id: 'equip_chest_legend', name: '九命金铃装备箱', kind: 'chest', quality: 'legend', stack: 999,
    desc: '开启随机获得 1 件传说品质套装装备；箱锁响得很威风，箱内的软垫更得猫心。',
  },
  {
    id: 'shard_chest_sr', name: '银纹英雄碎片箱', kind: 'chest', quality: 'rare', stack: 999,
    desc: '开启随机获得同一位银蓝边框英雄的 10 枚专属碎片；还没见面，来信已按了爪印。',
  },
  {
    id: 'shard_chest_ssr', name: '紫绶英雄碎片箱', kind: 'chest', quality: 'epic', stack: 999,
    desc: '开启随机获得同一位紫边框英雄的 10 枚专属碎片；名将的来信，也会沾一点猫薄荷。',
  },
  {
    id: 'shard_chest_ur', name: '金冠英雄碎片箱', kind: 'chest', quality: 'legend', stack: 999,
    desc: '开启随机获得同一位金边框英雄的 10 枚专属碎片；封口很郑重，拆口处却留了牙印。',
  },
  {
    id: 'hero_shard_sr', name: '银纹通用碎片', kind: 'shard', quality: 'rare',
    desc: '可在银蓝边框英雄升星时抵扣 1 枚专属碎片；小小一枚，也能替老朋友多铺一角软垫。',
  },
  {
    id: 'hero_shard_ssr', name: '紫绶通用碎片', kind: 'shard', quality: 'epic',
    desc: '可在紫边框英雄升星时抵扣 1 枚专属碎片；绶带宽了一点，将军坐下仍会先压平。',
  },
  {
    id: 'hero_shard_ur', name: '金冠通用碎片', kind: 'shard', quality: 'legend',
    desc: '可在金边框英雄升星时抵扣 1 枚专属碎片；冠上添一分光彩，午睡仍要找一块日光。',
  },
  {
    id: 'fish_pouch_small', name: '小鱼干行军包', kind: 'consumable', quality: 'common',
    desc: '打开获得 1000 条小鱼干；军需官缝了双层袋，仍挡不住猫猫闻到香气。',
  },
  {
    id: 'fish_pouch_medium', name: '小鱼干辎重包', kind: 'consumable', quality: 'fine',
    desc: '打开获得 5000 条小鱼干；辎重队走得很慢，因为沿途总有将军主动护送。',
  },
  {
    id: 'fish_pouch_large', name: '小鱼干丰仓包', kind: 'consumable', quality: 'rare',
    desc: '打开获得 20000 条小鱼干；满仓香气稳了军心，曹喵德连算盘都拨得轻快。',
  },
];
