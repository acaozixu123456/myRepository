// 打包路上的野生动物：Quaternius Ultimate Animated Animals（CC0）的小鹿、大角鹿、狐狸。
// 和 pack-animals.mjs 一样：只留几个动作，去掉不带动网格的骨头轨道和静止不动的位移 / 缩放轨道，再压缩关键帧、量化顶点。
// 用法：GLTF_TOOLS=<装了 @gltf-transform/core,functions,extensions 的 node_modules> node tools/pack-wildlife.mjs <Deer.gltf 所在目录>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(path.join(process.env.GLTF_TOOLS || '.', 'x.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const F = req('@gltf-transform/functions');

const SRC = process.argv[2] || '/tmp/claude-0/dl/uaa';
// 统一成这几个名字：Idle 站着、Look 抬头看（Idle_2）、Low 低头（Headlow）、Walk、Gallop、Eating
const KEEP = { Idle: 'Idle', Idle_2: 'Look', Idle_Headlow: 'Low', Idle_2_HeadLow: 'Low', Walk: 'Walk', Gallop: 'Gallop', Eating: 'Eating' };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const drop = ch => {
  const s = ch.getSampler(); ch.dispose(); if (!s) return;
  const used = [s.getInput(), s.getOutput()]; s.dispose();
  for (const x of used) if (x && x.listParents().every(p => p.propertyType === 'Root')) x.dispose();
};

for (const [src, out] of [['Deer.gltf', 'deer.glb'], ['Stag.gltf', 'stag.glb'], ['Fox.gltf', 'fox.glb']]) {
  const doc = await io.read(path.join(SRC, src));
  const root = doc.getRoot();
  const deform = new Set();
  for (const skin of root.listSkins()) {
    const joints = skin.listJoints(), hit = new Set();
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0'); if (!J || !Wt) continue;
      const j = [], w = [];
      for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); Wt.getElement(i, w); for (let k = 0; k < 4; k++) if (w[k] > 1e-3) hit.add(j[k]); }
    }
    for (const i of hit) for (let n = joints[i]; n; n = n.getParentNode()) deform.add(n);
  }
  for (const a of root.listAnimations()) {
    if (!KEEP[a.getName()]) { for (const ch of a.listChannels()) drop(ch); a.dispose(); continue; }
    a.setName(KEEP[a.getName()]);
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode(), p = ch.getTargetPath();
      if (!node || !deform.has(node)) { drop(ch); continue; }
      if (p === 'translation' || p === 'scale') {
        const rest = p === 'scale' ? node.getScale() : node.getTranslation();
        const o = ch.getSampler().getOutput(), v = [];
        let d = 0; for (let i = 0; i < o.getCount(); i++) { o.getElement(i, v); for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(v[k] - rest[k])); }
        if (d < 1e-4) drop(ch);
      }
    }
  }
  await doc.transform(
    F.prune(), F.dedup(), F.resample({ tolerance: 4e-4 }), F.prune(),
    F.quantize({ pattern: /^(NORMAL|JOINTS|WEIGHTS)/, quantizeNormal: 10, quantizeWeight: 8 }),   // 位置不量化：蒙皮网格量化位置后会跑偏
  );
  const file = path.join('public/journey/res', out);
  await io.write(file, doc);
  console.log(out, fs.statSync(file).size, root.listAnimations().map(a => `${a.getName()}:${a.listChannels().length}`).join(' '));
}
