import * as THREE from 'three';
import { buildHorseB, makeSkeleton } from '../src/horse/horseB.js';
import { HorseRigB } from '../src/horse/rigB.js';
const sk = makeSkeleton();
const geo = new THREE.BufferGeometry();
const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
mesh.add(sk.bones.body); mesh.bind(new THREE.Skeleton(sk.list));
const root = new THREE.Group(); root.add(mesh);
const rig = new HorseRigB(mesh, sk.bones, sk.rest);
const v = new THREE.Vector3();
const show = (label) => {
  for (const L of rig.legs) {
    const js = L.chain.map(n => sk.bones[n].getWorldPosition(new THREE.Vector3()));
    console.log(label, L.id, js.map(p => p.toArray().map(x => x.toFixed(3)).join(',')).join(' | '));
  }
};
root.updateMatrixWorld(true);
show('rest');
rig.update(1/60, { speed: 0 });
show('idle');
for (let i=0;i<30;i++) rig.update(1/60, { speed: 2.2 });
show('walk');
console.log('rest pos', JSON.stringify(sk.rest.fhoofL), JSON.stringify(sk.rest.hhoofL));
