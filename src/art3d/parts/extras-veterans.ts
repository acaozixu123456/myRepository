// 武圣长须、独眼眼罩与红脸；只在头部插槽装配时创建几何。
import * as THREE from 'three';
import { detail, solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

const tint = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

function cord(points: THREE.Vector3[], color: string, radius: number, closed = false): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), 24, radius, 6, closed), toon(color), .004);
}

/** 三绺美髯从下颌接合，长而圆钝；深毛色沿用实际关云喵参考。 */
export function beardLong(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra-three-lock-long-beard';
  const dark = tint(c.fur, '#211c22', .42), sheen = tint(c.light, c.fur, .5);
  const root = solid(sphere(.18, 1, .12, .22, 16), toon(dark), .005);
  root.name = 'long-beard-muzzle-contact'; root.position.set(0, -.315, .55); g.add(root);
  const profile = [[.006, -.42], [.024, -.39], [.058, -.29], [.10, -.10], [.115, .13], [.085, .20], [.012, .22]];
  for (const side of [-1, 0, 1]) {
    const lock = solid(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 16), toon(side === 0 ? dark : tint(dark, c.fur, .35)), .008);
    lock.name = side === 0 ? 'long-beard-center-lock' : 'long-beard-side-lock';
    lock.scale.set(side === 0 ? 1 : .80, side === 0 ? 1 : .83, .37);
    lock.position.set(side * .105, side === 0 ? -.535 : -.498, .535);
    lock.rotation.z = -side * .10; g.add(lock);
    const line = cord([
      new THREE.Vector3(side * .105, -.355, .578),
      new THREE.Vector3(side * .112, -.49, .583),
      new THREE.Vector3(side * .085, side === 0 ? -.80 : -.72, .56),
    ], sheen, .007);
    line.name = 'long-beard-soft-hair-ridge'; g.add(line);
  }
  return g;
}

/** 眼罩盖住 -x 一眼；整圈绑带高于另一只眼核，斜接到罩沿。 */
export function eyepatch(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra-sewn-eyepatch';
  const leather = '#2a2230', edge = tint(leather, c.pal.sub, .28);
  const mask = solid(sphere(.19, 1, .169 / .19, .26, 20), toon(leather), .008);
  mask.name = 'eyepatch-covered-eye'; mask.position.set(-.27, .20, .695); g.add(mask);
  const rim = cord(Array.from({ length: 24 }, (_, i) => {
    const a = i * Math.PI * 2 / 24;
    return new THREE.Vector3(-.27 + Math.cos(a) * .174, .20 + Math.sin(a) * .154, .722);
  }), edge, .009, true);
  rim.name = 'eyepatch-sewn-rim'; g.add(rim);
  const band = cord(Array.from({ length: 24 }, (_, i) => {
    const a = i * Math.PI * 2 / 24;
    return new THREE.Vector3(Math.sin(a) * .680, .395, Math.cos(a) * .599);
  }), leather, .014, true);
  band.name = 'eyepatch-head-band'; g.add(band);
  for (const side of [-1, 1]) {
    const bandX = -.27 + side * .21;
    const bandZ = .599 * Math.sqrt(1 - (bandX / .680) ** 2);
    const join = cord([
      new THREE.Vector3(-.27 + side * .13, .31, .718),
      new THREE.Vector3(-.27 + side * .18, .37, .659),
      new THREE.Vector3(bandX, .395, bandZ),
    ], leather, .017);
    join.name = 'eyepatch-band-link'; g.add(join);
    const rivet = solid(sphere(.023, 1, 1, .4, 10), toon(c.pal.trim), .003);
    rivet.name = 'eyepatch-rounded-rivet'; rivet.position.set(-.27 + side * .13, .31, .735); g.add(rivet);
  }
  return g;
}

interface SkinFace {
  a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3;
  det: number; x0: number; x1: number; y0: number; y1: number;
}
// 只缓存纯数值参考面，不能共享待 disposeCat3D 释放的 GPU geometry。
const skinFaceCache = new Map<string, SkinFace[]>();
function skullFrontFaces(): SkinFace[] {
  const width = Math.max(8, Math.round(28 * detail.k)), height = Math.max(6, Math.round(width * .75));
  const key = width + ':' + height, prior = skinFaceCache.get(key); if (prior) return prior;
  const grid: THREE.Vector3[][] = [], f = Math.fround, radius = .62;
  // 与现有 skull sphere 的 Float32 顶点及后续 scale 相同；不生成新的球网格。
  for (let y = 0; y <= height; y++) {
    const row: THREE.Vector3[] = [], theta = y / height * Math.PI;
    for (let x = 0; x <= width; x++) {
      const phi = x / width * Math.PI * 2;
      row.push(new THREE.Vector3(f(f(-radius * Math.cos(phi) * Math.sin(theta)) * 1.16), f(radius * Math.cos(theta)) + .14, f(f(radius * Math.sin(phi) * Math.sin(theta)) * 1.02)));
    }
    grid.push(row);
  }
  const faces: SkinFace[] = [];
  const add = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const det = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (det <= 1e-12) return;
    faces.push({ a, b, c, det, x0: Math.min(a.x,b.x,c.x), x1: Math.max(a.x,b.x,c.x), y0: Math.min(a.y,b.y,c.y), y1: Math.max(a.y,b.y,c.y) });
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = grid[y][x+1], b = grid[y][x], c = grid[y+1][x], d = grid[y+1][x+1];
    if (y !== 0) add(a,b,d); if (y !== height-1) add(b,c,d);
  }
  skinFaceCache.set(key, faces); return faces;
}

function clipToSkinFace(input: THREE.Vector2[], face: SkinFace): THREE.Vector2[] {
  let poly = input;
  for (const [a,b] of [[face.a,face.b],[face.b,face.c],[face.c,face.a]]) {
    const next: THREE.Vector2[] = [];
    const distance = (p: THREE.Vector2) => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    for (let i=0; i<poly.length; i++) {
      const p=poly[i], q=poly[(i+1)%poly.length], dp=distance(p), dq=distance(q);
      if (dp>=0) next.push(p);
      if ((dp<0)!==(dq<0)) next.push(p.clone().lerp(q,dp/(dp-dq)));
    }
    poly=next; if(poly.length<3) return [];
  }
  return poly;
}

/** 红面薄色片连续绕过眼眶，给鼻口保留完整深毛色窗口。 */
function facePaint(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(.28, .025); shape.lineTo(.28, -.205);
  shape.quadraticCurveTo(.47, -.245, .55, -.08);
  shape.quadraticCurveTo(.63, .10, .50, .35);
  shape.quadraticCurveTo(.32, .585, 0, .575);
  shape.quadraticCurveTo(-.32, .585, -.50, .35);
  shape.quadraticCurveTo(-.63, .10, -.55, -.08);
  shape.quadraticCurveTo(-.47, -.245, -.28, -.205);
  shape.lineTo(-.28, .025); shape.closePath();
  const clear = (p: THREE.Vector2) => {
    for (const side of [-1, 1]) {
      const a = -side * .2, x = p.x - side * .27, y = p.y - .16;
      const u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
      if ((u / .225) ** 2 + (v / .210) ** 2 < 1) return false;
    }
    return (p.x / .275) ** 2 + ((p.y + .13) / .182) ** 2 >= 1;
  };
  const flat = new THREE.ShapeGeometry(shape, 12), pos = flat.getAttribute('position'), ix = flat.index!;
  const vertices: number[] = [], normals: number[] = [], indices: number[] = [], faces = skullFrontFaces();
  const emit = (a: THREE.Vector2, b: THREE.Vector2, d: THREE.Vector2) => {
    const ab = a.distanceTo(b), bd = b.distanceTo(d), da = d.distanceTo(a);
    if (Math.max(ab, bd, da) > .030) {
      if (ab >= bd && ab >= da) { const m = a.clone().lerp(b, .5); emit(a, m, d); emit(m, b, d); }
      else if (bd >= da) { const m = b.clone().lerp(d, .5); emit(a, b, m); emit(a, m, d); }
      else { const m = d.clone().lerp(a, .5); emit(a, b, m); emit(m, b, d); }
      return;
    }
    if (![a, b, d, a.clone().lerp(b, .5), b.clone().lerp(d, .5), d.clone().lerp(a, .5), a.clone().add(b).add(d).multiplyScalar(1 / 3)].every(clear)) return;
    const x0=Math.min(a.x,b.x,d.x), x1=Math.max(a.x,b.x,d.x), y0=Math.min(a.y,b.y,d.y), y1=Math.max(a.y,b.y,d.y);
    for(const face of faces) {
      if(x1<face.x0||x0>face.x1||y1<face.y0||y0>face.y1) continue;
      const poly=clipToSkinFace([a,b,d],face); if(poly.length<3) continue;
      const start=vertices.length/3;
      for(const p of poly) {
        const dx=p.x-face.a.x, dy=p.y-face.a.y;
        const u=(dx*(face.c.y-face.a.y)-dy*(face.c.x-face.a.x))/face.det;
        const v=((face.b.x-face.a.x)*dy-(face.b.y-face.a.y)*dx)/face.det;
        const z=face.a.z+u*(face.b.z-face.a.z)+v*(face.c.z-face.a.z);
        vertices.push(p.x,p.y,z+.001);
        const normal=new THREE.Vector3(p.x/(.62*1.16)**2,(p.y-.14)/(.62**2),z/(.62*1.02)**2).normalize();
        normals.push(normal.x,normal.y,normal.z);
      }
      for(let i=1;i<poly.length-1;i++) indices.push(start,start+i,start+i+1);
    }
  };
  for (let i = 0; i < ix.count; i += 3) {
    const xy = [0, 1, 2].map(k => new THREE.Vector2(pos.getX(ix.getX(i + k)), pos.getY(ix.getX(i + k))));
    emit(xy[0], xy[1], xy[2]);
  }
  flat.dispose();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geo.setIndex(indices); return geo;
}

export function redFace(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra-warm-red-face';
  const red = tint('#b34f4b', c.fur, .12);
  const paint = new THREE.Mesh(facePaint(), toon(red));
  paint.name = 'red-face-surface-paint'; g.add(paint);
  return g;
}
