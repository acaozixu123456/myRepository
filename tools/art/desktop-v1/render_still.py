"""CPU Cycles neutral inspection still, clearly separate from actual-browser evidence."""
import bpy,sys,pathlib
from mathutils import Vector
r=pathlib.Path(__file__).resolve().parents[3];kind=sys.argv[sys.argv.index('--')+1];bpy.ops.wm.open_mainfile(filepath=str(r/f'art-source/desktop-v1/yorimichi-{kind}.blend'))
scene=bpy.context.scene
bpy.ops.object.camera_add(location=(10,13,8) if kind=='shop' else (2.2,3.2,1.8));camera=bpy.context.object;target=Vector((0,-1.5,2.35) if kind=='shop' else (0,0,.9));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=13.5 if kind=='shop' else 2.3;scene.camera=camera
for loc,energy,size in [((0,2,11),1800,8),((-7,6,6),1100,7),((6,-5,9),1500,7)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,-1,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
world=scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.55,.60,.55,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.5
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.23 if kind=='shop' else -.01));m=bpy.data.materials.new('Inspection floor');m.diffuse_color=(.43,.47,.41,1);bpy.context.object.data.materials.append(m)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(r/f'docs/art/desktop-v1/evidence/{kind}-cycles-neutral.png');bpy.ops.render.render(write_still=True)
