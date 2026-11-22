// 蹚水荡开的圈：人的脚、马的蹄子落在水里，水面上一圈白线往外走、慢慢淡掉。
// 最多同时 8 个圈（循环用），溪水和海的着色器里各加一小段；离人远的水面直接跳过，不多花力气。
import { U } from './atmo.js';

export const RIPPLE_GLSL = /* glsl */`
uniform vec4 uRip[ 8 ]; uniform vec4 uRipC;
// 返回 xy = 水面被推歪的方向（加到法线上），z = 圈上的白线有多亮
vec3 jRipples( vec2 xz, float t ) {
  vec3 o = vec3( 0.0 );
  vec2 dc = xz - uRipC.xy;
  if ( uRipC.w < 0.5 || dot( dc, dc ) > uRipC.z * uRipC.z ) return o;
  for ( int i = 0; i < 8; i++ ) {
    vec4 r = uRip[ i ];
    float age = t - r.z;
    if ( age < 0.0 || age > 2.4 || r.w <= 0.0 ) continue;
    vec2 d = xz - r.xy; float dist = length( d );
    float k = min( 1.0, r.w ), life = 1.0 - age / 2.4; life *= life;
    float rad = 0.1 + age * ( 0.7 + 0.35 * r.w ), wd = 0.045 + 0.04 * age;
    float b1 = ( dist - rad ) / wd, b2 = ( dist - rad * 0.55 ) / ( wd * 0.8 );
    float w1 = exp( -b1 * b1 ), w2 = exp( -b2 * b2 ) * 0.55;
    o.z += ( w1 + w2 ) * life * k;
    o.xy -= d / max( dist, 0.02 ) * ( b1 * w1 + b2 * w2 ) * life * k;
  }
  return o;
}`;

export class Ripples {
  constructor() { this.i = 0; U.uRipC.value.w = 1; }
  set on(v) { U.uRipC.value.w = v ? 1 : 0; }
  // 在 (x, z) 荡一圈，k 是力度（0.3 轻轻一点 ~ 1.3 重重一脚）
  add(x, z, k = 1) {
    U.uRip.value[this.i].set(x, z, U.uTime.value, k);
    this.i = (this.i + 1) % 8;
  }
  center(x, z) { U.uRipC.value.x = x; U.uRipC.value.y = z; }
}
