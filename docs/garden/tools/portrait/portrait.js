// 头像渲染页：只给 tools/render-portraits.mjs 用，不打进游戏
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonify, setRim, outline } from '../../src/world/toon.js';
import { CLASSES, MONSTERS } from '../../src/data/index.js';

const S = 256, canvas = document.getElementById('c');
const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
r.setSize(S, S, false); r.setClearColor(0, 0); r.outputColorSpace = THREE.SRGBColorSpace;
outline.aspect.value = 1; outline.width.value = 0.012;
setRim(0xfff1d6, 0.35);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a6a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 5, 4); scene.add(sun);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const loader = new GLTFLoader();
const path = n => n.startsWith('x:') ? `/assets/extra/${n.slice(2)}.glb` : n.startsWith('animal') ? `/assets/pets/${n}.glb` : `/assets/nature/${n}.gltf`;

async function shot(modelName, tint) {
  const g = await loader.loadAsync(path(modelName));
  const o = toonify(g.scene, true);
  // 同一个身体换色做出的新怪物，头像也跟着换色（和 world/view.js 的做法一致）
  if (tint) { const c = new THREE.Color(tint); o.traverse(m => { if (!m.isMesh || m.userData.isOutline) return; const f = x => { const n = x.clone(); n.color = n.color.clone().lerp(c, 0.35); return n; }; m.material = Array.isArray(m.material) ? m.material.map(f) : f(m.material); }); }
  // 停在待机第一帧
  const clip = g.animations.find(c => c.name === 'idle') || g.animations.find(c => c.name !== 'static');
  if (clip) { const mx = new THREE.AnimationMixer(o); mx.clipAction(clip).play(); mx.update(0.01); }
  o.rotation.y = 0.55; scene.add(o); o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  // 头像：取上部 75%，略偏头
  const h = Math.max(sz.y * 0.8, sz.x, sz.z) * 0.62;
  cam.left = -h; cam.right = h; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix();
  const look = new THREE.Vector3(c.x, box.min.y + sz.y * 0.56, c.z);
  cam.position.copy(look).add(new THREE.Vector3(0.6, 0.45, 2).multiplyScalar(10)); cam.lookAt(look);
  r.render(scene, cam); scene.remove(o);
  return canvas.toDataURL('image/png');
}
window.renderAll = async () => {
  const out = {};
  for (const [k, v] of Object.entries(CLASSES)) out[k] = await shot(v.model);
  for (const [k, v] of Object.entries(MONSTERS)) out[k] = await shot(v.model, v.tint);
  return out;
};
window.portraitReady = true;
