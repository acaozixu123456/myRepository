// 画面实验开关（只在网址带 ?fx=… 时生效，不带就是线上原样）：p 后期柔光  c 角色打光  l 冷色阴影  g 地面和草
const s = new URLSearchParams(location.search).get('fx') || '';
export const FX = { p: s.includes('p'), c: s.includes('c'), l: s.includes('l'), g: s.includes('g') };
