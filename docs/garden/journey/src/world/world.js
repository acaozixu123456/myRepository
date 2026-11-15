// 把地形、天空、水、植被、道具组装起来；每帧更新近处植被。
import * as THREE from 'three';
import { U, makeGobo } from './atmo.js';
import { buildLand, DOM } from './land.js';
import { makeDetailTex, makeDirtTex, makeSplat, terrainMaterial, terrainUniforms, tuftMaterial, makeTuftGeo, buildNear, buildFar, blurWrap } from './terrain.js';
import { makeSky } from './sky.js';
import { buildStream } from './water.js';
import { loadFlora, floraMaterials, ScatterLayer, placeFlora, canopyTexture, forestFloor, buildImpostors } from './flora.js';

export const RES = 'res/';

// 不同画质的显示半径（米）
export const RADII = {
  high: { trees: 62, shadowTrees: 30, bush: 70, small: 42, rock: 90 },
  mid: { trees: 50, shadowTrees: 24, bush: 55, small: 32, rock: 70 },
  low: { trees: 38, shadowTrees: 0, bush: 40, small: 22, rock: 50 },
};

export async function buildWorld(renderer, scene, quality, say, opts = {}) {
  const W = { layers: [], quality };
  const floraP = loadFlora(RES);          // 先开始下载
  say('正在铺路…');
  const land = W.land = buildLand();
  const detail = makeDetailTex(), dirt = makeDirtTex(), splat = W.splat = makeSplat(land);
  U.uGobo.value = makeGobo(blurWrap);
  U.uCanopyBox.value.set(DOM.x0, DOM.z0, DOM.w, DOM.d);
  const tuni = W.terrainUni = terrainUniforms(splat, detail, dirt);
  const tmat = W.terrainMat = terrainMaterial(tuni);
  scene.add(W.near = buildNear(land, tmat));
  const far = W.far = buildFar();
  scene.add(far);
  scene.add(W.sky = makeSky());
  scene.add(W.stream = buildStream(land));
  await opts.yieldFn?.();

  say('正在种树…');
  const models = await floraP;
  const r = RADII[quality];
  const fadeU = W.fadeU = { trees: { value: r.trees }, bush: { value: r.bush }, small: { value: r.small }, rock: { value: r.rock } };
  const mats = W.floraMats = await floraMaterials(RES, fadeU);
  // 树冠用球面法线
  for (const t of ['CommonTree_1', 'CommonTree_3', 'CommonTree_5', 'Pine_2', 'Bush_Common', 'Bush_Common_Flowers'])
    for (const p of models[t].parts) if (p.mat === 'leaf' || p.mat === 'pine') softenCanopy(p.geo, t.startsWith('Bush') ? 0.6 : 0.78);
  const placed = W.placed = placeFlora(land, far.userData.heightAt, quality);
  const canopy = canopyTexture(placed.trees, land);
  U.uCanopy.value = canopy.tex;
  forestFloor(splat, placed.trees, land);
  // 近处的真树：按种类分层；离得近的投影子
  const byType = {};
  for (const t of placed.trees) { if (t.far) continue; (byType[t.t] ||= []).push(t); }
  for (const [type, list] of Object.entries(byType)) {
    const items = new Float32Array(list.length * 8);
    list.forEach((t, i) => { const v = 0.88 + ((i * 7919) % 100) / 400; items.set([t.x, t.y, t.z, t.ry, t.s, v, v * (0.97 + ((i * 31) % 10) / 160), v * 0.95], i * 8); });
    const parts = models[type].parts.map(p => ({ geo: p.geo, mat: mats[p.mat] }));
    if (r.shadowTrees > 0) {
      W.layers.push(new ScatterLayer(type + ':s', parts, items, { radius: r.shadowTrees, shadow: true, cull: false, cap: 400 }));
      W.layers.push(new ScatterLayer(type + ':m', parts, items, { radius: r.trees + 4, rMin: r.shadowTrees, cap: 600 }));
    } else W.layers.push(new ScatterLayer(type, parts, items, { radius: r.trees + 4, cap: 600 }));
  }
  // 灌木、草花、石头
  const smallMat = name => p => {
    if (name.startsWith('Bush')) return p.mat === 'flowers' ? mats.bushFlower : mats.bushLeaf;
    return mats[p.mat];
  };
  for (const [name, items] of Object.entries(placed.small)) {
    const parts = models[name].parts.map(p => ({ geo: p.geo, mat: smallMat(name)(p) }));
    const rad = name.startsWith('Bush') ? r.bush + 4 : name.startsWith('Rock') ? r.rock + 4 : r.small + 4;
    W.layers.push(new ScatterLayer(name, parts, items, { radius: rad, cap: 5000 }));
  }
  // 草丛（颜色取自地面）
  const tm = W.tuftMat = tuftMaterial(tuni, fadeU.small);
  const tuftGeos = [makeTuftGeo(11, 12, 0.3), makeTuftGeo(23, 9, 0.42), makeTuftGeo(37, 14, 0.24)];
  tuftGeos.forEach((g, i) => {
    const items = placed.tufts[i]; if (!items || !items.length) return;
    W.layers.push(new ScatterLayer('tuft' + i, [{ geo: g, mat: tm }], items, { radius: r.small + 4, cap: 9000 }));
  });
  for (const L of W.layers) scene.add(L.group);
  // 远处替身
  const imp = buildImpostors(renderer, models, mats, placed.trees, fadeU);
  W.impostors = new THREE.Mesh(imp.geo, imp.mat); W.impostors.frustumCulled = false; W.impostors.name = 'impostors';
  scene.add(W.impostors);
  W.stats = { trees: placed.nearCount, farTrees: placed.trees.length - placed.nearCount, small: Object.fromEntries(Object.entries(placed.small).map(([k, v]) => [k, v.length / 8])) };

  W.update = (camera, focus, dt, force) => { for (const L of W.layers) L.update(camera, focus, dt, force); };
  W.setQuality = q => {
    const rr = RADII[q]; W.quality = q;
    fadeU.trees.value = rr.trees; fadeU.bush.value = rr.bush; fadeU.small.value = rr.small; fadeU.rock.value = rr.rock;
    for (const L of W.layers) {
      if (L.name.endsWith(':s')) L.r = rr.shadowTrees; else if (L.name.endsWith(':m')) { L.r = rr.trees + 4; L.rMin = rr.shadowTrees; }
      else if (L.name.startsWith('Bush')) L.r = rr.bush + 4; else if (L.name.startsWith('Rock')) L.r = rr.rock + 4;
      else if (TREES.includes(L.name)) L.r = rr.trees + 4; else L.r = rr.small + 4;
    }
  };
  return W;
}
const TREES = ['CommonTree_1', 'CommonTree_3', 'CommonTree_5', 'Pine_2'];

function softenCanopy(geo, amount) {
  geo.computeBoundingBox();
  const c = new THREE.Vector3(); geo.boundingBox.getCenter(c); c.y -= (geo.boundingBox.max.y - geo.boundingBox.min.y) * 0.08;
  const P = geo.attributes.position, N = geo.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).sub(c).normalize(); n.fromBufferAttribute(N, i);
    n.lerp(v, amount).normalize(); N.setXYZ(i, n.x, n.y, n.z);
  }
  N.needsUpdate = true;
}
