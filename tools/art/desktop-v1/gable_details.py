"""Closed party-wall gables and timber bargeboards; shared by rebuild and source refinement."""
from mathutils import Vector

def map_gable_uv(o):
 uv=o.data.uv_layers.active
 for f in o.data.polygons:
  axes=sorted(range(3),key=lambda j:abs(f.normal[j]))[:2]
  for i in f.loop_indices:
   co=o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=(co[axes[0]]*.4,co[axes[1]]*.4)

def add_gables(scene,wood,plaster,mesh,box,P):
 for side in [-1,1]:
  x=side*4.18;profile=[(4.94,0),(5.585,2.85),(4.94,5.70)];verts=[(x+d,y,z) for d in [-.095,.095] for y,z in profile]
  g=mesh('Closed plaster gable',verts,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],plaster,smooth=False)
  map_gable_uv(g)
  for a,b in [((side*4.49,4.945,-.37),(side*4.49,5.58,2.85)),((side*4.49,5.58,2.85),(side*4.49,4.945,6.07))]:
   d=Vector(P(*b))-Vector(P(*a));center=tuple((u+v)/2 for u,v in zip(a,b));o=box('Sloped timber bargeboard',center,(.10,d.length,.13),wood,.012);o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
