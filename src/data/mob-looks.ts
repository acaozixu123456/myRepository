import type { CatLook, Palette } from '../art/types';

// 杂兵制服用布边、旧银与素骨色；不沿用英雄的亮金镶边。
const UNIFORM: Record<string, Palette> = {
  wei: { main: '#506b94', sub: '#34465f', trim: '#aab7c4', cloth: '#cdd9e5' },
  shu: { main: '#5f9068', sub: '#496149', trim: '#bb998a', cloth: '#ede9d8' },
  wu: { main: '#b9594d', sub: '#76413c', trim: '#b39c79', cloth: '#ecd7ca' },
  qun: { main: '#80618e', sub: '#615049', trim: '#aaa09a', cloth: '#ded4df' },
  man: { main: '#c18346', sub: '#755b42', trim: '#d8cfb9', cloth: '#d7c6a6' },
  xian: { main: '#619f9a', sub: '#486c70', trim: '#bdccc4', cloth: '#e4eeea' },
};

/** 每只杂兵手写毛色、五官、体型和装束；缺款式的替代明细见 docs/MOBS.md。 */
export const MOB_LOOKS: Record<string, CatLook> = {
  // 魏：蓝甲与旧银布边，连巡夜用的颈巾也有军需处的蓝。
  mob_wei_guard: {
    coat: { pattern: 'solid', base: '#8295ae', light: '#dce4ed' },
    eye: { color: '#bd925a', style: 'round' }, ear: 'round', tail: 'stub',
    build: 1.08, head: 1.03, blush: true,
    outfit: { pal: { ...UNIFORM.wei, main: '#4c6284', cloth: '#c7d3e0' }, head: 'helmetWei', body: 'armorWei', back: 'none', weapon: 'none', extra: [] },
  },
  mob_wei_vanguard: {
    coat: { pattern: 'tabby', base: '#96928b', light: '#e2dcd0', stripe: '#5c6068' },
    eye: { color: '#ad985b', style: 'keen' }, ear: 'pointy', tail: 'long',
    build: 0.98, head: 0.97,
    outfit: { pal: { ...UNIFORM.wei, sub: '#303d4d' }, head: 'helmetWei', body: 'armorLight', back: 'none', weapon: 'sword', extra: [] },
  },
  mob_wei_archer: {
    coat: { pattern: 'shaded', base: '#bac2ca', light: '#f1eee5', accent: '#8493a5' },
    eye: { color: '#699baa', style: 'sharp' }, ear: 'pointy', tail: 'curl',
    build: 0.9, head: 0.98, blush: true,
    outfit: { pal: { ...UNIFORM.wei, main: '#526a91', cloth: '#55708f' }, head: 'scholarCap', body: 'vest', back: 'none', weapon: 'bow', extra: [] },
  },
  mob_wei_strategist: {
    coat: { pattern: 'tuxedo', base: '#839ab2', light: '#f4eee3' },
    eye: { color: '#8d9270', style: 'calm' }, ear: 'big', tail: 'long',
    build: 0.94, head: 1,
    outfit: { pal: { ...UNIFORM.wei, main: '#9faebc', sub: '#455d7b', cloth: '#536c8c' }, head: 'scholarCap', body: 'robeScholar', back: 'none', weapon: 'scroll', extra: [] },
  },
  mob_wei_healer: {
    coat: { pattern: 'solid', base: '#f1eee7', light: '#fff8ed' },
    eye: { color: '#6e9cbb', style: 'sleepy' }, ear: 'fold', tail: 'bushy',
    build: 0.96, head: 1.01, fluffy: true, blush: true,
    outfit: { pal: { ...UNIFORM.wei, cloth: '#c8dce6' }, head: 'sailorBandana', body: 'robeScholar', back: 'gourd', weapon: 'herbs', extra: [] },
  },
  mob_wei_assassin: {
    coat: { pattern: 'shaded', base: '#78818d', light: '#c6ced3', accent: '#525e70' },
    eye: { color: '#87a27c', style: 'cool' }, ear: 'pointy', tail: 'long',
    build: 0.89, head: 0.96,
    outfit: { pal: { ...UNIFORM.wei, main: '#3c5069', sub: '#303d4e', trim: '#929ea9' }, head: 'none', body: 'vest', back: 'none', weapon: 'sword', extra: ['scarf'] },
  },

  // 蜀：绿布、米白里衬和温红缝边；草编甲仍保留猫窝的本色。
  mob_shu_guard: {
    coat: { pattern: 'tuxedo', base: '#d79557', light: '#f5ead9' },
    eye: { color: '#7e956a', style: 'round' }, ear: 'big', tail: 'curl',
    build: 1.08, head: 1.02, blush: true,
    outfit: { pal: { ...UNIFORM.shu, main: '#608b61' }, head: 'sailorBandana', body: 'rattan', back: 'none', weapon: 'none', extra: ['scarf'] },
  },
  mob_shu_vanguard: {
    coat: { pattern: 'tabby', base: '#a78a65', light: '#e4d5b8', stripe: '#665647' },
    eye: { color: '#ac965f', style: 'fierce' }, ear: 'pointy', tail: 'ring',
    build: 1.02, head: 0.98,
    outfit: { pal: { ...UNIFORM.shu, trim: '#bb8a80' }, head: 'helmetWei', body: 'armorLight', back: 'none', weapon: 'glaive', extra: ['tassel'] },
  },
  mob_shu_archer: {
    coat: { pattern: 'calico', base: '#d98f56', light: '#f4eadb', accent: '#54463e' },
    eye: { color: '#859f6f', style: 'keen' }, ear: 'round', tail: 'curl',
    build: 0.89, head: 1.02, blush: true,
    outfit: { pal: { ...UNIFORM.shu, main: '#679669', cloth: '#9bae8b' }, head: 'scholarCap', body: 'vest', back: 'none', weapon: 'bow', extra: [] },
  },
  mob_shu_strategist: {
    coat: { pattern: 'tabby', base: '#deca9e', light: '#f5ecda', stripe: '#aa916d' },
    eye: { color: '#709daf', style: 'calm' }, ear: 'pointy', tail: 'bushy',
    build: 0.91, head: 1,
    outfit: { pal: { ...UNIFORM.shu, cloth: '#eee9d7' }, head: 'taoistCrown', body: 'robeScholar', back: 'scrollBack', weapon: 'fan', extra: [] },
  },
  mob_shu_healer: {
    coat: { pattern: 'cow', base: '#cf985f', light: '#f3eee2', accent: '#cf985f' },
    eye: { color: '#93a473', style: 'happy' }, ear: 'fold', tail: 'long',
    build: 1, head: 1.03, blush: true,
    outfit: { pal: { ...UNIFORM.shu, cloth: '#dce5ce' }, head: 'sailorBandana', body: 'robeScholar', back: 'none', weapon: 'herbs', extra: [] },
  },
  mob_shu_assassin: {
    coat: { pattern: 'tabby', base: '#7c6655', light: '#c9bda8', stripe: '#4b443e' },
    eye: { color: '#83a082', style: 'keen' }, ear: 'pointy', tail: 'long',
    build: 0.88, head: 0.98,
    outfit: { pal: { ...UNIFORM.shu, main: '#64846a', sub: '#626e65', trim: '#aaa891' }, head: 'none', body: 'vest', back: 'none', weapon: 'sword', extra: ['scarf'] },
  },

  // 吴：赤布配磨旧的铜褐边；不用英雄的亮金冠和飘带。
  mob_wu_guard: {
    coat: { pattern: 'cow', base: '#969ca3', light: '#eeece5', accent: '#969ca3' },
    eye: { color: '#a69a76', style: 'wide' }, ear: 'round', tail: 'stub',
    build: 1.07, head: 1.04, blush: true,
    outfit: { pal: { ...UNIFORM.wu, main: '#ba5c50' }, head: 'sailorBandana', body: 'armorLight', back: 'none', weapon: 'none', extra: [] },
  },
  mob_wu_vanguard: {
    coat: { pattern: 'spots', base: '#bc965f', light: '#ecd8b8', accent: '#765337' },
    eye: { color: '#8da66b', style: 'fierce' }, ear: 'pointy', tail: 'stub',
    build: 0.99, head: 0.97,
    outfit: { pal: { ...UNIFORM.wu, main: '#b15347' }, head: 'helmetWei', body: 'armorLight', back: 'none', weapon: 'sword', extra: [] },
  },
  mob_wu_archer: {
    coat: { pattern: 'solid', base: '#e7ceb2', light: '#f7ecdb' },
    eye: { color: '#a58ba9', style: 'keen' }, ear: 'round', tail: 'curl',
    build: 0.89, head: 1.01, blush: true,
    outfit: { pal: { ...UNIFORM.wu, main: '#bf6658', sub: '#875149' }, head: 'sailorBandana', body: 'armorLight', back: 'none', weapon: 'bow', extra: [] },
  },
  mob_wu_strategist: {
    coat: { pattern: 'point', base: '#e9dcc6', light: '#f1e5cf', accent: '#705745' },
    eye: { color: '#6a9cb8', style: 'calm' }, ear: 'pointy', tail: 'long',
    build: 0.92, head: 0.98,
    outfit: { pal: { ...UNIFORM.wu, cloth: '#d9a897', trim: '#b6a084' }, head: 'taoistCrown', body: 'robeScholar', back: 'none', weapon: 'fan', extra: [] },
  },
  mob_wu_healer: {
    coat: { pattern: 'shaded', base: '#dcc79b', light: '#f6ead3', accent: '#b8a37d' },
    eye: { color: '#85a995', style: 'calm' }, ear: 'round', tail: 'long',
    build: 0.97, head: 1.01, blush: true,
    outfit: { pal: { ...UNIFORM.wu, cloth: '#eed5cc', trim: '#9bac8e' }, head: 'lotusCrown', body: 'robeScholar', back: 'none', weapon: 'herbs', extra: [] },
  },
  mob_wu_assassin: {
    coat: { pattern: 'spots', base: '#8f7256', light: '#d5c3a9', accent: '#50433a' },
    eye: { color: '#a4a779', style: 'sharp' }, ear: 'pointy', tail: 'ring',
    build: 0.9, head: 0.96,
    outfit: { pal: { ...UNIFORM.wu, main: '#7d514a', sub: '#5f403c', trim: '#a59785' }, head: 'none', body: 'vest', back: 'none', weapon: 'sword', extra: ['scarf'] },
  },

  // 群：紫褐衣料与灰布扣，行囊旧一些，爪子仍擦得很干净。
  mob_qun_guard: {
    coat: { pattern: 'solid', base: '#9c7a60', light: '#dac4a5' },
    eye: { color: '#af9b6d', style: 'cool' }, ear: 'round', tail: 'stub',
    build: 1.12, head: 1.03, blush: true,
    outfit: { pal: { ...UNIFORM.qun, main: '#766283', sub: '#615766' }, head: 'helmetWei', body: 'armorWei', back: 'none', weapon: 'none', extra: [] },
  },
  mob_qun_vanguard: {
    coat: { pattern: 'cow', base: '#51494c', light: '#ece7db', accent: '#51494c' },
    eye: { color: '#a59869', style: 'round' }, ear: 'big', tail: 'bushy',
    build: 1.04, head: 1.01, blush: true,
    outfit: { pal: { ...UNIFORM.qun, main: '#846995', sub: '#645b55' }, head: 'sailorBandana', body: 'armorLight', back: 'none', weapon: 'glaive', extra: [] },
  },
  mob_qun_archer: {
    coat: { pattern: 'calico', base: '#ac8054', light: '#b39371', accent: '#50443f' },
    eye: { color: '#92a182', style: 'sharp' }, ear: 'tuft', tail: 'ring',
    build: 0.9, head: 0.97,
    outfit: { pal: { ...UNIFORM.qun, main: '#80638c', cloth: '#9e88a6' }, head: 'scholarCap', body: 'vest', back: 'none', weapon: 'bow', extra: [] },
  },
  mob_qun_strategist: {
    coat: { pattern: 'solid', base: '#484149', light: '#776b75' },
    eye: { color: '#b8a06f', style: 'wink' }, ear: 'pointy', tail: 'curl',
    build: 0.93, head: 0.98,
    outfit: { pal: { ...UNIFORM.qun, cloth: '#b6a8ba' }, head: 'scholarCap', body: 'robeScholar', back: 'none', weapon: 'scroll', extra: ['tassel'] },
  },
  mob_qun_healer: {
    coat: { pattern: 'shaded', base: '#b6b7b4', light: '#eeeae0', accent: '#8a9298' },
    eye: { color: '#8dafa2', style: 'calm' }, ear: 'fold', tail: 'long',
    build: 1.01, head: 1.02, blush: true,
    outfit: { pal: { ...UNIFORM.qun, main: '#927aa0', cloth: '#eee8d9' }, head: 'sailorBandana', body: 'robeScholar', back: 'none', weapon: 'herbs', extra: [] },
  },
  mob_qun_assassin: {
    coat: { pattern: 'tuxedo', base: '#464049', light: '#ebe7de' },
    eye: { color: '#90a5a2', style: 'keen' }, ear: 'pointy', tail: 'long',
    build: 0.88, head: 0.97,
    outfit: { pal: { ...UNIFORM.qun, main: '#67536e', sub: '#514552', trim: '#9f929c' }, head: 'none', body: 'vest', back: 'none', weapon: 'sword', extra: ['tassel'] },
  },

  // 蛮：橙带、兽皮与素骨；藤甲、羽冠和草药各有自己的山林差事。
  mob_man_guard: {
    coat: { pattern: 'solid', base: '#aa7e58', light: '#dac2a1' },
    eye: { color: '#948264', style: 'sleepy' }, ear: 'round', tail: 'stub',
    build: 1.08, head: 1.07, fluffy: true, blush: true,
    outfit: { pal: { ...UNIFORM.man, trim: '#c18346' }, head: 'rattanHelm', body: 'rattan', back: 'none', weapon: 'none', extra: [] },
  },
  mob_man_vanguard: {
    coat: { pattern: 'spots', base: '#b99860', light: '#ead7b5', accent: '#765637' },
    eye: { color: '#a5966a', style: 'fierce' }, ear: 'round', tail: 'ring',
    build: 1.03, head: 0.98,
    outfit: { pal: { ...UNIFORM.man, main: '#be8046' }, head: 'none', body: 'tribal', back: 'none', weapon: 'mace', extra: [] },
  },
  mob_man_archer: {
    coat: { pattern: 'spots', base: '#c2a66f', light: '#eee0bd', accent: '#8b714c' },
    eye: { color: '#8eaa7d', style: 'happy' }, ear: 'pointy', tail: 'curl',
    build: 0.89, head: 1.02, blush: true,
    outfit: { pal: { ...UNIFORM.man, main: '#bd8a50', cloth: '#8e9a6b' }, head: 'scholarCap', body: 'vest', back: 'none', weapon: 'bow', extra: [] },
  },
  mob_man_strategist: {
    coat: { pattern: 'shaded', base: '#969183', light: '#d8d3bf', accent: '#6c7774' },
    eye: { color: '#7faca5', style: 'wide' }, ear: 'tuft', tail: 'bushy',
    build: 0.98, head: 0.97, fluffy: true,
    outfit: { pal: { ...UNIFORM.man, main: '#b58a54', sub: '#70867d' }, head: 'featherHeaddress', body: 'tribal', back: 'none', weapon: 'drum', extra: [] },
  },
  mob_man_healer: {
    coat: { pattern: 'solid', base: '#c2a07e', light: '#ebdbc2' },
    eye: { color: '#899f7d', style: 'calm' }, ear: 'tuft', tail: 'bushy',
    build: 1.01, head: 1.02, fluffy: true, blush: true,
    outfit: { pal: { ...UNIFORM.man, cloth: '#dfd0b0' }, head: 'sailorBandana', body: 'robeScholar', back: 'gourd', weapon: 'herbs', extra: [] },
  },
  mob_man_assassin: {
    coat: { pattern: 'solid', base: '#ad7752', light: '#d9bd96' },
    eye: { color: '#af976e', style: 'keen' }, ear: 'tuft', tail: 'stub',
    build: 0.89, head: 0.96,
    outfit: { pal: { ...UNIFORM.man, main: '#b07e49', sub: '#765a46' }, head: 'none', body: 'armorLight', back: 'none', weapon: 'sword', extra: [] },
  },

  // 仙：青白棉袍与灰玉布扣，值门和拾铃的小猫不带仙光。
  mob_xian_guard: {
    coat: { pattern: 'solid', base: '#eeeae1', light: '#faf5e9' },
    eye: { color: '#8ca8b3', style: 'round' }, ear: 'round', tail: 'bushy',
    build: 1.08, head: 1.04, fluffy: true, blush: true,
    outfit: { pal: { ...UNIFORM.xian, cloth: '#b9ceca', trim: '#92b5ab' }, head: 'lotusCrown', body: 'robeTaoist', back: 'none', weapon: 'none', extra: [] },
  },
  mob_xian_vanguard: {
    coat: { pattern: 'shaded', base: '#ccd3d1', light: '#f4f1e8', accent: '#a2b6bc' },
    eye: { color: '#97a77e', style: 'keen' }, ear: 'pointy', tail: 'long',
    build: 0.94, head: 0.98, fluffy: true,
    outfit: { pal: { ...UNIFORM.xian, cloth: '#dcebe5' }, head: 'taoistCrown', body: 'robeScholar', back: 'none', weapon: 'sword', extra: [] },
  },
  mob_xian_archer: {
    coat: { pattern: 'solid', base: '#48454c', light: '#817780' },
    eye: { color: '#a9ae88', style: 'wide' }, ear: 'pointy', tail: 'curl',
    build: 0.9, head: 0.99,
    outfit: { pal: { ...UNIFORM.xian, main: '#638a88', sub: '#5b6e73', trim: '#a9b4a4' }, head: 'fortuneHat', body: 'vest', back: 'none', weapon: 'none', extra: [] },
  },
  mob_xian_strategist: {
    coat: { pattern: 'tuxedo', base: '#4d4951', light: '#ede8dc' },
    eye: { color: '#a8a375', style: 'calm' }, ear: 'big', tail: 'long',
    build: 0.94, head: 1.02, blush: true,
    outfit: { pal: { ...UNIFORM.xian, cloth: '#93bcb4' }, head: 'yellowBand', body: 'robeTaoist', back: 'none', weapon: 'scroll', extra: [] },
  },
  mob_xian_healer: {
    coat: { pattern: 'shaded', base: '#9faebd', light: '#dde5e6', accent: '#7a93a5' },
    eye: { color: '#b69c7f', style: 'happy' }, ear: 'fold', tail: 'long',
    build: 1.01, head: 1.03, blush: true,
    outfit: { pal: { ...UNIFORM.xian, cloth: '#d7e8e1', trim: '#a0beb4' }, head: 'taoistCrown', body: 'robeScholar', back: 'none', weapon: 'herbs', extra: [] },
  },
  mob_xian_assassin: {
    coat: { pattern: 'solid', base: '#e9ece5', light: '#f9f6ed' },
    eye: { color: '#9c9db3', style: 'cool' }, ear: 'pointy', tail: 'bushy',
    build: 0.89, head: 0.98, fluffy: true, blush: true,
    outfit: { pal: { ...UNIFORM.xian, main: '#83aaa5', sub: '#698b89', cloth: '#d7e8e4', trim: '#b8c6bc' }, head: 'none', body: 'robeScholar', back: 'none', weapon: 'sword', extra: ['bell'] },
  },
};
