// 大气与光：所有材质共享的太阳、雾（朝太阳方向偏暖）、树影 gobo、阴影边缘渐隐、角色轮廓光、风。
// 用 onBeforeCompile 给 three 的标准材质打补丁，不额外加全屏后期，手机上省一遍像素。
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.2674, 0.2419, -0.9327).normalize() },  // 方位 -16°（北偏西），仰角 14°
  uSunColor: { value: new THREE.Color('#ffd9a8') },
  uFogFar: { value: new THREE.Color('#b4c0dc') },     // 背对太阳的远处
  uFogSun: { value: new THREE.Color('#ffcf98') },     // 朝太阳的远处
  uFogDensity: { value: 0.0019 },
  uFogHeight: { value: 0.035 },
  uFogBase: { value: -2.0 },
  uHaze: { value: 0.00032 },
  uGobo: { value: null },
  uCanopy: { value: null },
  uCanopyBox: { value: new THREE.Vector4(-120, -320, 260, 400) },
  uGoboStrength: { value: 0.85 },
  uShadowCenter: { value: new THREE.Vector3() },
  uShadowRadius: { value: 26 },
  // 画质「低」时关掉地面凹凸、岩壁贴图这些细活（手机上省一截）
  uFine: { value: 1 },
  uWind: { value: 1 },
  // 天气：地面湿了多少（下雨）
  uWet: { value: 0 },
  uSnowCover: { value: 0 },      // 下雪：地上积了多少（0~0.8）
  // 看穿：xyz 是旅人胸口，w 是强度（0 关）。镜头身边、镜头到人之间的枝叶用点阵挖掉
  uSee: { value: new THREE.Vector4(0, -1e4, 0, 0) },
  // 踩过的草：一张跟着人走的小图（rg 往哪边倒，b 倒了多少）。uTreadP = 人的 x、z，1 / 图的边长（米），开关
  uTread: { value: null }, uTreadP: { value: new THREE.Vector4(0, 0, 1 / 25.6, 0) },
  // 蹚水荡开的圈：每个是 x、z、开始的时刻、力度。uRipC = 人的 x、z，多远以内才算，开关
  uRip: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) }, uRipC: { value: new THREE.Vector4(0, 0, 16, 0) },
  // 远处替身树的环境光（天和地两头），跟着一天的光变
  uAmb: { value: new THREE.Color('#9fb0c8') },
  uAmbG: { value: new THREE.Color('#6a6a40') },
};

// 统一调色：ACES 之后再做一点暖色和饱和度（常量，编进所有着色器）
export function installGrade() {
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `vec3 CustomToneMapping( vec3 color ) {
      color = ACESFilmicToneMapping( color );
      float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color = mix( vec3( l ), color, 1.16 );
      color = mix( color, color * color * ( 3.0 - 2.0 * color ), 0.25 );
      // 暗部偏冷紫、亮部偏暖
      color += vec3( -0.006, 0.0, 0.022 ) * ( 1.0 - smoothstep( 0.0, 0.45, l ) );
      color *= vec3( 1.035, 1.0, 0.955 );
      return clamp( color, 0.0, 1.0 );
    }`);
}

// 雾：贴地的指数高度雾（沿视线积分）+ 一层很淡的远景空气感；朝太阳的方向偏暖
const FOG_FN = /* glsl */`
uniform vec3 uFogFar; uniform vec3 uFogSun; uniform float uFogDensity; uniform float uFogHeight; uniform float uFogBase; uniform float uHaze; uniform vec3 uSunDir;
vec3 jFogColor( vec3 dir ) {
  float sd = max( dot( dir, uSunDir ), 0.0 );
  return mix( uFogFar, uFogSun, pow( sd, 5.0 ) * 0.85 + 0.15 * sd );
}
float jFogAmount( vec3 wp ) {
  vec3 d = wp - cameraPosition; float dist = length( d );
  float k = uFogHeight, kdy = k * d.y;
  float integ = abs( kdy ) > 1e-3 ? ( 1.0 - exp( -kdy ) ) / kdy : 1.0 - 0.5 * kdy;
  float od = uFogDensity * dist * exp( -k * max( cameraPosition.y - uFogBase, 0.0 ) ) * integ + uHaze * dist;
  return clamp( 1.0 - exp( -od ), 0.0, 1.0 );
}
vec3 jFog( vec3 col, vec3 wp ) {
  vec3 d = wp - cameraPosition;
  return mix( col, jFogColor( normalize( d ) ), jFogAmount( wp ) );
}`;
export { FOG_FN };

// 草被踩倒：人和马走过的地方查「踩过的草」那张图，草叶往旁边倒下去、矮下去，过一会儿晃两下弹回来。
// k 是倒多少（草丛 1，灌木只是被拨开一点）。只有离人十米以内才查图，远处的草不多花力气
const treadVS = k => `{
            mat3 jIM = mat3( instanceMatrix );
            vec3 jWV = ip + jIM * position;
            vec2 jDC = jWV.xz - uTreadP.xy; float jDD = dot( jDC, jDC );
            if ( uTreadP.w > 0.0 && jDD < 121.0 ) {
              vec4 jT = texture2D( uTread, jWV.xz * uTreadP.z );
              float jA = jT.b * ( 1.0 - smoothstep( 81.0, 121.0, jDD ) );
              if ( jA > 0.004 ) {
                vec2 jD = jT.rg * 2.0 - 1.0;
                vec3 jL = ( vec3( jD.x, 0.0, jD.y ) * jIM ) / max( length( jIM[0] ), 1e-3 );   // 世界里的方向转回这一株自己的坐标
                float jH = max( position.y, 0.0 );
                float jK = jA * ${k.toFixed(2)} * ( 1.0 + 0.3 * sin( uTime * 11.0 + ( ip.x + ip.z ) * 2.7 ) * ( 1.0 - jA ) );
                transformed += jL * jH * jK * 0.95;
                transformed.y -= jH * jK * 0.66;
                jTr = 1.0 - 0.7 * jA;
              }
            }
          }`;

// opts: { gobo, fog, rim, wind: 'tree'|'grass'|null, tread, shadowFade, sss, fadeOut, fadeIn, seeThrough, uniforms }
// seeThrough: 挡在镜头和旅人之间、或贴着镜头的部分按 uSee 挖掉（树、灌木用）
// fadeOut/fadeIn: 用 uniforms 里的 uFadeR（米）按距离抖动淡出/淡入，和远处的替身树衔接
export function patch(mat, opts = {}) {
  const o = { gobo: true, fog: true, rim: 0, wind: null, shadowFade: true, sss: 0, fadeOut: false, fadeIn: false, ...opts };
  const extraU = o.uniforms || {};
  mat.fog = false;
  mat.userData.j = o;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U, extraU);
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uTime; uniform float uWind;${o.tread ? ' uniform sampler2D uTread; uniform vec4 uTreadP;' : ''}`);
    if (o.wind) {
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          float jTr = 1.0;
          #ifdef USE_INSTANCING
            ip = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
            ${o.tread ? treadVS(o.tread) : ''}
          #endif
          float ph = ip.x * 0.37 + ip.z * 0.23;
          ${o.wind === 'tree'
            ? `float w = max( position.y - 0.6, 0.0 ) * 0.016 * uWind;
               transformed.x += ( sin( uTime * 1.3 + ph ) * 0.6 + sin( uTime * 2.9 + ph * 2.0 + position.y ) * 0.25 ) * w;
               transformed.z += sin( uTime * 1.1 + ph * 1.3 ) * 0.4 * w;`
            : `float w = max( position.y, 0.0 ) * 0.12 * uWind * jTr;
               transformed.x += ( sin( uTime * 2.2 + ph ) * 0.7 + sin( uTime * 4.1 + ph * 3.0 ) * 0.3 ) * w;
               transformed.z += sin( uTime * 1.7 + ph * 1.7 ) * 0.5 * w;`}
        }`);
    }
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 wpp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp;
        #endif
        vWP = ( modelMatrix * wpp ).xyz;
      }`);
    fs = fs.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uTime;
      uniform sampler2D uGobo; uniform sampler2D uCanopy; uniform vec4 uCanopyBox; uniform float uGoboStrength; uniform vec3 uSunColor;
      uniform vec3 uShadowCenter; uniform float uShadowRadius; uniform float uFadeR; uniform vec4 uSee;
      float jDither() { return fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ); }
      ${FOG_FN}`);
    // 草叶：两面都按偏向朝上的法线打光（背对镜头的那一面不会黑成一条）
    if (o.grassN) fs = fs.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize( mix( normalize( vNormal ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), ${o.grassN.toFixed(2)} ) );`);
    // 石头顶上：谷地里长青苔，红叶谷落着叶子，雪线上积着雪
    if (o.cover) fs = fs.replace('#include <common>', '#include <common>\nuniform sampler2D uBiome; uniform vec4 uDom; uniform float uSnowCover;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 wn = normalize( ( vec4( normalize( vNormal ), 0.0 ) * viewMatrix ).xyz );
        vec4 bi = texture2D( uBiome, ( vWP.xz - uDom.xy ) / uDom.zw );
        float nn = 0.5 + 0.25 * sin( vWP.x * 5.3 + vWP.z * 3.1 + vWP.y * 2.0 ) + 0.25 * sin( vWP.z * 7.7 - vWP.y * 6.0 + vWP.x * 1.3 );
        float top = smoothstep( 0.42, 0.82, wn.y + ( nn - 0.5 ) * 0.4 );
        vec3 cover = mix( vec3( 0.34, 0.44, 0.17 ), vec3( 0.66, 0.33, 0.12 ), smoothstep( 0.2, 0.6, bi.r ) ) * ( 0.8 + 0.4 * nn );
        float sn = max( smoothstep( 0.2, 0.5, bi.g ), min( 1.0, uSnowCover * 1.2 ) );
        cover = mix( cover, vec3( 0.9, 0.93, 0.97 ), sn );
        diffuseColor.rgb = mix( diffuseColor.rgb, cover, top * mix( 0.6, 0.95, sn ) );
      }`);
    if (o.fadeOut || o.fadeIn) {
      fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float fd = length( vWP.xz - cameraPosition.xz ) - uFadeR;
          float th = ( jDither() - 0.5 ) * 6.0;
          ${o.fadeOut ? 'if ( fd > th ) discard;' : 'if ( fd < th ) discard;'}
        }`);
    }
    if (o.seeThrough) {
      fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if ( uSee.w > 0.0 ) {
          vec3 pc = vWP - cameraPosition, cd = uSee.xyz - cameraPosition;
          float t = dot( pc, cd ) / max( dot( cd, cd ), 1e-2 );
          float dl = length( pc - cd * clamp( t, 0.0, 1.0 ) );
          float a = smoothstep( 1.0, 2.6, length( pc ) );
          float R = mix( 0.5, 1.2, clamp( t, 0.0, 1.0 ) );
          float tube = 1.0 - smoothstep( 0.92, 1.02, t );
          if ( t > 0.0 ) a = min( a, mix( 1.0, smoothstep( R * 0.55, R, dl ), tube ) );
          if ( jDither() > mix( 1.0, a, uSee.w ) ) discard;
        }`);
    }
    if (o.shadowFade) {
      fs = fs.replace('getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
        'mix( 1.0, getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ), 1.0 - smoothstep( uShadowRadius * 0.62, uShadowRadius * 0.95, length( vWP.xz - uShadowCenter.xz ) ) )');
    }
    // 人和动物（带轮廓光的材质）：颜色提亮提纯一点；背光面按天光补一层，不再是一团黑；轮廓光加强
    const toon = o.rim > 0;
    if (toon) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 c0 = diffuseColor.rgb; float l0 = dot( c0, vec3( 0.2126, 0.7152, 0.0722 ) );
        vec3 c1 = mix( vec3( l0 ), c0, 1.25 );
        diffuseColor.rgb = max( mix( c1, sqrt( max( c1, 0.0 ) ) * 0.62, 0.5 ), 0.0 );
      }`);
    let post = '';
    if (toon) post += `
      {
        vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
        float nl = dot( normal, sunV );
        // 明暗分成柔和的两层（手绘感），暗面有天光托着
        float band = smoothstep( -0.05, 0.3, nl );
        reflectedLight.directDiffuse *= mix( 0.75, 1.12, band );
        reflectedLight.indirectDiffuse *= 1.0 + 0.55 * ( 1.0 - band );
        float up = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ).y;
        reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunColor * 0.1 * smoothstep( 0.2, -0.8, up );
      }`;
    if (o.gobo) post += `
      {
        vec2 cuv = ( vWP.xz - uCanopyBox.xy ) / uCanopyBox.zw;
        float canopy = texture2D( uCanopy, cuv ).r;
        vec2 gp = ( vWP.xz + ( 7.0 - vWP.y ) * uSunDir.xz / max( uSunDir.y, 0.2 ) ) * 0.075 + vec2( sin( uTime * 0.45 ) * 0.012, cos( uTime * 0.31 ) * 0.012 );
        float gb = texture2D( uGobo, gp ).r;
        float sh = mix( 1.0, mix( 0.2, 1.0, gb ), canopy * uGoboStrength );
        reflectedLight.directDiffuse *= sh; reflectedLight.directSpecular *= sh;
      }`;
    if (o.rim) post += `
      {
        vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
        float ndv = clamp( dot( normal, geometryViewDir ), 0.0, 1.0 );
        float rim = pow( 1.0 - ndv, 3.0 );
        float back = smoothstep( -0.3, 0.8, dot( -geometryViewDir, sunV ) );
        reflectedLight.directDiffuse += uSunColor * rim * ( 0.12 + 0.9 * back ) * ${(o.rim * (toon ? 1.7 : 1)).toFixed(2)} * diffuseColor.rgb * 2.0;
      }`;
    if (o.sss) post += `
      {
        vec3 vd = normalize( vWP - cameraPosition );
        float bk = pow( max( dot( vd, uSunDir ), 0.0 ), 3.0 );
        reflectedLight.directDiffuse += uSunColor * diffuseColor.rgb * bk * ${o.sss.toFixed(2)};
      }`;
    if (post) fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + post);
    if (o.fog) fs = fs.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb = jFog( gl_FragColor.rgb, vWP );`);
    sh.vertexShader = vs; sh.fragmentShader = fs;
  };
  const key = 'j' + JSON.stringify(o, (k, v) => (k === 'uniforms' ? undefined : v)) + (prev ? prev.toString().length : 0);
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  return mat;
}

// 叶影贴图（gobo）：一片片树叶形状的暗斑，模糊一下（模糊在 JS 里做）
export function makeGobo(blurWrap) {
  const S = 512;
  const c0 = document.createElement('canvas'); c0.width = c0.height = S; const g = c0.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (x, y, s, rot) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const px = x + dx, py = y + dy; if (px < -40 || py < -40 || px > S + 40 || py > S + 40) continue; g.moveTo(px + s, py); g.ellipse(px, py, s, s * 0.62, rot, 0, 6.283); } };
  g.fillStyle = 'rgba(0,0,0,0.9)'; g.beginPath();
  for (let k = 0; k < 15; k++) {
    const cx = rnd() * S, cy = rnd() * S, R = 40 + rnd() * 70;
    for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R; blob(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5 + rnd() * 13, rnd() * 3); }
  }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath();
  for (let i = 0; i < 260; i++) { const x = rnd() * S, y = rnd() * S, r = 1.5 + rnd() * 4.5; for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const px = x + dx, py = y + dy; if (px < -10 || py < -10 || px > S + 10 || py > S + 10) continue; g.moveTo(px + r, py); g.arc(px, py, r, 0, 6.283); } }
  g.fill();
  const d = g.getImageData(0, 0, S, S).data, a = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) a[i] = d[i * 4];
  const b = blurWrap(a, S, 2, 2);
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = b[i]; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
