// 实验：一遍后期。场景先画进高动态范围的画布，亮的地方（太阳、水面反光、被照亮的云）往外晕一圈柔光，再加一点暗角，最后统一调色。
import * as THREE from 'three';

const VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;
const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const o = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.mips = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(4, 4, o));
    this.ups = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(4, 4, o));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false;
    this.sc = new THREE.Scene(); this.sc.add(this.quad);
    // 取亮部并缩小（阈值带软膝）
    this.mPre = mk(/* glsl */`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      vec3 pre( vec2 uv ) { vec3 c = min( texture2D( t, uv ).rgb, vec3( 12.0 ) ); float l = max( c.r, max( c.g, c.b ) ); return c * smoothstep( 0.75, 1.9, l ); }
      void main() { gl_FragColor = vec4( ( pre( vUv + px * vec2( -1.0, -1.0 ) ) + pre( vUv + px * vec2( 1.0, -1.0 ) ) + pre( vUv + px * vec2( -1.0, 1.0 ) ) + pre( vUv + px * vec2( 1.0, 1.0 ) ) ) * 0.25, 1.0 ); }`,
      { t: { value: null }, px: { value: new THREE.Vector2() } });
    this.mDown = mk(/* glsl */`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      void main() { gl_FragColor = vec4( ( texture2D( t, vUv + px * vec2( -1.0, -1.0 ) ).rgb + texture2D( t, vUv + px * vec2( 1.0, -1.0 ) ).rgb + texture2D( t, vUv + px * vec2( -1.0, 1.0 ) ).rgb + texture2D( t, vUv + px * vec2( 1.0, 1.0 ) ).rgb ) * 0.25, 1.0 ); }`,
      { t: { value: null }, px: { value: new THREE.Vector2() } });
    this.mUp = mk(/* glsl */`uniform sampler2D t; uniform sampler2D a; uniform vec2 px; varying vec2 vUv;
      void main() { vec3 s = ( texture2D( t, vUv + px * vec2( -1.0, -1.0 ) ).rgb + texture2D( t, vUv + px * vec2( 1.0, -1.0 ) ).rgb + texture2D( t, vUv + px * vec2( -1.0, 1.0 ) ).rgb + texture2D( t, vUv + px * vec2( 1.0, 1.0 ) ).rgb ) * 0.25;
        gl_FragColor = vec4( s + texture2D( a, vUv ).rgb, 1.0 ); }`,
      { t: { value: null }, a: { value: null }, px: { value: new THREE.Vector2() } });
    this.mOut = mk(/* glsl */`uniform sampler2D t; uniform sampler2D b; uniform float k; varying vec2 vUv;
      void main() {
        vec3 c = texture2D( t, vUv ).rgb + texture2D( b, vUv ).rgb * k;
        vec2 q = vUv - 0.5; c *= 1.0 - 0.38 * smoothstep( 0.25, 0.95, dot( q, q ) * 2.0 );
        gl_FragColor = vec4( c, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`, { t: { value: null }, b: { value: null }, k: { value: 0.16 } }, { toneMapped: true });
  }
  size() {
    const v = this.r.getDrawingBufferSize(new THREE.Vector2());
    if (v.x === this.w && v.y === this.h) return;
    this.w = v.x; this.h = v.y; this.rt.setSize(v.x, v.y);
    this.mips.forEach((m, i) => m.setSize(Math.max(2, v.x >> (i + 2)), Math.max(2, v.y >> (i + 2))));
    this.ups.forEach((m, i) => m.setSize(Math.max(2, v.x >> (i + 2)), Math.max(2, v.y >> (i + 2))));
  }
  pass(mat, src, dst, extra) {
    const k = dst.width > src.width ? 1 : 0.5;
    mat.uniforms.t.value = src.texture; if (mat.uniforms.px) mat.uniforms.px.value.set(k / dst.width, k / dst.height);
    if (extra) mat.uniforms.a.value = extra.texture;
    this.quad.material = mat; this.r.setRenderTarget(dst); this.r.render(this.sc, this.cam);
  }
  render(scene, camera) {
    const r = this.r; this.size();
    r.setRenderTarget(this.rt); r.render(scene, camera);
    const sa = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    const m = this.mips, u = this.ups;
    this.pass(this.mPre, this.rt, m[0]);
    for (let i = 1; i < 4; i++) this.pass(this.mDown, m[i - 1], m[i]);
    this.pass(this.mUp, m[3], u[2], m[2]); this.pass(this.mUp, u[2], u[1], m[1]); this.pass(this.mUp, u[1], u[0], m[0]);
    this.mOut.uniforms.t.value = this.rt.texture; this.mOut.uniforms.b.value = u[0].texture;
    this.quad.material = this.mOut; r.setRenderTarget(null); r.render(this.sc, this.cam);
    r.shadowMap.autoUpdate = sa;
  }
}
