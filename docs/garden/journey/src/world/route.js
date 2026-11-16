// 路线：一条山路 + 一条小溪。路线上的位置用“路程 s（米）”表示。
import * as THREE from 'three';

// 一条折线化的样条，支持按路程取点和就近查询
export class Path {
  constructor(pts, step = 1) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
    const L = curve.getLength();
    const n = Math.ceil(L / step);
    this.x = new Float32Array(n + 1); this.z = new Float32Array(n + 1);
    this.tx = new Float32Array(n + 1); this.tz = new Float32Array(n + 1); this.s = new Float32Array(n + 1);
    const p = new THREE.Vector3();
    let acc = 0, px = 0, pz = 0;
    for (let i = 0; i <= n; i++) {
      curve.getPointAt(i / n, p);
      if (i) acc += Math.hypot(p.x - px, p.z - pz);
      this.x[i] = p.x; this.z[i] = p.z; this.s[i] = acc; px = p.x; pz = p.z;
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l;
    }
    this.n = n; this.length = acc;
    // 外框：离得太远的点直接不用找
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i <= n; i++) { x0 = Math.min(x0, this.x[i]); x1 = Math.max(x1, this.x[i]); z0 = Math.min(z0, this.z[i]); z1 = Math.max(z1, this.z[i]); }
    this.box = [x0, x1, z0, z1];
    // 空间网格加速最近点查询
    this.cell = 8; this.grid = new Map();
    for (let i = 0; i < n; i++) {
      const x0 = Math.min(this.x[i], this.x[i + 1]), x1 = Math.max(this.x[i], this.x[i + 1]);
      const z0 = Math.min(this.z[i], this.z[i + 1]), z1 = Math.max(this.z[i], this.z[i + 1]);
      for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
        for (let gz = Math.floor(z0 / this.cell); gz <= Math.floor(z1 / this.cell); gz++) {
          const k = gx * 73856093 ^ gz * 19349663;
          let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i);
        }
    }
  }
  // 按路程取位置和切线
  at(s, out = {}) {
    s = Math.min(Math.max(s, 0), this.length);
    let lo = 0, hi = this.n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    const t = (s - this.s[lo]) / Math.max(1e-6, this.s[hi] - this.s[lo]);
    out.x = this.x[lo] + (this.x[hi] - this.x[lo]) * t; out.z = this.z[lo] + (this.z[hi] - this.z[lo]) * t;
    let tx = this.tx[lo] + (this.tx[hi] - this.tx[lo]) * t, tz = this.tz[lo] + (this.tz[hi] - this.tz[lo]) * t;
    const l = Math.hypot(tx, tz) || 1; out.tx = tx / l; out.tz = tz / l;
    return out;
  }
  // 最近点：返回 {d: 带符号横向距离（右正）, s: 路程, dist: 距离}；超出搜索半径返回 dist=Infinity
  nearest(x, z, maxR = 40, out = {}) {
    const B = this.box;
    if (x < B[0] - maxR || x > B[1] + maxR || z < B[2] - maxR || z > B[3] + maxR) { out.dist = Infinity; out.d = Infinity; out.s = 0; return out; }
    let best = Infinity, bi = -1, bt = 0;
    const r = Math.ceil(maxR / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let ring = 0; ring <= r; ring++) {
      for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gz = cz - ring; gz <= cz + ring; gz++) {
        if (Math.max(Math.abs(gx - cx), Math.abs(gz - cz)) !== ring) continue;
        const a = this.grid.get(gx * 73856093 ^ gz * 19349663); if (!a) continue;
        for (const i of a) {
          const ax = this.x[i], az = this.z[i], bx = this.x[i + 1], bz = this.z[i + 1];
          const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
          let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t - x, qz = az + dz * t - z, d2 = qx * qx + qz * qz;
          if (d2 < best) { best = d2; bi = i; bt = t; }
        }
      }
      if (bi >= 0 && Math.sqrt(best) < (ring) * this.cell) break;
    }
    if (bi < 0 || best > maxR * maxR) { out.dist = Infinity; out.d = Infinity; out.s = 0; return out; }
    const s = this.s[bi] + (this.s[bi + 1] - this.s[bi]) * bt;
    const px = this.x[bi] + (this.x[bi + 1] - this.x[bi]) * bt, pz = this.z[bi] + (this.z[bi + 1] - this.z[bi]) * bt;
    const tx = this.tx[bi], tz = this.tz[bi];
    out.dist = Math.sqrt(best); out.s = s; out.d = (x - px) * -tz + (z - pz) * tx;
    return out;
  }
}

// ---- 第一段：暖光谷地 ----
// 骑行方向大致朝北（-Z），太阳在西北偏西、离地平线不高
export const ROAD = new Path([[0, 30], [0, 8], [2, -18], [-2, -42], [-6, -64], [-3, -88], [4, -110], [6, -132], [0, -154], [-8, -173], [-11, -193], [-5, -212], [3, -228], [9, -242], [12, -256]], 1);
// 溪水从西北山上的冰湖流出来：先是一段陡陡的山涧（雪原山口），到红叶谷变缓，再一路流过谷地
export const STREAM = new Path([[-431, -500], [-421, -478], [-404, -452], [-384, -428], [-364, -401], [-346, -378], [-330, -360], [-250, -300], [-180, -240], [-135, -180], [-95, -130], [-50, -102], [-3, -88], [38, -80], [80, -60], [125, -46], [190, -16], [280, 20]], 1.5);
// 冰湖：一个椭圆，长轴方向 (ax, az)；y（冰面高度）在 land.js 里按溪水源头算出来
export const LAKE = { x: -446, z: -524, a: 40, b: 27, ax: 0.816, az: -0.577, y: 0 };
// 山涧的起点（以前溪水的源头），往上就是山涧
export const CREEK_END = STREAM.nearest(-330, -360, 5).s;
// 溪边小路：从浅滩的西岸沿着小溪往上游，过红叶谷、顺着山涧爬上去，到冰湖边（走在溪的西南岸）
export const TRAIL = (() => {
  const s1 = STREAM.nearest(-96, -131, 40).s - 4, pts = [], p = {};
  for (let s = 9; s < s1; s += 6) {
    STREAM.at(s, p);
    const off = (s < CREEK_END - 10 ? 7.5 : 9.5) + 1.6 * Math.sin(s * 0.031) - 3.5 * Math.max(0, 1 - (s1 - s) / 30);
    pts.push([p.x - p.tz * off, p.z + p.tx * off]);
  }
  STREAM.at(s1 + 3, p); pts.push([p.x - p.tz * 5.5, p.z + p.tx * 5.5]);
  // 拐弯处顺一顺
  for (let it = 0; it < 3; it++) for (let i = 1; i < pts.length - 1; i++) pts[i] = [(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4];
  return new Path(pts, 1);
})();

// 西边的小路：出发的地方往左手边（西边）拐，翻过西岭中间的竹林山坳，一路下到西南的海湾沙滩
export const SEAWAY = new Path([[-2, 5], [-30, 7], [-62, 3], [-95, -5], [-128, -13], [-160, -16], [-192, -12], [-222, -18], [-252, -30], [-284, -42], [-318, -50], [-350, -56], [-378, -60], [-398, -63]], 1);
// 海湾：海在西南边。海岸是一条朝海那边张开的抛物线（中间是沙滩海湾，两边的岬角是海崖），远处一直到天边都是海。
// c = 往海那边离海岸多远（米，岸上为负）；t = 沿着海岸的位置（北边为负）
export const SEA = { y: -1.2, x: -430, z: -60, nx: -0.94, nz: 0.342, R: 500 };
export function coastCT(x, z) {
  const dx = x - SEA.x, dz = z - SEA.z, t = dx * SEA.nz - dz * SEA.nx;
  return [dx * SEA.nx + dz * SEA.nz - t * t / (2 * SEA.R), t];
}
// 海角上的小路：从快下到沙滩的那段坡上岔出去，顺着崖顶往北走到灯塔
export const CAPEWAY = new Path([[-300, -45], [-318, -66], [-340, -90], [-366, -113], [-394, -134], [-420, -152], [-440, -164], [-449, -168]], 1);
export const LIGHTHOUSE = { x: -455, z: -172 };
// 海湾南边海里的几根礁石柱子：[x, z, 半径, 露出水面多高]
export const STACKS = [[-448, 48, 7, 17], [-428, 72, 5, 11], [-476, 31, 4, 8]];

// 路上的地点（用路程 s 表示），加载后算出来
export const SPOTS = {};
{
  const near = (x, z) => ROAD.nearest(x, z, 60).s;
  SPOTS.start = near(0, 8);
  // 找出路和溪的交点
  let best = 1e9, bs = 0;
  for (let s = 0; s < ROAD.length; s += 0.5) { const p = ROAD.at(s); const q = STREAM.nearest(p.x, p.z, 30); if (q.dist < best) { best = q.dist; bs = s; } }
  SPOTS.bridge = bs;
  SPOTS.grove = [near(4, -118), near(-2, -160)];
  SPOTS.view = near(-11, -193);
  SPOTS.camp = near(8, -238);
  SPOTS.end = Math.min(ROAD.length - 6, SPOTS.camp + 4);
}

// 野外的营地（山口营地以外的几处）：篝火的位置 (x, z)，f 是坐着的人看出去的方向（隔着火看溪、湖或花田）。
// ts：贴着溪边小路的营地，地面压平到小路那一段的高度；没有 ts 的按那里原来的地面压平。
// 位置是按地形挑的比较平、离水不太近的地方（见 land.js flats、flora.js 清空地、props.js 摆东西）。
export const CAMP_SITES = [];
{
  const p = {}, q = {};
  const face = (c, tx, tz) => { const dx = tx - c.x, dz = tz - c.z, l = Math.hypot(dx, dz) || 1; c.fx = dx / l; c.fz = dz / l; return c; };
  // 溪边小路上，离溪水某一段最近的地方，往山坡那边（离开溪水）再挪 off 米
  const byTrail = (ss, off) => {
    STREAM.at(ss, q); const t = TRAIL.nearest(q.x, q.z, 40); TRAIL.at(t.s, p);
    const c = { x: p.x - p.tz * off, z: p.z + p.tx * off, ts: t.s };
    return face(c, q.x, q.z);
  };
  CAMP_SITES.push(
    { id: 'campShoal', name: '溪边营地', sub: '水声就在旁边，适合打个盹', where: '浅滩靠木桥这一边的岸上', ...face({ x: -91, z: -143 }, -101, -137) },
    { id: 'campMeadow', name: '花田营地', sub: '躺在花里看云', where: '东坡花田靠溪的那一头', ...face({ x: 47, z: -35 }, 75, -25) },
    { id: 'campAutumn', name: '红叶营地', sub: '红叶落在火堆边上', where: '红叶谷里，溪边小路旁的坡上', ...byTrail(CREEK_END + 90, 7.5) },
    { id: 'campLake', name: '冰湖营地', sub: '湖边很静，夜里星星特别多', where: '冰湖的出水口旁边', ...face(byTrail(9, 13), LAKE.x, LAKE.z) },
  );
  // 竹林里海边小路旁的一块空地；沙滩上面朝大海
  SEAWAY.at(190, p);
  CAMP_SITES.push(
    { id: 'campBamboo', name: '竹林营地', sub: '竹叶沙沙的，火光一晃一晃', where: '竹林山坳里，海边小路旁边', way: true, ...face({ x: p.x + p.tz * 9, z: p.z - p.tx * 9 }, p.x, p.z) },
    { id: 'campBeach', name: '海边营地', sub: '听着浪声，看太阳掉进海里', where: '西湾沙滩上，靠竹林那一头', way: 'beach', ...face({ x: -405, z: -42.5 }, -405 - 0.94 * 20, -42.5 + 0.342 * 20) },
  );
}

// 藏起来的观景点：路上看不到牌子，只有远处山头上一根飘着布条的杆子和一堆叠起来的石头。
// 走上去能望见一大片（地图上亮出一大块，附近藏着的东西也会标出来）。f 是站在石堆边往外看的方向（度，0 = +Z）。
export const VISTAS = [
  { id: 'vEast', name: '东岭石堆', sub: '整个谷地摊在脚下，太阳从对面的山口落下去', hint: '东边山坡最高的地方，远远能看见一根飘着布条的杆子', x: 150, z: -168, f: -95 },
  { id: 'vWest', name: '西岭高台', sub: '一边是溪谷，一边能望见海', hint: '溪和海边小路中间那道山梁上', x: -250, z: -118, f: -60 },
  { id: 'vCove', name: '望海坡', sub: '海湾、礁石和灯塔，一眼都看得见', hint: '西湾沙滩南边的山坡顶上', x: -370, z: 6, f: -125 },
  { id: 'vSnow', name: '雪脊', sub: '冰湖就在脚下，来时的路弯弯地伸到很远', hint: '冰湖东边的雪山梁上', x: -354, z: -502, f: 40 },
];
