precision highp float;
varying vec2 vUv;
uniform sampler2D uRest,uAlert,uContent;
uniform float uTime,uPose,uContentMix,uBlink,uGaze,uEar,uFade;
float zone(vec2 p,vec2 c,vec2 r){return exp(-dot((p-c)/r,(p-c)/r)*2.);}
void main(){
 vec2 p=vUv;
 float chest=zone(p,vec2(.47,.34),vec2(.35,.28));
 p.y-=sin(uTime*1.7)*.0017*chest;
 float head=zone(p,vec2(.29,.56),vec2(.23,.33));
 p.x-=uGaze*.004*head;
 float ears=zone(p,vec2(.13,.76),vec2(.08,.13))+zone(p,vec2(.44,.78),vec2(.09,.14));
 p.x+=sin(uTime*4.8)*uEar*.0035*ears;
 float tail=zone(p,vec2(.71,.25),vec2(.27,.105))*(1.-smoothstep(.72,.96,p.x));
 p.y+=sin(uTime*.64)*.0045*tail;
 vec4 rest=texture2D(uRest,p), alert=texture2D(uAlert,p), closed=texture2D(uContent,p);
 vec4 col=mix(rest,alert,uPose);
 // Closed-eye paint is registered independently onto the two eye regions.
 vec2 l=mix(vec2(.238,.579),vec2(.234,.644),uPose);
 vec2 r=mix(vec2(.375,.593),vec2(.37,.647),uPose);
 float le=zone(p,l,vec2(.047,.030)),re=zone(p,r,vec2(.045,.030));
 vec4 lc=texture2D(uContent,p-l+vec2(.250,.657));
 vec4 rc=texture2D(uContent,p-r+vec2(.388,.661));
 col.rgb=mix(col.rgb,lc.rgb,smoothstep(.06,.40,le)*uBlink);
 col.rgb=mix(col.rgb,rc.rgb,smoothstep(.06,.40,re)*uBlink);
 col=mix(col,closed,uContentMix);
 // Match a warmly lit subject to the blue-hour doorstep instead of a white studio.
 col.rgb*=vec3(.72,.68,.63);
 col.a*=uFade;
 if(col.a<.003) discard;
 gl_FragColor=col;
}
