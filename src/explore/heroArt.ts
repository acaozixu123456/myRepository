import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import type {AbstractMesh} from '@babylonjs/core/Meshes/abstractMesh';
import type {Scene} from '@babylonjs/core/scene';
import type {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type {AnimationGroup} from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/loaders/glTF';

export type HeroArtStatus='loading'|'ready'|'failed';
export type HeroArtController={
  status:HeroArtStatus;
  error:string|null;
  keeperAnchor:TransformNode|null;
  animationNames:string[];
  activeAnimation:string|null;
  meshCount:number;
  ready:Promise<void>;
  play:(name:string,loop?:boolean)=>void;
  dispose:()=>void;
};

type ImportResult=Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>;

function topLevelNodes(result:ImportResult){
  const nodes=[...result.meshes,...result.transformNodes];
  const owned=new Set(nodes);
  return nodes.filter(node=>!node.parent||!owned.has(node.parent as never));
}

function configureMeshes(meshes:AbstractMesh[],shadows:ShadowGenerator){
  for(const mesh of meshes){
    mesh.isPickable=false;
    mesh.receiveShadows=true;
    if(mesh.getTotalVertices()>0)shadows.addShadowCaster(mesh,false);
  }
}

export function loadHeroArt(scene:Scene,shopRoot:TransformNode,shadows:ShadowGenerator,coarse:boolean):HeroArtController{
  const importedRoots:TransformNode[]=[];
  const animationGroups:AnimationGroup[]=[];
  let disposed=false;
  const controller:HeroArtController={
    status:'loading',error:null,keeperAnchor:null,animationNames:[],activeAnimation:null,meshCount:0,ready:Promise.resolve(),
    play(name,loop=true){
      if(disposed)return;
      const next=animationGroups.find(group=>group.name.toLowerCase()===name.toLowerCase());
      if(!next)return;
      if(controller.activeAnimation?.toLowerCase()===next.name.toLowerCase())return;
      for(const group of animationGroups)group.stop();
      next.start(loop,1.0,next.from,next.to,false);controller.activeAnimation=next.name;
    },
    dispose:()=>{},
  };

  controller.ready=(async()=>{
    try{
      const [shop,keeper]=await Promise.all([
        SceneLoader.ImportMeshAsync('', '/explore/assets/desktop-v1/', 'yorimichi-shop.glb', scene),
        SceneLoader.ImportMeshAsync('', '/explore/assets/desktop-v1/', 'yorimichi-keeper.glb', scene),
      ]);
      if(disposed){for(const node of [...shop.meshes,...shop.transformNodes,...keeper.meshes,...keeper.transformNodes])node.dispose();return;}

      const shopAnchor=new TransformNode('hero-shop-art-anchor',scene);shopAnchor.parent=shopRoot;
      for(const root of topLevelNodes(shop))root.parent=shopAnchor;

      const keeperAnchor=new TransformNode('hero-keeper-art-anchor',scene);keeperAnchor.parent=shopRoot;keeperAnchor.position.set(.4,0,4.25);
      for(const root of topLevelNodes(keeper))root.parent=keeperAnchor;
      controller.keeperAnchor=keeperAnchor;
      importedRoots.push(shopAnchor,keeperAnchor);

      configureMeshes(shop.meshes,shadows);configureMeshes(keeper.meshes,shadows);
      animationGroups.push(...keeper.animationGroups);
      controller.animationNames=keeper.animationGroups.map(group=>group.name);
      controller.meshCount=shop.meshes.length+keeper.meshes.length;
      controller.status='ready';controller.play('idle',true);

      const shadowMap=shadows.getShadowMap();
      if(shadowMap&&!coarse)shadowMap.refreshRate=1; // Desktop hero character is animated; do not freeze its shadow map.
    }catch(error){
      controller.status='failed';controller.error=error instanceof Error?error.message:String(error);
      for(const root of importedRoots)root.dispose(false,true);
      controller.keeperAnchor=null;controller.meshCount=0;controller.animationNames=[];controller.activeAnimation=null;
    }
  })();

  controller.dispose=()=>{disposed=true;for(const group of animationGroups)group.dispose();for(const root of importedRoots)root.dispose(false,true);};
  return controller;
}
