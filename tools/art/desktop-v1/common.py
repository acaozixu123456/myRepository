"""Original Yorimichi shop authoring. Blender 4.5; meter contract coordinates x/y(up)/z(interior).
Run Blender --background --factory-startup --python tools/art/desktop-v1/build_shop.py
Source objects retain modifiers. Export copies are evaluated and batched by material.
"""
import bpy, math, random, pathlib, json
from mathutils import Vector
R=pathlib.Path(__file__).resolve().parents[3]; A=R/'public/explore/assets/desktop-v1';T=A/'textures'; S=R/'art-source/desktop-v1';random.seed(604)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1

def P(x,y,z):return (-x,-z,y) # Precompensate Babylon LH import X reflection; see measured anchors.
def mat(name,color,rough=.65,metal=0,tex=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes; l=m.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if tex:
  for suffix in ['basecolor','normal','orm']:
   im=bpy.data.images.load(str(T/(tex+'_'+suffix+'.png')),check_existing=True);node=n.new('ShaderNodeTexImage');node.image=im
   if suffix=='basecolor':l.new(node.outputs['Color'],bs.inputs['Base Color'])
   else:
    im.colorspace_settings.name='Non-Color'
    if suffix=='normal':
     norm=n.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.35;l.new(node.outputs['Color'],norm.inputs['Color']);l.new(norm.outputs[0],bs.inputs['Normal'])
    else:
     split=n.new('ShaderNodeSeparateColor');l.new(node.outputs[0],split.inputs[0]);l.new(split.outputs['Green'],bs.inputs['Roughness']);l.new(split.outputs['Blue'],bs.inputs['Metallic'])
 return m
wood=mat('Cedar | original PBR',(.5,.3,.15),tex='cedar');plaster=mat('Lime plaster | original PBR',(.8,.8,.7),tex='plaster');cloth=mat('Sage woven cotton | original PBR',(.1,.3,.2),tex='cloth');roofmat=mat('Glazed grey-green tile | original PBR',(.2,.3,.3),tex='roof')
dark=mat('Stained end grain',(.105,.075,.045));ivory=mat('Porcelain warm white',(.86,.82,.68),.33);brass=mat('Aged brass',(.37,.25,.095),.38,.72);metal=mat('Brushed stainless steel',(.43,.49,.48),.31,.8);black=mat('Bento lacquer',(.035,.043,.034),.32);earth=mat('Clay terracotta',(.40,.20,.12));soil=mat('Potting soil',(.065,.05,.033));leaf1=mat('Leaf dark',(.075,.19,.105));leaf2=mat('Leaf light',(.22,.35,.16));rice=mat('Rice ivory',(.90,.88,.72),.7);fish=mat('Glazed teriyaki',(.37,.135,.052),.37);green=mat('Shiso and pickles',(.21,.33,.09));red=mat('Umeboshi',(.48,.07,.045),.5);glass=mat('Window glass',(.62,.78,.75),.12)
bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Alpha'].default_value=.18;glass.surface_render_method='DITHERED';glass.use_transparency_overlap=False
signmat=mat('Editable signage atlas',(.9,.85,.7),.85);node=signmat.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(T/'signs_basecolor.png'));signmat.node_tree.links.new(node.outputs[0],signmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def finish(o,name,m,smooth=False):
 o.name=name;o.data.materials.append(m)
 if smooth:
  for f in o.data.polygons:f.use_smooth=True
 return o

def box(name,pos,size,m,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=P(*pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,m)
 # Object-space projected metric UVs: vertical grain on vertical joinery.
 uv=o.data.uv_layers.active
 for f in o.data.polygons:
  axes=sorted(range(3),key=lambda j:abs(f.normal[j]))[:2]
  axes=sorted(axes,key=lambda j:abs(o.dimensions[j]))
  for i in f.loop_indices:
   co=o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=(co[axes[0]]*1.5,co[axes[1]]*.6)
 if bevel:
  b=o.modifiers.new('Crafted edge roundover','BEVEL');b.width=bevel;b.segments=2
  n=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');n.keep_sharp=True
 return o

def mesh(name,verts,faces,m,uvs=None,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata([P(*v) for v in verts],[],[tuple(reversed(f)) for f in faces]);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);finish(o,name,m,smooth)
 uv=me.uv_layers.new(name='UV0')
 for face in me.polygons:
  for idx in face.loop_indices:
   vi=me.loops[idx].vertex_index;uv.data[idx].uv=uvs[vi] if uvs else (verts[vi][0],verts[vi][1])
 return o

def tube(name,pts,r,m,res=8):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=2;cu.bevel_depth=r;cu.bevel_resolution=2;cu.resolution_u=12
 sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,co in zip(sp.points,pts):p.co=(*P(*co),1)
 o=bpy.data.objects.new(name,cu);scene.collection.objects.link(o);o.data.materials.append(m);return o

def lathe(name,x,y,z,profile,m,N=32):
 vs=[];uv=[]
 for j,(radius,h) in enumerate(profile):
  for k in range(N+1):
   t=2*math.pi*k/N;vs.append((x+radius*math.cos(t),y+h,z+radius*math.sin(t)));uv.append((k/N,j/(len(profile)-1)))
 fs=[]
 for j in range(len(profile)-1):
  for k in range(N):
   q=j*(N+1)+k;fs.append((q,q+1,q+N+2,q+N+1))
 return mesh(name,vs,fs,m,uv)

def ell(name,pos,size,m,seg=16,rings=8):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=P(*pos));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,True)

def label(key,idx,x,y,z,w,h):
 # Viewed from street (-z), all signage remains readable in canonical glTF RH.
 vs=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
 v0=1-(idx+1)/8;v1=1-idx/8;u1=[2048,384,1189,448,472,1024,869,1400][idx]/2048
 return mesh(key,vs,[(0,1,2,3)],signmat,[(0,v0),(u1,v0),(u1,v1),(0,v1)],False)
