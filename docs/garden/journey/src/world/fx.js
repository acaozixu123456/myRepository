// 画面实验开关（只在网址带 ?fx=… 时生效）：p 柔光和暗角
const s = new URLSearchParams(location.search).get('fx') || '';
export const FX = { p: s.includes('p') };
