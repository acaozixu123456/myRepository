// 见闻：路上遇见的动物、偶遇的人、藏起来的观景点、天上的小惊喜。
// 第一次遇见会在左上角出一张小卡片，记进手记的「见闻」页和日记；拍到了就用那张照片当图鉴的图。
// 还没遇见的在手记里只有一个问号和一句线索；有人告诉过你、或者在观景点望见过的，地图上会标出来。
import { VISTAS } from '../world/route.js';

export const FIND_KINDS = [
  { id: 'animal', name: '路上的动物', sub: '动物怕快的东西：散步慢慢走过去，它们就不会跑' },
  { id: 'folk', name: '偶遇的人', sub: '走到跟前打个招呼，他们知道不少地方' },
  { id: 'vista', name: '观景点', sub: '远处山头上飘着布条的杆子，走上去能望见一大片' },
  { id: 'sky', name: '天上的', sub: '要碰运气' },
];

export const FINDS = [
  { id: 'deer', g: '鹿', kind: 'animal', name: '小鹿', sub: '低头吃草，耳朵一直在动', hint: '清晨和黄昏，东坡花田、风车坡边上' },
  { id: 'stag', g: '角', kind: 'animal', name: '大角鹿', sub: '角像两棵小树', hint: '红叶谷里，清晨或者起雾的时候' },
  { id: 'fox', g: '狐', kind: 'animal', name: '狐狸', sub: '尾巴蓬蓬的，一溜烟就没了', hint: '天快黑以后，竹林和松林边上' },
  { id: 'snowfox', g: '雪', kind: 'animal', name: '雪狐', sub: '白得和雪一个颜色', hint: '雪原上，下雪的时候' },
  { id: 'birds', g: '雀', kind: 'animal', name: '山雀', sub: '一群在地上啄草籽，走近了呼啦一下全飞起来', hint: '白天的花田、出发的谷地和浅滩边' },
  { id: 'gull', g: '鸥', kind: 'animal', name: '海鸥', sub: '在浪头上面绕圈', hint: '西湾海边' },
  { id: 'lantern', g: '灯', kind: 'folk', name: '提灯的人', sub: '夜里提着灯站在路边，听虫子叫', hint: '夜里，山路的林荫小道那一段' },
  { id: 'painter', g: '画', kind: 'folk', name: '画画的人', sub: '画架支在溪边，画的是满山的红叶', hint: '上午，红叶谷的溪边小路旁' },
  { id: 'fisher', g: '钓', kind: 'folk', name: '钓鱼的老伯', sub: '坐在沙滩上，钓竿插在沙里', hint: '下午到黄昏，西湾沙滩上' },
  { id: 'hiker', g: '行', kind: 'folk', name: '背包客', sub: '背着很大的包，沿着溪边小路走', hint: '白天，浅滩往红叶谷的溪边小路上' },
  { id: 'keeper', g: '塔', kind: 'folk', name: '守灯人', sub: '天黑了就去点灯', hint: '傍晚以后，海角灯塔下面' },
  ...VISTAS.map(v => ({ id: v.id, g: '望', kind: 'vista', name: v.name, sub: v.sub, hint: v.hint })),
  { id: 'rainbow', g: '虹', kind: 'sky', name: '彩虹', sub: '雨刚停，背对着太阳', hint: '白天雨停了、太阳出来的时候，背对太阳看' },
  { id: 'meteor', g: '星', kind: 'sky', name: '流星', sub: '一眨眼就划过去了', hint: '晴天的夜里，抬头多看一会儿' },
];
export const findOf = id => FINDS.find(f => f.id === id);
