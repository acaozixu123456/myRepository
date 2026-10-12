// 层叠披挂：只在装配时生成，根变换与 back 插槽保持一致。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

type ClothPoint = (t: number, u: number) => THREE.Vector3;

/** 有厚度的布片；前后两层与四边封口，避免单面板的硬黑边。 */
function cloth(point: ClothPoint, rows = 16, cols = 6, thick = .018): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const p = point(r / rows, c / cols);
      vertices.push(p.x, p.y, p.z + side * thick / 2);
    }
  }
  const stride = cols + 1, layer = stride * (rows + 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * stride + c, b = a + 1, d = a + stride, e = d + 1;
    indices.push(a, b, d, b, e, d, a + layer, d + layer, b + layer, b + layer, d + layer, e + layer);
  }
  const edge = (a: number, b: number) => {
    // 封口独立顶点保留薄布的转角；不将侧边法线平均到布面。
    const first = vertices.length / 3;
    for (const i of [a, b, a + layer, b + layer]) vertices.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
    indices.push(first + 1, first, first + 2, first + 1, first + 2, first + 3);
  };
  for (let c = 0; c < cols; c++) { edge(c, c + 1); edge(rows * stride + c + 1, rows * stride + c); }
  for (let r = 0; r < rows; r++) { edge((r + 1) * stride, r * stride); edge(r * stride + cols, (r + 1) * stride + cols); }
  // 左右镜像直接写入坐标后，保持封闭表面朝外的绕序。
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, d = indices[i + 2] * 3;
    volume += vertices[a] * (vertices[b + 1] * vertices[d + 2] - vertices[b + 2] * vertices[d + 1]) + vertices[a + 1] * (vertices[b + 2] * vertices[d] - vertices[b] * vertices[d + 2]) + vertices[a + 2] * (vertices[b] * vertices[d + 1] - vertices[b + 1] * vertices[d]);
  }
  if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function seam(points: THREE.Vector3[], color: string, radius = .018): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 6, false), toon(color), .006);
}

const sample = (point: ClothPoint, alongU: boolean, fixed: number) => Array.from({ length: 13 }, (_, i) => point(alongU ? fixed : i / 12, alongU ? i / 12 : fixed));

export function capeLong(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-long-folded-cape';
  for (const side of [-1, 1]) {
    // 下部中心逐渐打开：尾根不再被整块布板盖住。
    const panel: ClothPoint = (t, u) => {
      const opening = Math.max(0, Math.min(1, (t - .18) / .27));
      const notch = .02 + .24 * opening * opening * (3 - 2 * opening);
      const outer = .45 + .25 * Math.sin(t * Math.PI / 2);
      const x = side * (notch + (outer - notch) * u);
      const y = .12 - 1.25 * t + .08 * Math.sin(u * Math.PI) * t * t;
      const z = -.10 - .20 * t - .065 * Math.sin(u * Math.PI * 3) * Math.sin(t * Math.PI * .8);
      return new THREE.Vector3(x, y, z);
    };
    const m = solid(cloth(panel), toon(c.pal.sub), .014); m.name = 'cape-panel'; g.add(m);
    g.add(seam(sample(panel, true, 1), c.pal.trim, .022));
    g.add(seam(sample(panel, false, 1), c.pal.trim, .016));
    // 上层短披肩覆盖肩缝，圆弧和错层只由自身几何产生。
    const shoulder: ClothPoint = (t, u) => new THREE.Vector3(side * (.04 + .49 * u), .15 - .43 * t + .05 * Math.sin(u * Math.PI), -.12 - .025 * t - .04 * Math.sin(u * Math.PI));
    const flap = solid(cloth(shoulder, 8, 6), toon(c.pal.main), .012); flap.name = 'cape-shoulder-fold'; g.add(flap);
    g.add(seam(sample(shoulder, true, 1), c.pal.trim, .016));
    const clasp = solid(sphere(.045, 1, 1, .55, 12), toon(c.pal.trim), .005); clasp.position.set(side * .32, .105, -.165); g.add(clasp);
  }
  return g;
}

export function ribbons(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-curved-double-ribbons';
  for (const side of [-1, 1]) {
    const center = (t: number) => new THREE.Vector3(side * (.29 + .52 * Math.sin(t * Math.PI * .92) + .22 * t * t), .14 - 1.08 * t + .12 * Math.sin(t * Math.PI * 2), -.10 - .18 * Math.sin(t * Math.PI));
    const strip: ClothPoint = (t, u) => {
      const p = center(t), tangent = center(Math.min(1, t + .001)).sub(center(Math.max(0, t - .001))).normalize();
      const w = .13 + .06 * Math.sin(t * Math.PI);
      const cross = new THREE.Vector3(-tangent.y, tangent.x, .34 * Math.sin(t * Math.PI * 1.5)).normalize();
      return p.addScaledVector(cross, (u - .5) * w);
    };
    const fabric = solid(cloth(strip, 20, 2), toon(c.pal.sub), .009); fabric.name = 'curved-ribbon'; g.add(fabric);
    const lining: ClothPoint = (t, u) => { const p = strip(t, .19 + u * .62); p.z -= .016; return p; };
    const light = solid(cloth(lining, 20, 2, .005), toon(c.pal.cloth ?? c.pal.main), 0); light.name = 'ribbon-lining'; g.add(light);
    for (const edge of [0, 1]) g.add(seam(sample(strip, false, edge), c.pal.trim, .009));
    const pin = solid(sphere(.06, 1.3, .8, .5, 12), toon(c.pal.trim), .006); pin.position.copy(center(0)); g.add(pin);
  }
  return g;
}

function feather(length: number, width: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-width * .60, length * .28, -width * .53, length * .72, -width * .18, length * .94);
  s.quadraticCurveTo(0, length * 1.03, width * .18, length * .94);
  s.bezierCurveTo(width * .53, length * .72, width * .60, length * .28, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: .036, bevelEnabled: true, bevelThickness: .015, bevelSize: .017, bevelSegments: 2, steps: 1, curveSegments: 6 });
  geo.translate(0, 0, -.018); return geo;
}

export function wings(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-layered-phoenix-wings';
  // 小体型共用者的翼幅随体宽收敛；正常体型不改几何或挂接。
  const width = (c.look.build ?? 1) < .8 ? THREE.MathUtils.clamp(c.look.build ?? 1, .7, 1) : 1;
  const angles = [.70, .98, 1.25, 1.52, 1.82], lengths = [.58, .66, .75, .79, .85];
  for (const side of [-1, 1]) {
    const wing = width < 1 ? new THREE.Group() : g;
    if (wing !== g) { wing.name = `wing-side-${side}`; wing.scale.x = width; g.add(wing); }
    for (let i = 0; i < 5; i++) {
      const p = solid(feather(lengths[i], .27), toon(c.pal.main), .012);
      p.name = 'phoenix-outer-feather'; p.position.set(side * (.39 + i * .025), -.03 - i * .016, -.15 - i * .012);
      p.rotation.set(0, side * .10, -side * angles[i]); wing.add(p);
    }
    for (let i = 0; i < 4; i++) {
      const p = solid(feather(.38 + i * .035, .20), toon(c.pal.cloth ?? c.pal.trim), .008);
      p.name = 'phoenix-inner-feather'; p.position.set(side * .39, -.04 - i * .022, -.105 + i * .008);
      p.rotation.set(0, -side * .20, -side * (.82 + i * .31)); wing.add(p);
    }
    const root = solid(sphere(.16, .85, 1.1, .5, 12), toon(c.pal.sub), .012); root.position.set(side * .35, -.055, -.15); root.name = 'wing-root'; wing.add(root);
    const band = seam([new THREE.Vector3(side * .32, -.14, -.27), new THREE.Vector3(side * .42, -.01, -.275), new THREE.Vector3(side * .56, .07, -.255)], c.pal.trim, .018); band.name = 'wing-root-band'; wing.add(band);
  }
  return g;
}
