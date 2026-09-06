import * as T from 'three';
import fragmentShader from './cat.frag.glsl?raw';

const anchors = [[.69,.24],[.79,.215]];
const key='livingScene.cat.latte.v1';
export function createCat({ sound, focusScene, closeStory }) {
  const $=s=>document.querySelector(s), button=$('#cat-hotspot');
  let saved={version:1,visits:0,touches:0},canSave=true;
  try {
    const raw=localStorage.getItem(key);
    if(raw){const v=JSON.parse(raw);if(v.version===1&&Number.isSafeInteger(v.visits)&&v.visits>=0&&Number.isSafeInteger(v.touches)&&v.touches>=0)saved=v;else canSave=false;}
  } catch { canSave=false; }
  const anchorIndex=saved.visits%anchors.length;
  saved.visits++;
  const persist=()=>{if(canSave)try{localStorage.setItem(key,JSON.stringify(saved));}catch{}};
  persist();
  const anchor=anchors[anchorIndex];
  let ready=false, state='observing',elapsed=0,idle=0,until=0,near=false,active=false;
  let gaze=0,targetGaze=0,ear=0,pose=0,content=0,blink=0,nextBlink=3.5,blinkAt=-10;
  let group,mesh,uniforms,shadow,downAt=0,pointerHeld=false,petTriggered=false;
  const note={
    attentive: ['こっち、見てくれた。','它看向我了。','「〜てくれた」带一点“它为我做了这件事”的亲近感。'],
    purring:['気持ちよさそう。','看起来好舒服。','「〜そう」在这里是根据眼前的样子作判断。'],
    watching:['何か、見つけた？','发现什么了吗？','顺着它的目光，看看树枝和远处的小巷。'],
    sleeping:['眠そうだね。','看起来困了呢。','「眠い」是困，「眠そう」是看上去困。'],
    observing:['そこが好きなんだね。','原来你喜欢待在那里啊。','先在这里陪它安静一会儿。'],
  };
  function showLine(which) {
    const [ja,zh,help]=note[which];
    $('#cat-line').textContent=ja;$('#cat-translation').textContent=zh;$('#cat-note').textContent=help;
    $('#cat-explanation').hidden=true;$('#cat-explain').setAttribute('aria-expanded','false');
  }
  function setState(next,seconds=0) {
    state=next;until=elapsed+seconds;idle=0;
    if(next==='attentive') targetGaze=0;
    if(next==='watching') targetGaze=-1;
    if(next==='purring') {saved.touches++;persist();}
    sound.setCatState(state,near||active);
    if(active)showLine(next);
  }
  function open() {
    if(!ready)return;
    closeStory();active=true;
    $('#places-nav').hidden=true;$('#places-toggle').setAttribute('aria-expanded','false');
    document.body.classList.add('cat-focused');
    $('#cat-panel').hidden=false;$('#hotspots').inert=true;
    focusScene({id:'cat',uv:[anchor[0],anchor[1]+.055]});
    setState('attentive',7);
    if(saved.touches>0){$('#cat-line').textContent='また、ここにいたね。';$('#cat-translation').textContent='又在这里见到你了。';$('#cat-note').textContent='刚才那点熟悉感，还留在这里。';}
    $('#cat-line').focus({preventScroll:true});
  }
  function close() {
    if(!active)return;
    active=false;$('#cat-panel').hidden=true;$('#hotspots').inert=false;
    document.body.classList.remove('cat-focused');focusScene(null);button.focus({preventScroll:true});
    sound.setCatState(state,near);
  }
  button.onclick=()=>{if(!petTriggered)open();petTriggered=false;};
  button.onpointerenter=button.onfocus=()=>{near=true;ear=1;idle=0;sound.setCatState(state,true);};
  button.onpointerleave=button.onblur=()=>{near=false;pointerHeld=false;sound.setCatState(state,active);};
  button.onpointermove=e=>{
    const r=button.getBoundingClientRect();targetGaze=T.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1);
  };
  button.onpointerdown=e=>{
    const r=button.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    // Chin area, based on the painted source, not an invisible full-scene pet target.
    pointerHeld=x>.1&&x<.52&&y>.36&&y<.72;downAt=elapsed;petTriggered=false;
  };
  addEventListener('pointerup',()=>pointerHeld=false);
  addEventListener('pointercancel',()=>pointerHeld=false);
  $('#cat-pet').onclick=()=>setState('purring',7);
  $('#cat-look').onclick=()=>{ear=1;setState('watching',6);};
  $('#cat-rest').onclick=()=>setState('sleeping',25);
  $('#cat-back').onclick=close;
  $('#cat-explain').onclick=()=>{const next=$('#cat-explanation').hidden;$('#cat-explanation').hidden=!next;$('#cat-explain').setAttribute('aria-expanded',String(next));};
  addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  const menu=document.createElement('button');menu.textContent='店旁的猫';menu.onclick=open;$('#places-nav').append(menu);
  return {
    async load(scene) {
      const loader=new T.TextureLoader();
      const textures=await Promise.all(['alert-loaf','attentive','content'].map(n=>loader.loadAsync(`/cat/${n}.webp`)));
      textures.forEach(t=>t.colorSpace=T.SRGBColorSpace);
      uniforms={uRest:{value:textures[0]},uAlert:{value:textures[1]},uContent:{value:textures[2]},uTime:{value:0},uPose:{value:0},uContentMix:{value:0},uBlink:{value:0},uGaze:{value:0},uEar:{value:0},uFade:{value:1}};
      group=new T.Group();
      mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader,transparent:true,depthWrite:false,depthTest:false}));
      mesh.renderOrder=1;mesh.frustumCulled=false;group.add(mesh);
      shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv; void main(){float a=exp(-dot((vUv-.5)*vec2(4.,5.),(vUv-.5)*vec2(4.,5.)));gl_FragColor=vec4(.008,.012,.017,a*.48);}',transparent:true,depthWrite:false,depthTest:false}));
      shadow.renderOrder=0;shadow.frustumCulled=false;group.add(shadow);scene.add(group);
      ready=true;button.hidden=false;
    },
    update(dt,time,{cover,pointer,focusOffset,push,width,height,aspect,paused,reduced,storyFocused}) {
      if(!ready)return;
      if(!paused){
        elapsed+=dt;idle+=dt;
        if(pointerHeld&&elapsed-downAt>.45&&!petTriggered){open();setState('purring',7);petTriggered=true;pointerHeld=false;}
        if(['purring','attentive','watching'].includes(state)&&elapsed>until)setState('observing');
        if(state==='sleeping'&&elapsed>until)setState('observing');
        if(idle>38&&!active&&!near&&state==='observing')setState('sleeping',28);
        if(elapsed>nextBlink){blinkAt=elapsed;nextBlink=elapsed+4+Math.random()*4;}
        const b=(elapsed-blinkAt)/.26;blink=b>=0&&b<=1?Math.sin(b*Math.PI):0;
        if(Math.sin(elapsed*.57)>.994)ear=1;
        ear=T.MathUtils.damp(ear,0,3,dt);
        gaze=T.MathUtils.damp(gaze,targetGaze,4,dt);
      }
      const blend=reduced?1:1-Math.exp(-dt*7);
      pose+=(Number(['attentive','watching','purring'].includes(state))-pose)*blend;
      content+=(Number(['sleeping','purring'].includes(state))-content)*blend;
      uniforms.uTime.value=time;uniforms.uPose.value=pose;uniforms.uContentMix.value=content;
      uniforms.uBlink.value=reduced?0:blink;uniforms.uGaze.value=reduced?0:gaze;uniforms.uEar.value=reduced?0:ear;
      const z=1.035+push*.045,depth=.8;
      const x=.5+((anchor[0]-.5-focusOffset.x-pointer.x*.006*(depth-.2))/cover.x)*z;
      const y=.5+((anchor[1]-.5-focusOffset.y-pointer.y*.003*(depth-.2))/cover.y)*z;
      const spriteW=.045/cover.x*z*width, spriteH=spriteW;
      const cx=x*width, baseline=(1-y)*height;
      // Source feet lie near y=.825; preserve that contact when changing poses.
      const cy=baseline-spriteH*.325;
      mesh.position.set((cx/width*2-1)*aspect,1-cy/height*2,.5);
      mesh.scale.set(spriteW/width*2*aspect,spriteH/height*2,1);
      shadow.position.set((cx/width*2-1)*aspect,1-baseline/height*2,.4);
      shadow.scale.set(spriteW/width*1.85*aspect,spriteH/height*.18,1);
      button.style.transform=`translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0) translate(-50%,-50%)`;
      button.style.width=`${spriteW}px`;button.style.height=`${spriteH}px`;
      button.hidden=cx<0||cx>width||baseline<0||baseline>height||storyFocused;
    },
    snapshot:()=>({ready,state,active,anchorIndex,anchor,visits:saved.visits,touches:saved.touches,blink,gaze,ear,pose,content,elapsed,source:'3 imagegen-painted RGBA poses; localized shader deformation'}),
    close,
  };
}
