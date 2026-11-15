// 打包坐骑模型：Quaternius Ultimate Animated Animals（CC0）的马和小毛驴。
// 只留站、走、跑、吃草、跳五个动作；去掉不带动网格的辅助骨头（IK 目标等）的轨道、和静止位置一样的位移 / 缩放轨道，
// 再去掉多余关键帧，法线和权重量化（位置不量化：游戏里要直接读顶点算马鞍和鼻尖），输出到 public/journey/res/。
// 用法：GLTF_TOOLS=<装了 @gltf-transform/core,functions,extensions 的 node_modules> node tools/pack-animals.mjs <Horse.gltf 所在目录>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(path.join(process.env.GLTF_TOOLS || '.', 'x.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const F = req('@gltf-transform/functions');

const SRC = process.argv[2] || '/tmp/claude-0/dl/uaa';
const KEEP = ['Idle', 'Walk', 'Gallop', 'Eating', 'Gallop_Jump'];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// 删掉通道时要把采样器和它的关键帧数据一起删，不然 prune 以为这些数据还有人用
const drop = ch => {
  const s = ch.getSampler(); ch.dispose(); if (!s) return;
  const used = [s.getInput(), s.getOutput()]; s.dispose();
  for (const x of used) if (x && x.listParents().every(p => p.propertyType === 'Root')) x.dispose();
};

for (const [src, out] of [['Horse.gltf', 'horseA.glb'], ['Donkey.gltf', 'donkey.glb']]) {
  const doc = await io.read(path.join(SRC, src));
  const root = doc.getRoot();
  // 哪些骨头真的带着顶点（自己或子孙有权重）
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
  let dropped = 0;
  for (const a of root.listAnimations()) {
    if (!KEEP.includes(a.getName())) { for (const ch of a.listChannels()) drop(ch); a.dispose(); continue; }
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode(), p = ch.getTargetPath();
      if (!node || !deform.has(node)) { drop(ch); dropped++; continue; }
      if (p === 'translation' || p === 'scale') {
        const rest = p === 'scale' ? node.getScale() : node.getTranslation();
        const o = ch.getSampler().getOutput(), v = [];
        let d = 0; for (let i = 0; i < o.getCount(); i++) { o.getElement(i, v); for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(v[k] - rest[k])); }
        if (d < 1e-4) { drop(ch); dropped++; }
      }
    }
  }
  await doc.transform(
    F.prune(), F.dedup(), F.resample({ tolerance: 4e-4 }), F.prune(),
    F.quantize({ pattern: /^(NORMAL|JOINTS|WEIGHTS)/, quantizeNormal: 10, quantizeWeight: 8 }),
  );
  const file = path.join('public/journey/res', out);
  await io.write(file, doc);
  console.log(out, fs.statSync(file).size, 'dropped', dropped, 'deform bones', deform.size, root.listAnimations().map(a => `${a.getName()}:${a.listChannels().length}`).join(' '));
}
