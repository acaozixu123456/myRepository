import * as T from 'three';

// Authored image-space regions, not estimated 3D geometry or inferred depth.
const fragmentShader = `
precision highp float;
uniform sampler2D uImage;
uniform vec2 uCover, uPointer;
uniform float uTime, uKind;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float cloud(vec2 p){return noise(p)*.58+noise(p*2.1)*.28+noise(p*4.2)*.14;}
float oval(vec2 p,vec2 center,vec2 extent){return exp(-dot((p-center)/extent,(p-center)/extent)*2.);}
float region(vec2 p,vec2 a,vec2 b){return smoothstep(a.x,a.x+.025,p.x)*(1.-smoothstep(b.x-.025,b.x,p.x))*smoothstep(a.y,a.y+.025,p.y)*(1.-smoothstep(b.y-.025,b.y,p.y));}
void main(){
  vec2 uv=(vUv-.5)*uCover/1.018+.5;
  vec2 p=vec2(uv.x,1.-uv.y);
  float t=uTime;
  // The entire frame stays steady: movement is confined to material/air regions.
  vec2 warped=uv;
  float steam=0., glow=0., water=0.;
  if(uKind<.5){
    float window=region(p,vec2(.12,.02),vec2(.49,.79));
    warped+=uPointer*vec2(.0017,.0009)*window;
    float rising=cloud(vec2(p.x*30.+sin(t*.22),p.y*23.+t*.20));
    steam=oval(p,vec2(.77+.008*sin(t*.4),.51),vec2(.12,.16))*smoothstep(.48,.78,rising)*.095;
    glow=oval(p,vec2(.612,.27),vec2(.23,.33))*(sin(t*.52)*.009+sin(t*.19)*.011);
  }else if(uKind<1.5){
    float curtain=region(p,vec2(.619,.338),vec2(.763,.589));
    float hem=smoothstep(.34,.59,p.y);
    warped.x+=curtain*hem*(sin(t*.85+p.y*15.)*.0021+sin(t*.34)*.0012);
    warped.y+=curtain*hem*sin(t*.7+p.x*16.)*.0007;
    glow=oval(p,vec2(.68,.64),vec2(.20,.40))*(sin(t*.42)*.012);
  }else{
    // The slanted edge follows the bath rim; tiled walls/stools never ripple.
    float leftEdge=.44+max(0.,p.y-.65)*.61;
    water=smoothstep(leftEdge,leftEdge+.025,p.x)*smoothstep(.664,.695,p.y);
    float rip=sin(p.y*175.-t*1.8+p.x*12.)+sin(p.x*93.+p.y*118.+t*1.1)*.45;
    warped.x+=water*sin(p.y*142.-t*1.3)*.0011;
    warped.y+=water*rip*.00085;
    float rising=cloud(vec2(p.x*10.+sin(t*.16)*.3,p.y*10.+t*.12));
    steam=oval(p,vec2(.76+.018*sin(t*.17),.59),vec2(.42,.26))*smoothstep(.39,.80,rising)*.16;
    glow=water*(sin(p.y*182.-t*1.8+p.x*11.)*.008+sin(t*.42)*.004);
  }
  vec3 col=texture2D(uImage,warped).rgb;
  // Only brighten existing warm reflections, with no new light source painted on.
  col+=glow*vec3(1.,.68,.34)*(.25+dot(col,vec3(.3,.5,.2)));
  col=mix(col,vec3(.48,.57,.61),steam);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createRoomRenderer(host) {
  let renderer, material, mesh, image, room = 'street', elapsed = 0;
  const cache = new Map(), pointer = new T.Vector2(), target = new T.Vector2();
  const scene = new T.Scene(), camera = new T.Camera(), loader = new T.TextureLoader();
  const canvas = document.createElement('canvas'); canvas.id = 'room-motion'; canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  try {
    renderer = new T.WebGLRenderer({canvas, antialias:false, alpha:false});
    renderer.outputColorSpace = T.SRGBColorSpace;
    material = new T.ShaderMaterial({uniforms:{uImage:{value:null},uCover:{value:new T.Vector2(1,1)},uPointer:{value:pointer},uTime:{value:0},uKind:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader,depthTest:false,depthWrite:false});
    mesh = new T.Mesh(new T.PlaneGeometry(2,2),material); scene.add(mesh);
  } catch { canvas.hidden = true; }
  function resize() {
    if (!renderer || !image) return;
    const aspect=innerWidth/innerHeight, ia=image.image.width/image.image.height;
    material.uniforms.uCover.value.set(aspect>ia?1:aspect/ia,aspect>ia?ia/aspect:1);
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight);
  }
  addEventListener('resize',resize);
  addEventListener('pointermove',e=>target.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.hidden=true;host.classList.remove('motion-ready');});
  return {
    async load(next) {
      if(next==='street'){room=next;return;}
      if(!renderer)return;
      if(!cache.has(next))cache.set(next,await loader.loadAsync(`/chapter1/${next}.png`));
      room=next;image=cache.get(next);image.colorSpace=T.SRGBColorSpace;
      material.uniforms.uImage.value=image;material.uniforms.uKind.value=['shop','sento','bath'].indexOf(next);
      resize();renderer.render(scene,camera);host.classList.add('motion-ready');
    },
    update(dt,paused,reduced){if(!renderer||!image||room==='street'||canvas.hidden)return;if(!paused&&!reduced){elapsed+=dt;pointer.lerp(target,1-Math.exp(-dt*2));}if(reduced)pointer.set(0,0);material.uniforms.uTime.value=elapsed;renderer.render(scene,camera);},
    snapshot:()=>({ready:!!renderer&&!canvas.hidden,room,elapsed,regions:'authored UV masks; water, steam, curtain, lamp; no depth reconstruction'}),
  };
}
