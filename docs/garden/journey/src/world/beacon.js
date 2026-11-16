// 标记点的光柱：地图上标记了一个地方，远处就立一道淡淡的金光，走近了慢慢消失。
import * as THREE from 'three';
import { U } from './atmo.js';

const VS = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz;
  vN = normalize( mat3( modelMatrix ) * normal );
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform vec3 uColor; uniform float uK; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
void main() {
  vec3 V = normalize( cameraPosition - vWP );
  float f = abs( dot( normalize( vN ), V ) );
  float y = vUv.y;
  float a = pow( f, 2.5 ) * pow( 1.0 - y, 1.4 ) * smoothstep( 0.0, 0.03, y ) * ( 0.8 + 0.2 * sin( y * 26.0 - uTime * 2.2 ) ) * uK;
  gl_FragColor = vec4( uColor, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeBeacon() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.78, 0.42) }, uK: { value: 0 }, uTime: U.uTime },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'beacon'; mesh.visible = false; mesh.renderOrder = 3; mesh.frustumCulled = false;
  let k = 0;
  // w：标记点（没有就是 null）；离得越远光柱越粗，免得远处细得看不见
  mesh.userData.update = (w, land, camPos, dt) => {
    const want = w ? 1 : 0;
    k += (want - k) * Math.min(1, dt * 2.5);
    if (w) {
      const d = Math.hypot(w.x - camPos.x, w.z - camPos.z), wd = Math.max(1.1, d / 110);
      mesh.position.set(w.x, land.height(w.x, w.z) - 0.5, w.z);
      mesh.scale.set(wd, 90, wd);
      mat.uniforms.uK.value = k * 0.85 * Math.min(1, Math.max(0, (d - 16) / 26));
    } else mat.uniforms.uK.value = k * 0.85;
    mesh.visible = mat.uniforms.uK.value > 0.004;
  };
  return mesh;
}
