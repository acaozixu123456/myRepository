from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:260]
    s=s.replace(old,new)

rep("import type {Progress} from './state';", "import type {Progress} from './state';\nimport {loadHeroArt} from './heroArt';")
rep("""  const blocked:Mesh[]=[];
  function finish(mesh:Mesh,color:string,parent?:TransformNode,collision=false,merge=true){
    mesh.material=mat(color);if(parent)mesh.parent=parent;mesh.receiveShadows=true;
    if(collision){mesh.checkCollisions=true;mesh.metadata={blocker:true};blocked.push(mesh);}else if(merge)batches.push(mesh);
    return mesh;
  }
""", """  const blocked:Mesh[]=[];
  function underHero(parent?:TransformNode){let node:any=parent;while(node){if(node.metadata?.heroShop)return true;node=node.parent;}return false;}
  function finish(mesh:Mesh,color:string,parent?:TransformNode,collision=false,merge=true){
    mesh.material=mat(color);if(parent)mesh.parent=parent;mesh.receiveShadows=true;const heroProxy=underHero(parent);
    if(heroProxy)mesh.metadata={...(mesh.metadata||{}),heroProxy:true};
    if(collision){mesh.checkCollisions=true;mesh.metadata={...(mesh.metadata||{}),blocker:true};blocked.push(mesh);}else if(merge&&!heroProxy)batches.push(mesh);
    return mesh;
  }
""")
rep("if(shop)shopRoot=root;", "if(shop){shopRoot=root;root.metadata={heroShop:true};}")
rep("""  const groups=new Map<StandardMaterial,Mesh[]>();
""", """  const heroProxyMeshes=shopRoot?shopRoot.getChildMeshes(false):[];
  const belongsToReceipt=(mesh:Mesh)=>{let node:any=mesh.parent;while(node){if(node===receiptBag)return true;node=node.parent;}return false;};
  const groups=new Map<StandardMaterial,Mesh[]>();
""")
rep("""  for(const b of blocked){b.freezeWorldMatrix();if(b.isVisible)shadows.addShadowCaster(b);}
  for(const m of mats.values())m.freeze();
""", """  for(const b of blocked){b.freezeWorldMatrix();if(b.isVisible)shadows.addShadowCaster(b);}
  for(const m of mats.values())m.freeze();
  let heroArt:ReturnType<typeof loadHeroArt>|null=null;
  if(shopRoot){
    heroArt=loadHeroArt(scene,shopRoot,shadows,coarse);
    void heroArt.ready.then(()=>{
      if(heroArt?.status!=='ready')return;
      // Hide only the old hero-shop visuals after both GLBs are confirmed loaded. Keep collision proxies and the stateful bento/steam item alive.
      for(const mesh of heroProxyMeshes){if(!belongsToReceipt(mesh)){mesh.visibility=0;mesh.isPickable=false;}}
    });
  }
""")
rep("m=>Boolean(m.metadata?.blocker)&&m.isVisible", "m=>Boolean(m.metadata?.blocker)")
rep("if(keeper)keeper.rotation.y=near?.id==='shop'?.06*Math.sin(time*.8):0;", "const activeKeeper=heroArt?.status==='ready'?heroArt.keeperAnchor:keeper;if(activeKeeper)activeKeeper.rotation.y=near?.id==='shop'?.06*Math.sin(time*.8):0;")
rep("""    diagnostics(){return{fps,floorY:player.position.y,keys:[...keys],meshCount:scene.meshes.length,roadLength:ROAD_LENGTH,pose:{x:player.position.x,z:player.position.z,yaw,pitch},paused,nearest:near?.id||null,webgl:engine.webGLVersion};},
""", """    diagnostics(){return{fps,floorY:player.position.y,keys:[...keys],meshCount:scene.meshes.length,roadLength:ROAD_LENGTH,pose:{x:player.position.x,z:player.position.z,yaw,pitch},paused,nearest:near?.id||null,webgl:engine.webGLVersion,artStatus:heroArt?.status||'unavailable',artError:heroArt?.error||null,artMeshCount:heroArt?.meshCount||0,artAnimations:heroArt?.animationNames||[],heroProxyVisible:heroProxyMeshes.filter(mesh=>mesh.visibility>0&&!belongsToReceipt(mesh)).length};},
""")
rep("""if(document.pointerLockElement===canvas)document.exitPointerLock();scene.dispose();engine.dispose();},
""", """if(document.pointerLockElement===canvas)document.exitPointerLock();heroArt?.dispose();scene.dispose();engine.dispose();},
""")
p.write_text(s)
