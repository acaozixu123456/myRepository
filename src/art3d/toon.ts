// 卡通渲染材质：三档色阶（赛璐璐）+ 反向外壳描边。所有 3D 部件都用这里的 toon() / solid()，保证画风统一。
import * as THREE from 'three';

let grad: THREE.DataTexture | null = null;
export function gradientMap(): THREE.DataTexture {
  if (!grad) {
    // 暗部 / 中间 / 亮部 / 高光：四档，偏柔和（暗部不要太黑）
    const data = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 238, 238, 238, 255, 255, 255, 255, 255]);
    grad = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
  }
  return grad;
}

const matCache = new Map<string, THREE.MeshToonMaterial>();
/** 卡通材质（按颜色缓存复用，别在渲染循环里 new） */
export function toon(color: string | number, opt: { map?: THREE.Texture | null; emissive?: string | number; key?: string } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opt.emissive ?? ''}|${opt.key ?? ''}`;
  if (!opt.map) { const c = matCache.get(key); if (c) return c; }
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: gradientMap(), map: opt.map ?? null });
  if (opt.emissive !== undefined) m.emissive = new THREE.Color(opt.emissive);
  if (!opt.map) matCache.set(key, m);
  return m;
}

const outlineCache = new Map<string, THREE.ShaderMaterial>();
/** 描边材质：沿法线外扩 thick 个单位，只画背面 */
export function outlineMat(thick: number, color = '#3a2430'): THREE.ShaderMaterial {
  const key = `${thick}|${color}`;
  let m = outlineCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uThick: { value: thick }, uColor: { value: new THREE.Color(color) } },
      vertexShader: 'uniform float uThick;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normalize(normal)*uThick,1.0);}',
      fragmentShader: 'uniform vec3 uColor;void main(){gl_FragColor=vec4(uColor,1.0);}',
      side: THREE.BackSide,
    });
    outlineCache.set(key, m);
  }
  return m;
}

export const OUTLINE = 0.028;

/** 带描边的网格。outline = 0 关闭描边（小饰物、五官） */
export function solid(geo: THREE.BufferGeometry, mat: THREE.Material, outline = OUTLINE): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (outline > 0) {
    const o = new THREE.Mesh(geo, outlineMat(outline));
    o.name = 'outline';
    m.add(o);
  }
  return m;
}

export const sphere = (r: number, sx = 1, sy = 1, sz = 1, seg = 20): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
  g.scale(sx, sy, sz);
  return g;
};
/** 竖直胶囊：总长 len（含两端半球），半径 r，中心在原点 */
export const capsule = (r: number, len: number, seg = 12): THREE.BufferGeometry => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, seg);
