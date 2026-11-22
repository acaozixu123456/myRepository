// 影子分两层：身边一圈是每帧都画的细影子（原来就有），再往外一大圈是「远影」——
// 一张盖住方圆一百多米的大影子图，只在人走出几米、或太阳挪了一点的时候才重画一次，平时几乎不花力气。
// 远处的树用一张朝着太阳立起来的剪影片投影（不用把整棵树再画一遍）。
// 只有画质「极高」才开。
import * as THREE from 'three';
import { U } from './atmo.js';

// 给 three 的光照循环打补丁：带 J_SHADOW 的材质，太阳的影子改用 jShadow()（近、远两层接起来）；
// 第二盏方向光只是用来带出远影那张图的，本身不发光，也不参与别的计算
export function installShadows() {
  const C = THREE.ShaderChunk, a = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  if (!C.lights_fragment_begin.includes(a)) { console.warn('[j] shadows: chunk changed'); return false; }
  C.lights_fragment_begin = C.lights_fragment_begin.replace(a, `
		#ifdef J_SHADOW
			#if UNROLLED_LOOP_INDEX == 0
			directLight.color *= ( directLight.visible && receiveShadow ) ? jShadow() : 1.0;
			#endif
		#else
			${a}
		#endif`);
  // 云影：带 J_CLOUD 的材质，太阳光先乘上这一点头顶有没有云（jClK 留着给后面的透光、高光用）
  const b = 'getDirectionalLightInfo( directionalLight, directLight );';
  if (C.lights_fragment_begin.includes(b)) C.lights_fragment_begin = C.lights_fragment_begin.replace(b, `${b}
		#ifdef J_CLOUD
			#if UNROLLED_LOOP_INDEX == 0
			jClK = jCloud( vWP ); directLight.color *= jClK;
			#endif
		#endif`);
  return true;
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _c = new THREE.Vector3();

export class FarShadow {
  constructor(scene) {
    this.scene = scene; this.on = false; this.R = 160; this.size = 4096;
    const L = this.light = new THREE.DirectionalLight(0x000000, 0);
    L.castShadow = true; L.shadow.autoUpdate = false;
    L.shadow.bias = -0.00012; L.shadow.normalBias = 0.22;
    this.cam = L.shadow.camera;
    this.at = new THREE.Vector3(1e9, 0, 0); this.dir = new THREE.Vector3(0, 1, 0);
    this.farOnly = [];
    this.count = 0;       // 重画了几次（调试看）
  }
  // 只往远影里投影的东西（远处树的剪影片）：画近处那张影子图时跳过去
  addFarOnly(mesh) {
    const cam = this.cam; let keep = 0;
    mesh.onBeforeShadow = (r, o, c, sc, geo) => { keep = geo.drawRange.count; if (sc !== cam) geo.drawRange.count = 0; };
    mesh.onAfterShadow = (r, o, c, sc, geo) => { geo.drawRange.count = keep; };
    mesh.castShadow = this.on;
    this.farOnly.push(mesh);
  }
  set(on, R = 160, size = 4096) {
    const L = this.light;
    if (on !== this.on) {
      this.on = on;
      if (on) { this.scene.add(L, L.target); } else { this.scene.remove(L, L.target); L.shadow.map?.dispose(); L.shadow.map = null; }
      for (const m of this.farOnly) m.castShadow = on;
    }
    if (on && (R !== this.R || size !== L.shadow.mapSize.x || !this.ready)) {
      this.R = R; this.ready = true;
      if (size !== L.shadow.mapSize.x) { L.shadow.mapSize.set(size, size); L.shadow.map?.dispose(); L.shadow.map = null; }
      Object.assign(this.cam, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 640 }); this.cam.updateProjectionMatrix();
    }
    U.uFarShadow.value.w = on ? 1 : 0;
    this.at.set(1e9, 0, 0);
  }
  // 每帧调一次：该重画了就把这盏灯挪到新位置，并让它这一帧重画
  update(center, sunDir, force) {
    if (!this.on) return;
    const moved = Math.hypot(center.x - this.at.x, center.z - this.at.z);
    if (!force && moved < 9 && Math.abs(center.y - this.at.y) < 40 && sunDir.dot(this.dir) > 0.999992) return;   // 太阳挪了不到四分之一度
    this.at.copy(center); this.dir.copy(sunDir);
    const texel = 2 * this.R / this.light.shadow.mapSize.x;
    _z.copy(sunDir).normalize(); _x.crossVectors(THREE.Object3D.DEFAULT_UP, _z).normalize(); _y.crossVectors(_z, _x);
    const px = center.dot(_x), py = center.dot(_y);
    _c.copy(center).addScaledVector(_x, Math.round(px / texel) * texel - px).addScaledVector(_y, Math.round(py / texel) * texel - py);
    this.light.target.position.copy(_c); this.light.position.copy(_c).addScaledVector(_z, 320);
    this.light.target.updateMatrixWorld(); this.light.updateMatrixWorld();
    this.light.shadow.needsUpdate = true;
    U.uFarShadow.value.set(center.x, center.z, this.R - 10, 1);
    this.count++;
  }
}

// 远处树的影子：和「替身树」共用一套实例数据，每棵树一张竖着的剪影片，画影子图时转过去正对太阳。
// 平时不画（材质不写颜色也不写深度，顶点全收到屏幕外），只在重画远影那一帧投影。
// 身边三十米内的树有真模型投影，这里跳过，免得影子叠成两层
export function makeTreeShadowCards(impGeo, atlas, nTypes) {
  const hide = new THREE.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }', fragmentShader: 'void main() { discard; }', colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(impGeo, hide);
  mesh.frustumCulled = false; mesh.name = 'treeShadowCards'; mesh.renderOrder = -5;
  mesh.customDepthMaterial = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uFarShadow: U.uFarShadow, uSkip: { value: 27 } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aPos; attribute vec4 aInfo; uniform vec4 uFarShadow; uniform float uSkip; varying vec2 vUv;
      void main() {
        // 影子相机的“右”是水平的：片子竖着立在地上，绕着竖轴正对太阳
        vec3 right = normalize( vec3( viewMatrix[0][0], 0.0, viewMatrix[2][0] ) );
        vec3 wp = aPos.xyz + right * position.x * aPos.w + vec3( 0.0, position.y * aInfo.y, 0.0 );
        vUv = vec2( ( aInfo.x + uv.x ) / ${nTypes.toFixed(1)}, uv.y );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
        float d = length( aPos.xz - uFarShadow.xy );
        if ( d < uSkip || d > uFarShadow.z + 30.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      #include <packing>
      uniform sampler2D uAtlas; varying vec2 vUv;
      void main() {
        if ( texture2D( uAtlas, vUv ).a < 0.4 ) discard;
        gl_FragColor = packDepthToRGBA( gl_FragCoord.z );
      }`,
  });
  return mesh;
}
