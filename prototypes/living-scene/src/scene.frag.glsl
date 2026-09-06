precision highp float;
varying vec2 vUv;
uniform sampler2D uHero,uBack,uDepth,uSemanticA,uSemanticB,uGlow;
uniform vec2 uCover,uPointer,uFocusOffset,uHoverPoint;
uniform float uTime,uPush,uHover,uLocalGlow,uHoverKind;
void main(){
 vec2 uv=(vUv-.5)*uCover/(1.035+uPush*.045)+.5+uFocusOffset;
 float d=texture2D(uDepth,uv).r;
 vec2 p=uv+uPointer*vec2(.006,.003)*(d-.20);
 d=texture2D(uDepth,p).r;
 p=uv+uPointer*vec2(.006,.003)*(d-.20);
 vec3 objects=texture2D(uSemanticA,p).rgb;
 vec3 zones=texture2D(uSemanticB,p).rgb;
 // A shared slow light rhythm is reflected in wet stone as well as its source.
 float lamp=.014*sin(uTime*.77)+.009*sin(uTime*.31);
 vec2 road=vec2(sin(p.y*130.+uTime*.48)*.00020,sin(p.x*90.+uTime*.38)*.00008)*zones.r;
 vec2 air=vec2(sin(p.y*95.+uTime*.37)*.00012,0.)*zones.b;
 vec3 col=texture2D(uBack,clamp(p+road+air,vec2(.002),vec2(.998))).rgb;
 // Original foreground pixels move over a repaired, narrowly bounded edge collar.
 float wind=sin(uTime*.64)*.72+sin(uTime*.31)*.28;
 vec2 leafUv=p+vec2(wind*.00060,wind*.00027)*(0.55+0.45*sin(p.x*3.));
 float alpha=texture2D(uSemanticA,leafUv).r;
 col=mix(col,texture2D(uHero,leafUv).rgb,alpha);
 col*=1.+lamp*(objects.g*.65+objects.b+zones.r*.72);
 float response=0.;
 if(uHoverKind<.5) response=objects.g*.055+objects.b*.035+zones.r*.025;
 else if(uHoverKind<1.5) response=zones.r*.07;
 else if(uHoverKind<2.5) response=objects.b*.08;
 else if(uHoverKind<3.5) response=objects.r*.045;
 else response=zones.g*.045;
 float nearby=1.-smoothstep(.05,.24,length((p-uHoverPoint)*vec2(1.,.7)));
 col*=1.+uHover*response*nearby;
 // Slow horizontal variation restricted to the authored distant opening.
 float drift=.5+.5*sin(p.x*32.-uTime*.10+sin(p.y*20.+uTime*.08));
 col=mix(col,vec3(.26,.36,.43),zones.g*(.005+.012*drift));
 col+=texture2D(uGlow,p).rgb*.12*uLocalGlow*(1.+lamp);
 gl_FragColor=vec4(col,1.);
}
