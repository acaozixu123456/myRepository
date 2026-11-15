// 统一着色：所有模型（Kenney、Quaternius、原创）加载后都换成同一套卡通材质，
// 分层光照 + 边缘光，角色和道具再加一圈描边，让不同来源的素材看起来是一个游戏。
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function gradient(steps) {
  const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
const GRADIENT = gradient([118, 178, 228, 255]);

// 边缘光，按昼夜调整
export const rim = { color: { value: new THREE.Color(0xfff1d8) }, strength: { value: 0.32 } };
export function setRim(hex, strength) { rim.color.value.setHex(hex); rim.strength.value = strength; }

const converted = new Map();
export function toonMaterial(src) {
  if (converted.has(src.uuid)) return converted.get(src.uuid);
  const m = new THREE.MeshToonMaterial({
    name: src.name, color: src.color, map: src.map, vertexColors: src.vertexColors, transparent: src.transparent, opacity: src.opacity,
    alphaTest: src.alphaTest, side: src.side, gradientMap: GRADIENT,
    emissive: src.emissive, emissiveMap: src.emissiveMap, emissiveIntensity: src.emissiveIntensity ?? 1,
  });
  addRim(m); converted.set(src.uuid, m);
  return m;
}
export function addRim(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = rim.color; sh.uniforms.rimStrength = rim.strength;
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      { vec3 vd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float r = 1.0 - max(dot(normal, vd), 0.0);
        totalEmissiveRadiance += rimColor * smoothstep(0.5, 1.0, r) * rimStrength; }`);
  };
  m.customProgramCacheKey = () => 'toon-rim';
  return m;
}
export const toonFromParams = p => addRim(new THREE.MeshToonMaterial({ gradientMap: GRADIENT, ...p }));

// 描边：沿平滑法线在屏幕空间外扩的背面网格。粗细按屏幕算，远近一致。
export const outline = { width: { value: 0.0052 }, aspect: { value: 1 }, color: { value: new THREE.Color(0x3d2b24) } };
const OUTLINE_MAT = new THREE.ShaderMaterial({
  uniforms: { width: outline.width, aspect: outline.aspect, color: outline.color },
  vertexShader: `uniform float width; uniform float aspect;
    void main() { vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal); p.xy += n.xy * vec2(1.0 / aspect, 1.0) * width * p.w; gl_Position = p; }`,
  fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});
const hulls = new Map();
function hullOf(geo) {
  if (!hulls.has(geo.uuid)) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.getAttribute('position')); if (geo.index) g.setIndex(geo.index);
    const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); hulls.set(geo.uuid, m);
  }
  return hulls.get(geo.uuid);
}
const NO_OUTLINE = /eye|shine|blush|nose|glow|water|leaf|leaves|grass/i;

// 把一个模型整个换成卡通材质；withOutline 时给实心部件加描边
export function toonify(root, withOutline = false) {
  const meshes = []; root.traverse(o => { if (o.isMesh && !o.userData.isOutline) meshes.push(o); });
  for (const m of meshes) {
    m.material = Array.isArray(m.material) ? m.material.map(toonMaterial) : toonMaterial(m.material);
    const name = Array.isArray(m.material) ? m.material[0].name : m.material.name;
    if (withOutline && !m.isSkinnedMesh && !m.morphTargetInfluences && !NO_OUTLINE.test(name) && !m.material.transparent) {
      const h = new THREE.Mesh(hullOf(m.geometry), OUTLINE_MAT); h.userData.isOutline = true; h.castShadow = false; h.receiveShadow = false; h.raycast = () => {};
      m.add(h);
    }
  }
  return root;
}
