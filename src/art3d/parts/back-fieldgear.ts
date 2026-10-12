// 随身披挂：只在装配时生成；根保留 back 插槽的单位变换。
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

/** 短披风的两片圆弧分摆；尾根从中央开口露出。 */
export function cape(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-short-curved-cape';
  const build = c.look.build ?? 1;
  const width = build < .8 ? THREE.MathUtils.clamp(build, .7, 1) : 1 + (build - 1) * .28;
  for (const side of [-1, 1]) {
    const panel: ClothPoint = (t, u) => {
      const opening = THREE.MathUtils.smoothstep(t, .15, .57);
      const inner = .025 + .24 * opening;
      const outer = .44 + .22 * Math.sin(t * Math.PI * .72);
      return new THREE.Vector3(side * (inner + (outer - inner) * u) * width,
        .10 - .98 * t + .12 * Math.sin(u * Math.PI) * t * t,
        -.14 - .17 * t - .065 * Math.sin(u * Math.PI * 2) * Math.sin(t * Math.PI));
    };
    const m = solid(cloth(panel, 16, 6, .024), toon(c.pal.sub), .012);
    m.name = 'short-cape-panel'; g.add(m);
    g.add(seam(sample(panel, true, 1), c.pal.trim, .019));
    g.add(seam(sample(panel, false, 1), c.pal.trim, .013));
    const shoulder: ClothPoint = (t, u) => new THREE.Vector3(side * (.05 + .48 * u) * width,
      .10 - .31 * t + .08 * Math.sin(u * Math.PI) * (1 - t),
      -.18 - .045 * Math.sin(u * Math.PI) - .035 * t);
    const fold = solid(cloth(shoulder, 8, 6, .028), toon(c.pal.main), .011);
    fold.name = 'short-cape-round-shoulder'; g.add(fold);
    g.add(seam(sample(shoulder, true, 1), c.pal.trim, .012));
    const clasp = solid(sphere(.043, 1.12, 1, .55, 12), toon(c.pal.trim), .005);
    clasp.name = 'short-cape-clasp'; clasp.position.set(side * .32 * width, .075, -.218); g.add(clasp);
  }
  return g;
}

/** 连成一体的双腹葫芦与真实束绳，吊带从背部扣位接到收腰。 */
export function gourd(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-tied-double-gourd';
  const center = new THREE.Vector3(-.49, -.31, -.23);
  const profile = [[0, -.325], [.09, -.31], [.17, -.25], [.215, -.15], [.204, -.04],
    [.12, .035], [.078, .075], [.105, .12], [.145, .19], [.126, .265], [.068, .30], [.065, .345], [0, .345]];
  const pot = solid(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20), toon('#c98a3a'), .012);
  pot.name = 'gourd-double-belly'; pot.position.copy(center); g.add(pot);
  const cork = solid(new THREE.CylinderGeometry(.059, .055, .105, 12), toon('#775134'), .008);
  cork.name = 'gourd-wood-cork'; cork.position.copy(center).add(new THREE.Vector3(0, .382, 0)); g.add(cork);
  const rope = c.pal.trim;
  const wrap = (radius: number, y: number, thick: number, name: string) => {
    const ring = solid(new THREE.TorusGeometry(radius, thick, 6, 20), toon(rope), .004);
    ring.name = name; ring.rotation.x = Math.PI / 2; ring.position.copy(center).add(new THREE.Vector3(0, y, 0)); g.add(ring);
  };
  wrap(.079, .075, .022, 'gourd-waist-binding');
  wrap(.066, .327, .014, 'gourd-neck-binding');
  const knot = center.clone().add(new THREE.Vector3(-.035, .075, -.079));
  const strap = seam([new THREE.Vector3(.40, .025, -.08), new THREE.Vector3(.19, -.035, -.14),
    new THREE.Vector3(-.16, -.105, -.21), new THREE.Vector3(-.40, -.16, -.30), knot.clone()], c.pal.sub, .035);
  strap.name = 'gourd-attached-sling'; g.add(strap);
  for (const side of [-1, 1]) {
    const loop = seam([knot.clone(), knot.clone().add(new THREE.Vector3(side * .105, .065, -.012)),
      knot.clone().add(new THREE.Vector3(side * .13, -.005, -.025)), knot.clone()], rope, .014);
    loop.name = 'gourd-tied-bow-loop'; g.add(loop);
    const end = seam([knot.clone(), knot.clone().add(new THREE.Vector3(side * .065, -.11, -.025)),
      knot.clone().add(new THREE.Vector3(side * .045, -.21, -.008))], rope, .012);
    end.name = 'gourd-binding-end'; g.add(end);
  }
  const anchor = solid(sphere(.047, 1, 1, .6, 12), toon(c.pal.trim), .005);
  anchor.name = 'gourd-sling-anchor'; anchor.position.set(.40, .025, -.10); g.add(anchor);
  return g;
}

/** 短厚兽皮背肩，圆钝毛边与衣服的皮裙/胸带分开。 */
export function furCloak(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-soft-fur-mantle';
  const width = 1 + ((c.look.build ?? 1) - 1) * .50;
  for (const side of [-1, 1]) {
    const panel: ClothPoint = (t, u) => {
      const opening = THREE.MathUtils.smoothstep(t, .08, .50);
      const inner = .055 + .16 * opening, outer = .60 + .11 * Math.sin(t * Math.PI);
      return new THREE.Vector3(side * (inner + (outer - inner) * u) * width,
        .025 - .79 * t + .06 * Math.sin(u * Math.PI) * t,
        -.18 - .12 * t - .04 * Math.sin(u * Math.PI * 2) * Math.sin(t * Math.PI));
    };
    const hide = solid(cloth(panel, 14, 6, .05), toon('#9f784e'), .014);
    hide.name = 'fur-mantle-hide'; g.add(hide);
    const shoulder = solid(sphere(.22, 1.25, .53, .48, 16), toon('#a8845a'), .012);
    shoulder.name = 'fur-mantle-round-shoulder'; shoulder.position.set(side * .44 * width, .025, -.205); g.add(shoulder);
    // 大块软毛沿外侧与下摆排布，中央缺口始终开放。
    for (let i = 0; i < 4; i++) {
      const t = i < 3 ? .16 + i * .33 : 1, u = i < 3 ? 1 : .70;
      const p = panel(t, u);
      const radius = i % 2 ? .155 : .17;
      const fur = sphere(radius, 1, 1.12, .55, 12), positions = fur.getAttribute('position');
      for (let j = 0; j < positions.count; j++) {
        const taper = .70 + .30 * THREE.MathUtils.clamp(positions.getY(j) / (radius * 1.12) + 1, 0, 1);
        positions.setX(j, positions.getX(j) * taper); positions.setZ(j, positions.getZ(j) * taper);
      }
      fur.computeVertexNormals();
      const tuft = solid(fur, toon(i % 2 ? '#c9ad80' : '#bda071'), .008);
      tuft.name = 'fur-mantle-rounded-tuft'; tuft.position.copy(p); tuft.position.z -= .025;
      tuft.rotation.z = side * (i < 3 ? -.25 : .42); g.add(tuft);
    }
    const binding = seam(sample(panel, false, .22), c.pal.sub, .018);
    binding.name = 'fur-mantle-leather-binding'; g.add(binding);
    const clasp = solid(sphere(.045, 1, .8, .55, 12), toon(c.pal.trim), .005);
    clasp.name = 'fur-mantle-clasp'; clasp.position.set(side * .29 * width, -.025, -.255); g.add(clasp);
  }
  return g;
}

