// 冰湖的冰面：一块平的椭圆，透出下面深蓝绿的湖水，有白色的冰裂纹、一片片霜和积雪，
// 光滑的地方映着天空，逆光时亮闪闪的。冰面下的湖底比冰低一点，湖岸的地面从冰面下面冒出来，就是湖岸线。
import * as THREE from 'three';
import { LAKE } from './route.js';
import { ICE_Q } from './land.js';
import { patch } from './atmo.js';
import { SKY } from './sky.js';

export function buildIce() {
  const rings = 14, segs = 96, pos = [], q = [], idx = [];
  pos.push(LAKE.x, LAKE.y, LAKE.z); q.push(0);
  for (let r = 1; r <= rings; r++) {
    const t = (r / rings) * ICE_Q;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2, u = Math.cos(a) * LAKE.a * t, v = Math.sin(a) * LAKE.b * t;
      pos.push(LAKE.x + u * LAKE.ax - v * LAKE.az, LAKE.y, LAKE.z + u * LAKE.az + v * LAKE.ax); q.push(t);
    }
  }
  for (let i = 0; i < segs; i++) idx.push(0, 1 + (i + 1) % segs, 1 + i);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs, b0 = 1 + r * segs;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % segs;
      idx.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('aQ', new THREE.Float32BufferAttribute(q, 1));
  geo.setIndex(idx);
  // 三角形朝上
  { const P = geo.attributes.position, a = new THREE.Vector3().fromBufferAttribute(P, idx[0]), b = new THREE.Vector3().fromBufferAttribute(P, idx[1]), c = new THREE.Vector3().fromBufferAttribute(P, idx[2]);
    if (b.sub(a).cross(c.sub(a)).y < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); } }
  geo.computeBoundingSphere();

  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uni = { uMid: SKY.uMid, uZenith: SKY.uZenith };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aQ; varying float vQ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvQ = aQ;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uMid; uniform vec3 uZenith; varying float vQ;
      float iH( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
      float iN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( iH( i ), iH( i + vec2( 1, 0 ) ), f.x ), mix( iH( i + vec2( 0, 1 ) ), iH( i + 1.0 ), f.x ), f.y ); }
      vec2 iH2( vec2 p ) { return vec2( iH( p ), iH( p + 17.3 ) ); }
      // 冰裂纹：沃罗诺伊格子的边
      float iCrack( vec2 p ) {
        vec2 i = floor( p ), f = fract( p ); float d1 = 8.0, d2 = 8.0;
        for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) {
          vec2 g = vec2( float( x ), float( y ) ), r = g + iH2( i + g ) - f; float d = dot( r, r );
          if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) d2 = d;
        }
        return 1.0 - smoothstep( 0.0, 0.05, sqrt( d2 ) - sqrt( d1 ) );
      }
      float iFrost;`)
      .replace('#include <map_fragment>', `
      {
        vec2 p = vWP.xz;
        float n1 = iN( p * 0.045 ), n2 = iN( p * 0.21 + 7.0 ), n3 = iN( p * 1.3 - 3.0 );
        vec3 deep = vec3( 0.08, 0.3, 0.38 ), pale = vec3( 0.5, 0.72, 0.78 ), snow = vec3( 0.9, 0.93, 0.97 );
        // 清透的青冰和发白的霜冰一片一片的
        float frost = smoothstep( 0.5, 0.8, n1 * 0.7 + n2 * 0.3 );
        vec3 c = mix( deep, pale, frost ) * ( 0.92 + 0.16 * n3 );
        // 冰里的气泡
        c = mix( c, pale * 1.1, step( 0.93, iN( p * 6.0 ) ) * ( 1.0 - frost ) * 0.6 );
        // 裂纹：大的几条 + 细的一片
        float cr = iCrack( p * 0.09 + n2 * 0.6 ) * 0.9 + iCrack( p * 0.33 + n1 * 1.4 ) * 0.45;
        c = mix( c, vec3( 0.88, 0.94, 0.98 ), clamp( cr, 0.0, 1.0 ) * ( 0.55 + 0.45 * ( 1.0 - frost ) ) );
        // 湖边和几片风吹过来的积雪
        float drift = smoothstep( 0.86, 1.04, vQ + ( n2 - 0.5 ) * 0.25 ) + smoothstep( 0.72, 0.86, n1 * 0.55 + n3 * 0.2 + n2 * 0.25 ) * 0.8;
        drift = clamp( drift, 0.0, 1.0 );
        iFrost = max( frost * 0.6, drift );
        diffuseColor.rgb = mix( c, snow * ( 0.94 + 0.08 * n3 ), drift );
      }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // 光滑的冰面映着天，逆光时太阳的高光
        vec3 V = normalize( cameraPosition - vWP );
        vec3 N = normalize( vec3( ( iN( vWP.xz * 0.7 ) - 0.5 ) * 0.05, 1.0, ( iN( vWP.xz * 0.7 + 9.0 ) - 0.5 ) * 0.05 ) );
        vec3 R = reflect( -V, N );
        vec3 sky = mix( jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) ), mix( uMid, uZenith, 0.5 ), smoothstep( 0.02, 0.3, R.y ) );
        float fres = 0.04 + 0.96 * pow( 1.0 - max( dot( V, N ), 0.0 ), 5.0 );
        float gloss = 1.0 - iFrost;
        reflectedLight.indirectDiffuse += sky * fres * mix( 0.15, 0.55, gloss );
        float sp = pow( max( dot( reflect( -uSunDir, N ), V ), 0.0 ), 160.0 );
        reflectedLight.directDiffuse += uSunColor * sp * 3.0 * gloss;
        // 霜和雪上碎碎的闪光
        float gl = step( 0.985, iH( floor( vWP.xz * 9.0 ) ) ) * pow( max( dot( reflect( -uSunDir, vec3( 0.0, 1.0, 0.0 ) ), V ), 0.0 ), 6.0 );
        reflectedLight.directDiffuse += uSunColor * gl * 2.5 * iFrost;
      }`);
  };
  patch(mat, { gobo: false, fog: true, shadowFade: true });
  mat.customProgramCacheKey = () => 'ice';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ice'; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
  return mesh;
}
