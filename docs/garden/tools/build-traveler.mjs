// 生成旅人模型 public/journey/res/traveler-m.glb / traveler-f.glb：
// Quaternius「Modular Character Outfits - Fantasy」的游侠外套（CC0，免费版不带脑袋）
// + 「Universal Base Characters」里的头、眼睛、眉毛（按骨骼名搬到游侠骨架上）
// + 「Universal Animation Library 1/2」里挑出来的动作（只留旋转，手指不要）。
// 用法：GLTF_TOOLS=<装了 @gltf-transform/core,functions,extensions 和 meshoptimizer、sharp 的 node_modules>
//       node tools/build-traveler.mjs <素材目录> [male|female] [输出]
// 素材目录里要有：outfits/（Male_Ranger.gltf 等）、ubc/（Superhero_*_FullBody.gltf）、ual/UAL1_Standard.glb、ual2/UAL2_Standard.glb
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(path.join(process.env.GLTF_TOOLS || '.', 'x.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const F = req('@gltf-transform/functions');
const { MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');
import * as THREE from 'three';

const [, , SRC = '/tmp/claude-0/x', SEX = 'male', OUT = 'public/journey/res/traveler-' + (SEX === 'female' ? 'f' : 'm') + '.glb'] = process.argv;
const OPT = { tint: process.env.TINT || 'none', simplify: +(process.env.SIMPLIFY || 0.55), tex: +(process.env.TEX || 1024) };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const M = SEX === 'female' ? 'Female' : 'Male';
const A = await io.read(path.join(SRC, `outfits/${M}_Ranger.gltf`));
const B = await io.read(path.join(SRC, `ubc/Superhero_${M}_FullBody.gltf`));
const rootA = A.getRoot(), rootB = B.getRoot();
// 旅人不需要肩甲
for (const n of rootA.listNodes()) if (/Pauldron/.test(n.getName())) n.dispose();
for (const m of rootA.listMeshes()) if (/Pauldron/.test(m.getName())) m.dispose();
const skinA = rootA.listSkins()[0], skinB = rootB.listSkins()[0];
const jA = skinA.listJoints(), jB = skinB.listJoints();
const idxA = new Map(jA.map((n, i) => [n.getName(), i]));
const ibmA = skinA.getInverseBindMatrices().getArray(), ibmB = skinB.getInverseBindMatrices().getArray();
const mat = (arr, i) => new THREE.Matrix4().fromArray(arr, i * 16);
// B 的关节 i → A 的同名关节；以及把 B 的绑定空间搬到 A：M = inv(IBM_A) · IBM_B
const mapBA = jB.map(n => idxA.get(n.getName()));
const moveB = jB.map((n, i) => { const a = mapBA[i]; return a === undefined ? null : mat(ibmA, a).invert().multiply(mat(ibmB, i)); });
const buf = rootA.listBuffers()[0];

// ---- 头：从 B 的身体里挑出主要绑在 Head / neck_01 上的三角形 ----
const headSet = new Set(['Head', 'neck_01'].map(n => jB.findIndex(j => j.getName() === n)));
const arrOf = a => { const x = a.getArray(); if (!a.getNormalized()) return x; const d = x instanceof Uint8Array ? 255 : x instanceof Uint16Array ? 65535 : x instanceof Int8Array ? 127 : 32767; return Float32Array.from(x, v => Math.max(v / d, -1)); };
function transplant(prim, select, name, material) {
  const P = arrOf(prim.getAttribute('POSITION')), N = arrOf(prim.getAttribute('NORMAL'));
  const UV = arrOf(prim.getAttribute('TEXCOORD_0'));
  const J = prim.getAttribute('JOINTS_0').getArray(), W = arrOf(prim.getAttribute('WEIGHTS_0'));
  const I = prim.getIndices().getArray();
  const keep = new Int32Array(P.length / 3).fill(-1); const tri = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (select(a, J, W) && select(b, J, W) && select(c, J, W)) tri.push(a, b, c);
  }
  const verts = [...new Set(tri)]; verts.forEach((v, i) => keep[v] = i);
  const n = verts.length;
  const oP = new Float32Array(n * 3), oN = new Float32Array(n * 3), oUV = new Float32Array(n * 2), oJ = new Uint8Array(n * 4), oW = new Float32Array(n * 4);
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3(), m3 = new THREE.Matrix3();
  verts.forEach((src, i) => {
    acc.set(0, 0, 0); accN.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = W[src * 4 + k]; if (!w) continue;
      const jb = J[src * 4 + k], m = moveB[jb] || moveB[[...headSet][0]];
      v.fromArray(P, src * 3).applyMatrix4(m); acc.addScaledVector(v, w);
      nn.fromArray(N, src * 3).applyMatrix3(m3.setFromMatrix4(m)); accN.addScaledVector(nn, w);
      oJ[i * 4 + k] = mapBA[jb] ?? idxA.get('Head'); oW[i * 4 + k] = w;
    }
    acc.toArray(oP, i * 3); accN.normalize().toArray(oN, i * 3);
    oUV[i * 2] = UV[src * 2]; oUV[i * 2 + 1] = UV[src * 2 + 1];
  });
  const oI = new Uint16Array(tri.map(x => keep[x]));
  const acc_ = (type, arr) => A.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const p = A.createPrimitive().setAttribute('POSITION', acc_('VEC3', oP)).setAttribute('NORMAL', acc_('VEC3', oN))
    .setAttribute('TEXCOORD_0', acc_('VEC2', oUV)).setAttribute('JOINTS_0', acc_('VEC4', oJ)).setAttribute('WEIGHTS_0', acc_('VEC4', oW))
    .setIndices(acc_('SCALAR', oI)).setMaterial(material);
  const mesh = A.createMesh(name).addPrimitive(p);
  const node = A.createNode(name).setMesh(mesh).setSkin(skinA);
  rootA.listScenes()[0].addChild(node);
  return { verts: n, tris: oI.length / 3 };
}
const meshB = Object.fromEntries(rootB.listMeshes().map(m => [m.getName(), m]));
const matA = Object.fromEntries(rootA.listMaterials().map(m => [m.getName(), m]));
const skinMat = matA[`MI_Regular_${M}`];
const bodyB = rootB.listMeshes().find(m => m.listPrimitives()[0].getMaterial().getName().startsWith('MI_Superhero'));
const headish = (vi, J, W) => { let s = 0; for (let k = 0; k < 4; k++) if (headSet.has(J[vi * 4 + k])) s += W[vi * 4 + k]; return s > 0.9; };
const stats = {};
stats.head = transplant(bodyB.listPrimitives()[0], headish, 'Head', skinMat);
// 眼睛、眉毛整块搬过去
const eyesB = rootB.listMeshes().find(m => m.listPrimitives()[0].getMaterial().getName() === 'MI_Eyes');
const browB = rootB.listMeshes().find(m => m.listPrimitives()[0].getMaterial().getName().startsWith('MI_Hair'));
const eyeMat = A.createMaterial('Eyes').setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.3).setMetallicFactor(0);
const browMat = A.createMaterial('Brows').setBaseColorFactor([0.16, 0.1, 0.06, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
const all = () => true;
stats.eyes = transplant(eyesB.listPrimitives()[0], all, 'Eyes', eyeMat);
stats.brows = transplant(browB.listPrimitives()[0], all, 'Brows', browMat);
// 眼睛贴图：从 B 拿过来
{
  const t = eyesB.listPrimitives()[0].getMaterial().getBaseColorTexture();
  const img = await sharp(Buffer.from(t.getImage())).resize(128, 128).jpeg({ quality: 88 }).toBuffer();
  eyeMat.setBaseColorTexture(A.createTexture('eye').setImage(new Uint8Array(img)).setMimeType('image/jpeg').setURI('eye.jpg'));
}
console.log('transplant', JSON.stringify(stats));

// ---- 贴图：只留颜色贴图，缩小；外套换色 ----
async function recolor(png, tint) {
  if (!tint || tint === 'none') return png;
  const { data, info } = await sharp(Buffer.from(png)).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  // 绿色（色相 70°–170°）的布料换成目标颜色，明暗保留
  const T = { rust: [0.62, 0.25, 0.14], blue: [0.16, 0.3, 0.52], teal: [0.12, 0.38, 0.4], plum: [0.42, 0.2, 0.3] }[tint];
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.04 || mx !== g) continue;
    let h = 60 * (((b - r) / d) + 2); if (h < 0) h += 360;
    if (h < 70 || h > 170) continue;
    const sat = d / mx, edge = Math.min(1, (h - 70) / 20, (170 - h) / 20) * Math.min(1, sat / 0.25);
    const L = 0.3 * r + 0.59 * g + 0.11 * b, k = L / 0.32;
    const nr = Math.min(1, T[0] * k), ng = Math.min(1, T[1] * k), nb = Math.min(1, T[2] * k);
    data[i] = Math.round(255 * (r + (nr - r) * edge)); data[i + 1] = Math.round(255 * (g + (ng - g) * edge)); data[i + 2] = Math.round(255 * (b + (nb - b) * edge));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}
for (const m of rootA.listMaterials()) {
  m.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(0.82);
}
for (const m of rootA.listMeshes()) for (const p of m.listPrimitives()) if (p.getAttribute('COLOR_0')) p.setAttribute('COLOR_0', null);
// 兜帽单独换色：把兜帽三角形在贴图上的范围画成遮罩
function uvMask(prims, W, H) {
  const m = new Uint8Array(W * H);
  for (const prim of prims) {
    const uv = arrOf(prim.getAttribute('TEXCOORD_0')), I = prim.getIndices().getArray();
    for (let t = 0; t < I.length; t += 3) {
      const p = [I[t], I[t + 1], I[t + 2]].map(i => [uv[i * 2] * W, uv[i * 2 + 1] * H]);
      const x0 = Math.max(0, Math.floor(Math.min(...p.map(q => q[0]))) - 2), x1 = Math.min(W - 1, Math.ceil(Math.max(...p.map(q => q[0]))) + 2);
      const y0 = Math.max(0, Math.floor(Math.min(...p.map(q => q[1]))) - 2), y1 = Math.min(H - 1, Math.ceil(Math.max(...p.map(q => q[1]))) + 2);
      const [[ax, ay], [bx, by], [cx, cy]] = p, d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(d) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d, w2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d, w3 = 1 - w1 - w2;
        const e = -2.5 / Math.sqrt(Math.abs(d));   // 往外扩两三个像素，避免接缝
        if (w1 >= e && w2 >= e && w3 >= e) m[y * W + x] = 1;
      }
    }
  }
  return m;
}
const HOOD = { red: [0.4, 0.13, 0.085], blue: [0.13, 0.22, 0.36], none: null }[process.env.HOOD || 'red'];
async function tintHood(img, size) {
  if (!HOOD) return img;
  const hood = rootA.listMeshes().filter(m => /Hood/.test(m.getName())).flatMap(m => m.listPrimitives());
  const { data, info } = await sharp(Buffer.from(img)).resize(size, size).raw().toBuffer({ resolveWithObject: true });
  const mask = uvMask(hood, info.width, info.height), ch = info.channels;
  // 先求兜帽区域平均亮度，再按亮度比例上色（保留布料的明暗和纹理）
  let sum = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { const k = i * ch; sum += 0.3 * data[k] + 0.59 * data[k + 1] + 0.11 * data[k + 2]; n++; }
  const avg = sum / Math.max(1, n) / 255;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const k = i * ch, L = (0.3 * data[k] + 0.59 * data[k + 1] + 0.11 * data[k + 2]) / 255, f = Math.pow(L / avg, 0.85);
    for (let c = 0; c < 3; c++) data[k + c] = Math.min(255, Math.round(data[k + c] * 0.2 + 0.8 * 255 * HOOD[c] * f));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}
for (const t of rootA.listTextures()) {
  const used = t.listParents().some(p => p.propertyType === 'Material');
  if (!used) { t.dispose(); continue; }
  if (t.getName() === 'eye' || t.getURI() === 'eye.jpg') continue;
  let img = t.getImage();
  const nm = t.getURI() || t.getName();
  if (/Ranger_BaseColor/.test(nm) && process.env.TEXVAR) img = new Uint8Array(fs.readFileSync(path.join(SRC, `outfits/T_Ranger_${process.env.TEXVAR}_BaseColor.png`)));
  if (/Ranger/.test(nm)) { img = await recolor(img, OPT.tint); img = await tintHood(img, OPT.tex); }
  const size = /Regular|Superhero/.test(nm) ? 512 : OPT.tex;
  const out = await sharp(Buffer.from(img)).resize(size, size).jpeg({ quality: 86 }).toBuffer();
  t.setImage(new Uint8Array(out)).setMimeType('image/jpeg').setURI(path.basename(nm).replace(/\.png$/, '.jpg'));
}
await A.transform(F.prune());

// ---- 动作：从动作库挑选，只留骨骼旋转（盆骨加位移），手指不要 ----
const CLIPS = {
  ual: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit', 'Driving_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact', 'Swim_Fwd_Loop'],
  ual2: ['Idle_Rail_Loop', 'Idle_Lantern_Loop', 'Idle_FoldArms_Loop'],
};
const nodeA = new Map(rootA.listNodes().map(n => [n.getName(), n]));
const finger = /(index|middle|pinky|ring|thumb)_|leaf/;
let nAnim = 0;
for (const [lib, names] of Object.entries(CLIPS)) {
  const L = await io.read(path.join(SRC, `${lib}/${lib === 'ual' ? 'UAL1' : 'UAL2'}_Standard.glb`));
  for (const an of L.getRoot().listAnimations()) {
    if (!names.includes(an.getName())) continue;
    const out = A.createAnimation(an.getName());
    for (const ch of an.listChannels()) {
      const tn = ch.getTargetNode().getName(), p = ch.getTargetPath();
      if (finger.test(tn) || p === 'scale' || p === 'weights') continue;
      if (p === 'translation' && tn !== 'pelvis') continue;
      const tgt = nodeA.get(tn); if (!tgt) continue;
      const s = ch.getSampler();
      const inp = A.createAccessor().setType('SCALAR').setArray(new Float32Array(s.getInput().getArray())).setBuffer(buf);
      const outp = A.createAccessor().setType(s.getOutput().getType()).setArray(new Float32Array(s.getOutput().getArray())).setBuffer(buf);
      const smp = A.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
      out.addSampler(smp).addChannel(A.createAnimationChannel().setTargetNode(tgt).setTargetPath(p).setSampler(smp));
    }
    nAnim++;
  }
}
console.log('animations', nAnim);

// ---- 优化 ----
await A.transform(
  F.dedup(), F.resample({ tolerance: 2e-4 }), F.prune(),
  F.weld(),
  F.simplify({ simplifier: MeshoptSimplifier, ratio: OPT.simplify, error: +(process.env.SERR || 0.004), lockBorder: true }),
  // 靴子和护腕的扣子太细，再减一些
  async doc => { for (const m of doc.getRoot().listMeshes()) if (/Boots|Feet|Bracer/.test(m.getName())) for (const p of m.listPrimitives()) await F.simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.01, lockBorder: false }); },
  F.prune(),
  F.quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
);
let verts = 0; for (const m of rootA.listMeshes()) for (const p of m.listPrimitives()) { verts += p.getAttribute('POSITION').getCount(); console.log('  ', m.getName(), p.getAttribute('POSITION').getCount()); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, A);
console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes, verts', verts);
