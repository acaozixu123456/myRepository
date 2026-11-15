// 可设种子的随机数。游戏里用 Math.random；测试和数值模拟用固定种子，结果可以复现。
let gen = Math.random;
export const rnd = () => gen();
export function seedRng(seed) {
  let s = seed >>> 0 || 1;
  gen = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const unseedRng = () => { gen = Math.random; };
export const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
export const pick = arr => arr[Math.floor(rnd() * arr.length)];
