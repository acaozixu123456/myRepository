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

/**
 * 光色中性化强度（0 = 原样，1 = 光只决定明暗、不染色）。
 * 探索世界满是霓虹彩光，会把猫猫整只染成品红 / 紫色（颜色全丢）：世界渲染时置 0.7，战斗 / 立绘渲染时置 0。
 * 同时叠一圈冷色轮廓光，让猫猫从背景里「立」出来。
 */
export const litK = { value: 0 };
function patchLit(m: THREE.MeshToonMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLitK = litK;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vCatY;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCatY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uLitK;\nvarying float vCatY;\nvoid main() {').replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  vec3 tot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
  float lum = dot(tot, vec3(0.299, 0.587, 0.114));
  float alb = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.02);
  vec3 neutral = diffuseColor.rgb * (lum / alb) * (1.0 + 0.3 * uLitK);
  vec3 nrm = normalize(normal);
  float rimK = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 2.4);
  // 自下而上的柔和渐变：脚 / 下摆略暗、头最亮，立体感更足
  float ao = mix(0.8, 1.0, smoothstep(-0.2, 2.2, vCatY));
  vec3 lit = mix(tot, neutral, uLitK) * ao;
  lit += vec3(0.55, 0.82, 1.0) * rimK * (0.16 + 0.34 * uLitK);
  reflectedLight.directDiffuse = lit;
  reflectedLight.indirectDiffuse = vec3(0.0);
}`);
  };
  m.customProgramCacheKey = () => 'litk2';
}

const matCache = new Map<string, THREE.MeshToonMaterial>();
/** 卡通材质（按颜色缓存复用，别在渲染循环里 new） */
export function toon(color: string | number, opt: { map?: THREE.Texture | null; emissive?: string | number; key?: string; double?: boolean } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opt.emissive ?? ''}|${opt.key ?? ''}|${opt.double ? 'd' : ''}`;
  if (!opt.map) { const c = matCache.get(key); if (c) return c; }
  // 有贴图时贴图已经带着底色，材质色用白（否则颜色会被平方）
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(opt.map ? '#ffffff' : color), gradientMap: gradientMap(), map: opt.map ?? null });
  if (opt.emissive !== undefined) m.emissive = new THREE.Color(opt.emissive);
  if (opt.double) m.side = THREE.DoubleSide;
  patchLit(m);
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
      vertexShader: `#include <common>
#include <skinning_pars_vertex>
uniform float uThick;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  transformed += normalize(objectNormal) * uThick;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}`,
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

/** 几何细节倍率：战斗 / 立绘 = 1；探索世界里的小猫建模时临时调低（见 world/explore.ts），省三角面 */
export const detail = { k: 1 };
const dseg = (n: number, min: number) => Math.max(min, Math.round(n * detail.k));

export const sphere = (r: number, sx = 1, sy = 1, sz = 1, seg = 20): THREE.BufferGeometry => {
  const sg = dseg(seg, 8);
  const g = new THREE.SphereGeometry(r, sg, Math.max(6, Math.round(sg * 0.75)));
  g.scale(sx, sy, sz);
  return g;
};
/** 竖直胶囊：总长 len（含两端半球），半径 r，中心在原点 */
export const capsule = (r: number, len: number, seg = 12): THREE.BufferGeometry => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), dseg(6, 3), dseg(seg, 6));

const vcCache = new Map<string, THREE.MeshToonMaterial>();
/** 合批后的顶点色材质：颜色从顶点属性来，按「贴图 × 双面」缓存 */
export function vertexColorMat(map: THREE.Texture | null, double: boolean): THREE.MeshToonMaterial {
  const key = `${map?.uuid ?? ''}|${double ? 'd' : ''}`;
  let m = vcCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: new THREE.Color('#ffffff'), gradientMap: gradientMap(), map, vertexColors: true });
    if (double) m.side = THREE.DoubleSide;
    patchLit(m);
    vcCache.set(key, m);
  }
  return m;
}

/** 烘焙后的描边材质：外扩量已经烘进顶点，这里 uThick = 0，所有描边合成一个网格 */
export const bakedOutline = (): THREE.ShaderMaterial => outlineMat(0, '#3a2430');
