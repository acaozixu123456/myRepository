"""Re-export an edited delivered .blend without regenerating its geometry.
Blender --background --python export_blend.py -- shop|keeper
"""
import bpy,sys,pathlib
root=pathlib.Path(__file__).resolve().parents[3];kind=sys.argv[sys.argv.index('--')+1];assert kind in ['shop','keeper']
source=root/f'art-source/desktop-v1/yorimichi-{kind}.blend';bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
if kind=='keeper':
 for o in scene.objects:
  if o.type=='MESH':
   world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
else:
 bpy.ops.object.select_all(action='DESELECT')
 for o in scene.objects:
  if o.type in ['MESH','CURVE']:o.select_set(True)
 bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.type=='MESH');bpy.ops.object.convert(target='MESH')
groups={}
for o in list(scene.objects):
 if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=kind+'_'+name.split(' |')[0]
if kind=='keeper':
 for o in scene.objects:
  if o.type=='ARMATURE':
   for track in o.animation_data.nla_tracks:track.mute=False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(root/f'public/explore/assets/desktop-v1/yorimichi-{kind}.glb'),export_format='GLB',export_yup=True,export_apply=kind=='shop',export_tangents=kind=='shop',export_animations=kind=='keeper',export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_cameras=False,export_lights=False,export_extras=True)

import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from optimize_glb import optimize
optimize(root/f'public/explore/assets/desktop-v1/yorimichi-{kind}.glb')
