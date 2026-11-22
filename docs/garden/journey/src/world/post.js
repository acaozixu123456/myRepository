// 一遍后期：场景先画进高动态范围的画布，亮的地方（太阳、水面反光、被照亮的云）往外晕一圈柔光，再加一点暗角，最后统一调色。
// 画质「极高」再加一层「贴地的暗」（ao）：照着深度图找出凹进去、挨在一起的地方（树根、石头脚下、草丛里、人和马身下），压暗一点、偏冷一点，东西就像真的站在地上。
// 再加一层「光柱」：顺着每个像素的视线一小步一小步往前走，看这一段空气有没有被太阳照到（查远影那张图，再看头顶有没有云），
// 照到的加起来就是空气里那层亮——树挡住的地方暗、树缝里漏下来的地方亮，朝着太阳看就是一道一道的光。
import * as THREE from 'three';
import { U, CLOUD_FN } from './atmo.js';
import { SSRU } from './ssr.js';

const VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;
const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

export class Post {
  constructor(renderer) {
    this.r = renderer;
    // 要能往半浮点画布上画（老设备没有这个扩展就不开后期）
    const gl = renderer.getContext();
    this.ok = !!(renderer.capabilities.isWebGL2 !== false && (gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float')));
    if (!this.ok) return;
    const o = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.ao = false;
    const o8 = { depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.aoA = new THREE.WebGLRenderTarget(4, 4, o8); this.aoB = new THREE.WebGLRenderTarget(4, 4, o8);
    const AO_COMMON = /* glsl */`uniform sampler2D tD; uniform mat4 uPI; uniform vec2 px; varying vec2 vUv;
      vec3 vpos( vec2 uv ) { float d = texture2D( tD, uv ).x; vec4 p = uPI * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); return p.xyz / p.w; }`;
    // 每个像素在身边一圈（世界里约 1.3 米）取十几个点，看有多少挡在它前面
    this.mAO = mk(AO_COMMON + /* glsl */`
      uniform float uR; uniform float uProj; uniform float uAspect; uniform sampler2D tC;
      void main() {
        float d0 = texture2D( tD, vUv ).x;
        if ( d0 >= 0.99999 ) { gl_FragColor = vec4( 1.0, 1.0, 0.0, 1.0 ); return; }
        vec3 P = vpos( vUv );
        float far = smoothstep( 150.0, 90.0, -P.z );
        if ( far <= 0.0 ) { gl_FragColor = vec4( 1.0, 1.0, 0.0, 1.0 ); return; }
        vec3 a = vpos( vUv + vec2( px.x, 0.0 ) ) - P, b = P - vpos( vUv - vec2( px.x, 0.0 ) );
        vec3 c = vpos( vUv + vec2( 0.0, px.y ) ) - P, e = P - vpos( vUv - vec2( 0.0, px.y ) );
        vec3 N = normalize( cross( abs( a.z ) < abs( b.z ) ? a : b, abs( c.z ) < abs( e.z ) ? c : e ) );
        // 半径随远近变：近处 0.6 米，远处放大到两米多（远处的树、石头脚下才看得出来）。
        // 草丛、花草不算遮挡，自己也只压一点点（它们在画面的透明度那一格里记了 0），草地才不会被压得发灰
        float R = uR * clamp( -P.z * 0.07, 0.45, 1.8 );
        float rUv = min( R * uProj / -P.z, 0.12 );
        float ang = 6.2832 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        float occ = 0.0;
        for ( int i = 0; i < 14; i++ ) {
          float t = ( float( i ) + 0.5 ) / 14.0, an = ang + t * 6.2832 * 5.0;
          vec2 uv = vUv + vec2( cos( an ) / uAspect, sin( an ) ) * rUv * sqrt( t );
          vec3 v = vpos( uv ) - P; float vv = dot( v, v ), vn = dot( v, N );
          float f = max( R * R - vv, 0.0 ) / ( R * R );
          occ += f * f * f * max( ( vn - 0.04 * R ) / ( vv + 0.006 * R * R ), 0.0 ) * R * texture2D( tC, uv ).a;
        }
        float ao = clamp( 1.0 - occ * ( 5.5 / 14.0 ), 0.0, 1.0 ); ao = ao * ao * ( 3.0 - 2.0 * ao );
        gl_FragColor = vec4( mix( 1.0, ao, far * mix( 0.2, 1.0, texture2D( tC, vUv ).a ) ), clamp( -P.z / 200.0, 0.0, 1.0 ), 0.0, 1.0 );
      }`, { tD: { value: null }, uPI: { value: new THREE.Matrix4() }, px: { value: new THREE.Vector2() }, uR: { value: 1.3 }, tC: { value: null }, uProj: { value: 1 }, uAspect: { value: 1 } });
    // 顺着深度抹匀（不越过远近差很多的边）
    this.mAOBlur = mk(/* glsl */`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main() {
        vec4 c = texture2D( t, vUv ); float s = c.x * 0.2, w = 0.2;
        for ( int i = 1; i <= 4; i++ ) {
          float k = 0.2 - 0.035 * float( i );
          for ( int j = 0; j < 2; j++ ) {
            vec2 q = texture2D( t, vUv + dir * float( i ) * ( j == 0 ? 1.0 : -1.0 ) ).xy;
            float wk = k * max( 0.0, 1.0 - abs( q.y - c.y ) * 200.0 / ( 1.0 + c.y * 40.0 ) );
            s += q.x * wk; w += wk;
          }
        }
        gl_FragColor = vec4( s / w, c.yzw );
      }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
    // 光柱：半大小，每个像素沿视线走 20 步（最远 150 米），每步错开一点，再抹匀
    this.rays = false; this.rayK = 1; this.rayLight = null;
    this.ryA = new THREE.WebGLRenderTarget(4, 4, o); this.ryB = new THREE.WebGLRenderTarget(4, 4, o);
    // 抹匀以后的那张带一串缩小图：合成时拿很糊的一层当「这一片平均照到多少」
    this.ryC = new THREE.WebGLRenderTarget(4, 4, { ...o, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
    this.mRay = mk(/* glsl */`
      #include <packing>
      uniform sampler2D tD; uniform sampler2D tS; uniform mat4 uPI; uniform mat4 uVW; uniform mat4 uSMV; uniform vec3 uCam; uniform vec3 uSunDir;
      uniform vec4 uFarShadow; uniform float uFogHeight; uniform float uFogBase; uniform float uSig;
      varying vec2 vUv;
      ${CLOUD_FN}
      void main() {
        float d = texture2D( tD, vUv ).x;
        vec4 p = uPI * vec4( vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); vec3 P = p.xyz / p.w;
        float dist = length( P ); vec3 dv = P / dist;
        float L = min( dist, 150.0 );
        vec3 dw = mat3( uVW ) * dv;
        vec3 s0 = ( uSMV * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz, s1 = ( uSMV * vec4( dv * L, 1.0 ) ).xyz;
        float jit = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        float acc = 0.0, full = 0.0;
        for ( int i = 0; i < 24; i++ ) {
          float t = ( float( i ) + jit ) / 24.0;
          vec3 sc = mix( s0, s1, t ), wp = uCam + dw * ( L * t );
          float lit = 1.0;
          if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) {
            float kF = 1.0 - smoothstep( uFarShadow.z * 0.8, uFarShadow.z * 0.97, length( wp.xz - uFarShadow.xy ) );
            lit = mix( 1.0, step( sc.z, unpackRGBAToDepth( texture2D( tS, sc.xy ) ) ), kF );
          }
          lit *= jCloud( wp );
          // 空气贴着地面浓、往高处淡；远处的被近处的空气挡掉一些
          float dens = ( 0.3 + 0.7 * exp( -uFogHeight * max( wp.y - uFogBase, 0.0 ) ) ) * exp( -uSig * L * t );
          acc += lit * dens; full += dens;
        }
        // 朝着太阳看最亮，侧着看只剩一点
        float c = dot( dw, uSunDir );
        float ph = 0.75 * pow( 0.09 / ( 1.49 - 1.4 * c ), 1.5 ) + 0.25 * pow( 0.64 / ( 1.04 - 0.4 * c ), 1.5 ) * 0.3 + 0.03;
        float k = ph * 0.04 * L / 24.0;
        // 照到的那部分亮、远近（抹匀时用）、照到的占几成、全都照到的话有多亮
        gl_FragColor = vec4( acc * k, clamp( dist / 200.0, 0.0, 1.0 ), acc / max( full, 1e-4 ), full * k );
      }`, { tD: { value: null }, tS: { value: null }, uPI: { value: new THREE.Matrix4() }, uVW: { value: new THREE.Matrix4() }, uSMV: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
      uSunDir: U.uSunDir, uFarShadow: U.uFarShadow, uFogHeight: U.uFogHeight, uFogBase: U.uFogBase, uSig: { value: 0.002 }, uCloudTex: U.uCloudTex, uCloud: U.uCloud });
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
    this.mOut = mk(/* glsl */`uniform sampler2D t; uniform sampler2D b; uniform sampler2D tAO; uniform float uAO; uniform float k; uniform sampler2D tRay; uniform vec3 uRay; uniform float uRayOn; uniform float uRayK; uniform float uRayB; varying vec2 vUv;
      void main() {
        vec3 c = texture2D( t, vUv ).rgb;
        // 贴地的暗：压暗的同时往冷紫偏一点（和影子里的天光一个调子），不是简单变黑
        if ( uAO > 0.0 ) { float ao = texture2D( tAO, vUv ).x; c *= mix( vec3( 1.0 ), mix( vec3( 0.36, 0.34, 0.5 ), vec3( 1.0 ), ao ), uAO ); }
        if ( uRayOn > 0.0 ) {
          // 雾里本来就算了一层「全都照到」的亮，这里只管差别：比周围一片照到得多的地方（树缝里漏下来的光、云缝底下）再亮起来，
          // 照到得少的地方（树后面、云底下）把那层亮收回去一些。空旷的地方到处都照到，就几乎不加——不会平白蒙一层
          vec4 ra = texture2D( tRay, vUv );
          float ry = ( ra.x - uRayB * textureLod( tRay, vUv, 5.0 ).z * ra.w ) * uRayK;
          if ( uRayOn > 1.5 ) c = vec3( 0.18 );   // 调试：只看光柱那一层
          c = ry > 0.0 ? c + uRay * ( 1.0 - exp( -ry ) ) : c * ( 1.0 - 0.5 * ( 1.0 - exp( ry * 2.5 ) ) );
        }
        c += texture2D( b, vUv ).rgb * k;
        if ( uAO > 1.5 ) c = vec3( texture2D( tAO, vUv ).x ) * 0.8;   // 调试：只看那层暗
        vec2 q = vUv - 0.5; c *= 1.0 - 0.38 * smoothstep( 0.25, 0.95, dot( q, q ) * 2.0 );
        gl_FragColor = vec4( c, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`, { t: { value: null }, b: { value: null }, tAO: { value: null }, uAO: { value: 0 }, k: { value: 0.16 }, tRay: { value: null }, uRay: { value: new THREE.Color() }, uRayOn: { value: 0 }, uRayK: { value: 1 }, uRayB: { value: 0.85 } }, { toneMapped: true });
  }
  // 「贴地的暗」要读深度图：第一次打开时才给画布配上（不开的档位、手机上不多这份开销）
  setAO(on) { this.ao = !!on; this.needDepth(); this.ao = this.ao && this.aoOK !== false; }
  // 水面的真倒影（见 world/ssr.js）：画面分两遍画，先画岸上的，再画水和排在水后面的那些半透明的东西
  setWater(on) {
    // 有的设备把多重采样直接做在贴图上，那样一边画一边读同一张图是不行的，就不开
    this.water = !!on && this.ok && !this.r.extensions.has('WEBGL_multisampled_render_to_texture');
    this.needDepth(); this.water = this.water && this.aoOK !== false; this.scanT = 0;
    if (!this.water) SSRU.uSSon.value = 0;
  }
  // 灯两遍都要在；排在水后面画的半透明的东西（水、水雾、雨、萤火虫……）挪到第二遍
  scan(scene) {
    scene.traverse(o => {
      if (o.isLight) o.layers.enable(1);
      else if (o.renderOrder >= 2 && o.material && o.material.transparent && o.layers.mask === 1) o.layers.set(1);
    });
  }
  // 光柱：light 是带出远影那张图的那盏灯
  setRays(on, light) { this.rays = !!on && !!light; this.rayLight = light || null; this.needDepth(); this.rays = this.rays && this.aoOK !== false; }
  needDepth() {
    if (!this.ok || this.aoOK === false) return;
    if ((this.ao || this.rays || this.water) && !this.rt.depthTexture) {
      const d = new THREE.DepthTexture(this.rt.width, this.rt.height); d.type = THREE.UnsignedIntType; d.minFilter = d.magFilter = THREE.NearestFilter;
      this.rt.depthTexture = d; this.rt.dispose();
      // 这台设备配不上深度图就算了：摘掉，照原来的画
      const gl = this.r.getContext(); this.r.setRenderTarget(this.rt);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { this.aoOK = false; this.ao = this.rays = this.water = false; this.rt.depthTexture = null; d.dispose(); this.rt.dispose(); }
      this.r.setRenderTarget(null);
    }
  }
  size() {
    const v = this.r.getDrawingBufferSize(new THREE.Vector2());
    if (v.x === this.w && v.y === this.h) return;
    this.w = v.x; this.h = v.y; this.rt.setSize(v.x, v.y);
    this.mips.forEach((m, i) => m.setSize(Math.max(2, v.x >> (i + 2)), Math.max(2, v.y >> (i + 2))));
    this.ups.forEach((m, i) => m.setSize(Math.max(2, v.x >> (i + 2)), Math.max(2, v.y >> (i + 2))));
    for (const t of [this.aoA, this.aoB, this.ryA, this.ryB, this.ryC]) t.setSize(Math.max(2, v.x >> 1), Math.max(2, v.y >> 1));
    if (this.checked) return;
    // 头一回：确认这几块画布这台设备真的能用，不行就永久关掉（外面会改回直接画）
    this.checked = true;
    const gl = this.r.getContext();
    for (const t of [this.rt, this.mips[0]]) { this.r.setRenderTarget(t); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.ok = false; }
    this.r.setRenderTarget(null);
  }
  pass(mat, src, dst, extra) {
    const k = dst.width > src.width ? 1 : 0.5;
    mat.uniforms.t.value = src.texture; if (mat.uniforms.px) mat.uniforms.px.value.set(k / dst.width, k / dst.height);
    if (extra) mat.uniforms.a.value = extra.texture;
    this.quad.material = mat; this.r.setRenderTarget(dst); this.r.render(this.sc, this.cam);
  }
  render(scene, camera) {
    const r = this.r; this.size();
    if (!this.ok) { r.render(scene, camera); return; }
    const sa = r.shadowMap.autoUpdate;
    if (this.water && this.rt.depthTexture) {
      if (--this.scanT <= 0) { this.scan(scene); this.scanT = 90; }
      const mask = camera.layers.mask, ac = r.autoClear;
      // 第一遍：岸上的东西
      SSRU.uSSon.value = 0; camera.layers.set(0); r.setRenderTarget(this.rt); r.render(scene, camera);
      // 第二遍：水。上一遍的画面和远近图已经在贴图里了，接着在同一张画布上画
      SSRU.tSSc.value = this.rt.texture; SSRU.tSSd.value = this.rt.depthTexture; SSRU.uSSres.value.set(this.rt.width, this.rt.height);
      SSRU.uSSproj.value.copy(camera.projectionMatrix); SSRU.uSSprojI.value.copy(camera.projectionMatrixInverse); SSRU.uSSon.value = 1;
      camera.layers.set(1); r.autoClear = false; r.shadowMap.autoUpdate = false;
      r.render(scene, camera);
      r.autoClear = ac; camera.layers.mask = mask; SSRU.uSSon.value = 0;
    } else { r.setRenderTarget(this.rt); r.render(scene, camera); }
    r.shadowMap.autoUpdate = false;
    const m = this.mips, u = this.ups;
    // 贴地的暗：半大小算一遍，横竖各抹一遍
    const useAO = this.ao && !!this.rt.depthTexture;
    if (useAO) {
      const A = this.mAO.uniforms, w = this.aoA.width, h = this.aoA.height;
      A.tD.value = this.rt.depthTexture; A.tC.value = this.rt.texture; A.uPI.value.copy(camera.projectionMatrixInverse); A.px.value.set(1 / w, 1 / h);
      A.uProj.value = camera.projectionMatrix.elements[5] * 0.5; A.uAspect.value = w / h;
      this.quad.material = this.mAO; r.setRenderTarget(this.aoA); r.render(this.sc, this.cam);
      const B = this.mAOBlur.uniforms;
      B.t.value = this.aoA.texture; B.dir.value.set(1 / w, 0); this.quad.material = this.mAOBlur; r.setRenderTarget(this.aoB); r.render(this.sc, this.cam);
      B.t.value = this.aoB.texture; B.dir.value.set(0, 1 / h); r.setRenderTarget(this.aoA); r.render(this.sc, this.cam);
    }
    this.mOut.uniforms.tAO.value = this.aoA.texture; this.mOut.uniforms.uAO.value = useAO ? (this.aoDebug ? 2 : 1) : 0;
    // 光柱
    const smap = this.rayLight?.shadow.map, useRay = this.rays && !!this.rt.depthTexture && !!smap && this.rayK > 0.001;
    if (useRay) {
      const R = this.mRay.uniforms, w = this.ryA.width, h = this.ryA.height;
      R.tD.value = this.rt.depthTexture; R.tS.value = smap.texture; R.uPI.value.copy(camera.projectionMatrixInverse); R.uVW.value.copy(camera.matrixWorld);
      R.uSMV.value.multiplyMatrices(this.rayLight.shadow.matrix, camera.matrixWorld); R.uCam.value.setFromMatrixPosition(camera.matrixWorld);
      // 镜头这个高度上空气有多浓（和雾用的是同一套数）
      const sig = R.uSig.value = U.uFogDensity.value * Math.exp(-U.uFogHeight.value * Math.max(R.uCam.value.y - U.uFogBase.value, 0)) + U.uHaze.value;
      this.quad.material = this.mRay; r.setRenderTarget(this.ryA); r.render(this.sc, this.cam);
      const B = this.mAOBlur.uniforms;
      B.t.value = this.ryA.texture; B.dir.value.set(1 / w, 0); this.quad.material = this.mAOBlur; r.setRenderTarget(this.ryB); r.render(this.sc, this.cam);
      B.t.value = this.ryB.texture; B.dir.value.set(0, 1 / h); r.setRenderTarget(this.ryC); r.render(this.sc, this.cam);
      // 空气越浓（清晨、起雾）光柱越明显，但有个上限
      this.mOut.uniforms.uRay.value.copy(U.uSunColor.value); this.mOut.uniforms.uRayK.value = this.rayK * Math.min(2.6, 0.45 + sig / 0.0022);
      if (this.rayBase !== undefined) this.mOut.uniforms.uRayB.value = this.rayBase;
    }
    this.mOut.uniforms.tRay.value = this.ryC.texture; this.mOut.uniforms.uRayOn.value = useRay ? (this.rayDebug ? 2 : 1) : 0;
    this.pass(this.mPre, this.rt, m[0]);
    for (let i = 1; i < 4; i++) this.pass(this.mDown, m[i - 1], m[i]);
    this.pass(this.mUp, m[3], u[2], m[2]); this.pass(this.mUp, u[2], u[1], m[1]); this.pass(this.mUp, u[1], u[0], m[0]);
    this.mOut.uniforms.t.value = this.rt.texture; this.mOut.uniforms.b.value = u[0].texture;
    this.quad.material = this.mOut; r.setRenderTarget(null); r.render(this.sc, this.cam);
    r.shadowMap.autoUpdate = sa;
  }
}
