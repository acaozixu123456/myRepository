// 水面的倒影和水下的样子（画质「极高」）：画水之前，岸上的东西已经画好了，把那张画面和它的远近图交给水的着色器——
// 倒影：从水面这一点顺着反射的方向一步步找，撞到画面里的什么（对岸的树、石头、人和马）就映什么；
//       没撞到近处的东西，就看这个方向的远处在画面上是哪（天上的云、远山），映它；画面外的才用原来估的天色。
// 水下：直接取画面上原来这一点（河床、水里的石头），跟着水波晃一晃；按真正的水深上色、起白沫。
// 这些数由 world/post.js 每帧填。
import * as THREE from 'three';

export const SSRU = {
  tSSc: { value: null }, tSSd: { value: null }, uSSon: { value: 0 },
  uSSproj: { value: new THREE.Matrix4() }, uSSprojI: { value: new THREE.Matrix4() }, uSSres: { value: new THREE.Vector2(1, 1) },
};

export const SSR_GLSL = /* glsl */`
uniform sampler2D tSSc; uniform sampler2D tSSd; uniform float uSSon; uniform mat4 uSSproj; uniform mat4 uSSprojI; uniform vec2 uSSres;
// 画面上这一点原来的东西在哪（视图空间）
vec3 jSSvp( vec2 uv ) { float d = textureLod( tSSd, uv, 0.0 ).x; vec4 p = uSSprojI * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); return p.xyz / p.w; }
// 太亮的地方（太阳边上的天）压一压，不然水面一片白
vec3 jSSsoft( vec3 c ) { float l = max( c.r, max( c.g, c.b ) ); return c * ( 1.0 / ( 1.0 + max( l - 1.0, 0.0 ) * 0.45 ) ); }
float jSSedge( vec2 uv ) { vec2 e = smoothstep( 0.0, 0.07, uv ) * smoothstep( 1.0, 0.93, uv ); return e.x * e.y; }
// 倒影：Pv 水面这一点、Rv 反射方向（都在视图空间），jit 0~1 每个像素错开一点。返回颜色和有几成可信
vec4 jSSR( vec3 Pv, vec3 Rv, float jit ) {
  float t = 0.0, dt = 0.3, pt = 0.0;
  for ( int i = 0; i < 26; i++ ) {
    pt = t; t += dt * ( i == 0 ? 0.4 + jit : 1.0 ); dt *= 1.17;
    vec3 p = Pv + Rv * t;
    if ( p.z > -0.31 ) return vec4( 0.0 );
    vec4 c = uSSproj * vec4( p, 1.0 ); vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) return vec4( 0.0 );
    float dz = jSSvp( uv ).z - p.z;
    if ( dz > 0.0 && dz < ( t - pt ) * 1.5 + 0.5 ) {
      // 撞到了：在这一步里再对半找几次，找准一点
      float a = pt, b = t;
      for ( int k = 0; k < 4; k++ ) {
        float m = 0.5 * ( a + b ); vec3 q = Pv + Rv * m; vec4 cq = uSSproj * vec4( q, 1.0 ); vec2 u2 = cq.xy / cq.w * 0.5 + 0.5;
        if ( jSSvp( u2 ).z > q.z ) b = m; else a = m;
        uv = u2;
      }
      return vec4( jSSsoft( textureLod( tSSc, uv, 0.0 ).rgb ), jSSedge( uv ) );
    }
  }
  vec4 c = uSSproj * vec4( Rv, 0.0 );
  if ( c.w <= 0.0 ) return vec4( 0.0 );
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) return vec4( 0.0 );
  return vec4( jSSsoft( textureLod( tSSc, uv, 0.0 ).rgb ), jSSedge( uv ) * smoothstep( 60.0, 140.0, -jSSvp( uv ).z ) );
}
// 水下：uv 这个像素、Pv 水面这一点、n 水波把视线推歪多少。返回水底的颜色和这一段水有多厚（沿视线，米）
vec4 jSSbed( vec2 uv, vec3 Pv, vec2 n ) {
  float l0 = length( Pv ), th = length( jSSvp( uv ) ) - l0;
  vec2 u2 = clamp( uv + n * clamp( th, 0.0, 1.2 ) / ( 1.0 + l0 * 0.06 ), 0.002, 0.998 );
  float th2 = length( jSSvp( u2 ) ) - l0;
  if ( th2 > 0.0 ) { uv = u2; th = th2; }     // 推歪以后那一点如果在水面前面（岸、人的腿），就不推
  return vec4( textureLod( tSSc, uv, 0.0 ).rgb, max( th, 0.0 ) );
}`;
