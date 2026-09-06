"""Original adult stylized keeper: shaped ring topology, tailored clothing, simple face.
18 deform bones, named idle/greet/talk actions; no real person, no lip sync.
"""
import sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from common import *
skin=mat('Keeper | matte peach skin',(.66,.39,.25),.88);hair=mat('Keeper | chestnut hair',(.067,.038,.026),.85);hairLight=mat('Keeper | hair ridge',(.115,.062,.034),.8);shirt=mat('Keeper | dusty sage work shirt',(.15,.28,.23),.91);apron=mat('Keeper | oatmeal canvas',(.61,.56,.39),.94);pants=mat('Keeper | blue charcoal twill',(.055,.075,.080),.9);sole=mat('Keeper | rubber soles',(.09,.105,.09),.9);shoe=mat('Keeper | warm canvas shoes',(.59,.57,.44),.87);ink=mat('Keeper | simple face ink',(.045,.025,.020),.93);lip=mat('Keeper | lip blush',(.36,.14,.09),.92);cheek=mat('Keeper | cheek warmth',(.67,.29,.21),.97)
weighted=[]
def bind(o,bone):weighted.append((o,bone));return o

def loft(name,rings,m,N=24,sub=1,bone='spine'):
 sub=min(sub,1) if name not in ['Sculpted head'] else sub
 vs=[];uv=[]
 for j,(y,rx,rz,xc,zc) in enumerate(rings):
  for i in range(N):
   t=i/N*math.tau;vs.append((xc+rx*math.cos(t),y,zc+rz*math.sin(t)));uv.append((i/N,j/(len(rings)-1)))
 fs=[]
 for j in range(len(rings)-1):
  for i in range(N):q=j*N+i;n=j*N+(i+1)%N;fs.append((q,q+N,n+N,n))
 fs.extend([tuple(range(N)),tuple((len(rings)-1)*N+i for i in range(N-1,-1,-1))])
 o=mesh(name,vs,fs,m,uv)
 if sub:s=o.modifiers.new('Sculpted silhouette subdivision','SUBSURF');s.levels=sub;s.render_levels=sub
 return bind(o,bone)
# Anatomical silhouette is shaped topology, not spheres or cylinders at joints.
loft('Shirt torso',[(.72,.17,.104,0,.014),(.76,.195,.12,0,.014),(.88,.183,.107,0,.01),(1.02,.202,.12,0,.009),(1.105,.24,.115,0,.005),(1.17,.231,.092,0,0),(1.215,.12,.071,0,0),(1.235,.068,.058,0,0)],shirt,32,2,'torso')
loft('Neck',[(1.18,.058,.052,0,0),(1.22,.062,.055,0,0),(1.31,.065,.055,0,-.002),(1.33,.066,.059,0,-.005)],skin,24,1,'head')
# Narrow jaw, generous cheeks, tapered forehead: five-head adult stylization.
head=loft('Sculpted head',[(1.285,.034,.037,0,-.009),(1.30,.072,.060,0,-.008),(1.33,.103,.080,0,-.006),(1.39,.132,.103,0,0),(1.46,.149,.117,0,.004),(1.53,.151,.123,0,.008),(1.59,.137,.112,0,.012),(1.64,.093,.083,0,.012),(1.665,.022,.025,0,.01)],skin,32,2,'head')
# Nose is a single quiet shaped wedge; eyes and smile are reduced graphic forms.
loft('Simple nose',[(1.403,.012,.010,0,-.116),(1.417,.022,.020,0,-.126),(1.432,.018,.025,0,-.126),(1.462,.010,.012,0,-.112)],skin,16,1,'head')
for s in [-1,1]:
 e=loft('Ear',[(1.391,.012,.013,s*.146,.007),(1.409,.025,.022,s*.151,.005),(1.455,.025,.024,s*.151,.004),(1.478,.010,.01,s*.146,.003)],skin,16,1,'head')
 bind(tube('Eyebrow',[(s*(.044+i*.012),1.507+.009*math.sin(i/4*math.pi),-.110+i*.002) for i in range(5)],.005,hair),'head')
 # Lentil eyes retained as separate skinned geometry for blink bones.
 eye=loft('Simplified eye',[(1.447,.010,.005,s*.063,-.112),(1.454,.017,.007,s*.063,-.116),(1.469,.017,.007,s*.063,-.116),(1.477,.008,.004,s*.063,-.111)],ink,16,1,'blink'+str(s))
 bind(tube('Smiling eyelid',[(s*(.045+i*.009),1.476-.003*i/4,-.114+i*.002) for i in range(5)],.0038,hair),'head')
 bind(ell('Subtle cheek blush',(s*.097,1.411,-.091),(.022,.009,.003),cheek,16,8),'head')
bind(tube('Gentle smile',[(-.034+i*.0085,1.379-.005*math.sin(i/8*math.pi),-.097) for i in range(9)],.0032,lip),'head')
# Scalp, asymmetric fringe and swept locks, all closed volumes.
loft('Hair crown',[(1.49,.151,.122,0,.022),(1.54,.157,.129,0,.024),(1.61,.148,.124,0,.024),(1.662,.108,.093,0,.023),(1.694,.035,.033,0,.02),(1.697,.005,.006,0,.02)],hair,48,2,'head')
# Hair back does not cover the face; nape and sideburns integrate into crown.
for s in [-1,1]:
 loft('Tapered sideburn',[(1.40,.016,.033,s*.137,.023),(1.46,.026,.052,s*.145,.025),(1.55,.030,.062,s*.136,.026),(1.615,.027,.045,s*.11,.021)],hair,20,1,'head')
for k in range(7):
 x=-.126+k*.040;low=1.49+(.03 if k<3 else .01)+.016*math.sin(k)
 loft('Swept sculpted fringe',[(low,.006,.007,x-.012,-.093),(low+.035,.021,.018,x-.007,-.118),(1.59,.030,.022,x+.013,-.114),(1.65,.023,.020,x*.65+.022,-.065),(1.668,.006,.007,x*.55+.022,-.036)],hair,20,1,'head')
 bind(tube('Subtle hair flow',[(x*.6+.022,1.666,-.061),(x+.015,1.625,-.111),(x+.006,1.588,-.131)],.0014,hairLight),'head')
# Trouser legs and ankle cuffs; each uses smooth knee weights, not disconnected limbs.
for s in [-1,1]:
 suffix='L' if s==-1 else 'R';x=s*.105
 loft('Trouser '+suffix,[(.10,.067,.067,x,.01),(.16,.069,.071,x,.01),(.23,.061,.064,x,.014),(.36,.073,.069,x,.004),(.47,.077,.079,x,.01),(.57,.086,.095,x,.018),(.69,.096,.106,x,.015),(.77,.095,.097,x,.01),(.80,.080,.071,x,.01)],pants,24,2,'leg'+suffix)
 loft('Trouser cuff '+suffix,[(.135,.072,.074,x,.009),(.147,.074,.075,x,.009),(.18,.073,.073,x,.009),(.19,.069,.071,x,.009)],pants,24,1,'calf'+suffix)
 loft('Canvas shoe '+suffix,[(.016,.084,.138,x,-.051),(.043,.085,.14,x,-.052),(.08,.081,.134,x,-.05),(.108,.071,.119,x,-.036),(.135,.058,.071,x,.009),(.151,.055,.059,x,.016)],shoe,32,2,'foot'+suffix)
 loft('Shoe sole '+suffix,[(0,.079,.133,x,-.053),(.008,.087,.144,x,-.053),(.032,.087,.144,x,-.053),(.04,.082,.137,x,-.053)],sole,32,1,'foot'+suffix)
 for j in range(3):bind(tube('Shoe stitch',[(x-.045,.114+j*.007,-.095+j*.031),(x,.12+j*.008,-.095+j*.031),(x+.045,.114+j*.007,-.095+j*.031)],.0025,ivory),'foot'+suffix)
 # Relaxed bent work sleeves shape the shoulder and elbow with gently tapering cross sections.
 loft('Rolled sleeve '+suffix,[(.88,.052,.061,s*.29,0),(.93,.065,.073,s*.285,0),(1.015,.077,.082,s*.269,.006),(1.12,.086,.088,s*.233,.007),(1.17,.067,.072,s*.21,.005),(1.198,.035,.035,s*.19,.003),(1.205,.01,.012,s*.182,.003)],shirt,24,2,'arm'+suffix)
 loft('Sleeve cuff '+suffix,[(.874,.059,.070,s*.291,0),(.889,.063,.073,s*.29,0),(.932,.066,.077,s*.285,0),(.945,.060,.071,s*.281,0)],shirt,24,1,'upper'+suffix)
 loft('Forearm '+suffix,[(.665,.036,.037,s*.323,-.025),(.70,.039,.040,s*.321,-.023),(.78,.045,.048,s*.309,-.011),(.88,.049,.052,s*.293,0),(.935,.047,.049,s*.283,0)],skin,24,2,'fore'+suffix)
 loft('Palm '+suffix,[(.579,.026,.017,s*.327,-.028),(.608,.040,.023,s*.329,-.03),(.643,.041,.025,s*.326,-.028),(.682,.030,.026,s*.321,-.026),(.701,.026,.025,s*.321,-.024)],skin,24,2,'hand'+suffix)
 # Four shortened tapered fingers and a separate posed thumb, all hand weighted.
 for k in range(4):
  xx=s*(.305+k*.017);yy=.545+abs(k-1.4)*.007
  loft('Finger '+suffix,[(yy,.005,.007,xx,-.025),(yy+.014,.009,.009,xx,-.031),(yy+.043,.009,.010,xx,-.031),(yy+.064,.009,.011,xx,-.027)],skin,12,1,'hand'+suffix)
 loft('Thumb '+suffix,[(.59,.008,.010,s*.287,-.045),(.61,.012,.014,s*.284,-.048),(.639,.015,.015,s*.295,-.044),(.658,.01,.012,s*.305,-.035)],skin,12,1,'hand'+suffix)
# Tailored apron: curved panel conforms to torso, separate seams/pocket and back bow.
vs=[];uv=[];nx=24;ny=30
for j in range(ny+1):
 t=j/ny;y=1.158-t*.565;w=.113 if t<.32 else .113+(t-.32)/.68*.119
 for i in range(nx+1):
  u=i/nx;xx=(u-.5)*2*w;z=-.13-.018*t+.026*(xx/w)**2+.008*math.sin(u*math.pi*8)*max(0,t-.3)
  vs.append((xx,y+.008*math.cos(u*math.pi*2)*t,z));uv.append((u,t))
fs=[]
for j in range(ny):
 for i in range(nx):q=j*(nx+1)+i;fs.append((q,q+1,q+nx+2,q+nx+1))
o=mesh('Tailored apron',vs,fs,apron,uv);sol=o.modifiers.new('Canvas thickness','SOLIDIFY');sol.thickness=.006;sub=o.modifiers.new('Soft drape','SUBSURF');sub.levels=1;bind(o,'apron')
for s in [-1,1]:
 path=[(s*.091,1.15,-.140),(s*.125,1.20,-.099),(s*.126,1.239,-.008),(s*.13,1.204,.087),(s*.10,.94,.138)]
 pts=[(x+d,y,z) for x,y,z in path for d in [-.013,.013]]
 strap=mesh('Flat apron shoulder strap',pts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(path)-1)],apron)
 mod=strap.modifiers.new('Woven strap thickness','SOLIDIFY');mod.thickness=.004
 mod=strap.modifiers.new('Soft strap curve','SUBSURF');mod.levels=2
 bind(strap,'spine')
 bind(tube('Apron side seam',[(s*(.11+.12*max(0,t-.32)/.68),1.158-.565*t,-.123) for t in [i/24 for i in range(25)]],.0022,ivory),'apron')
 bind(ell('Apron brass rivet',(s*.086,1.128,-.144),(.008,.008,.004),brass,12,6),'spine')
# Pocket laid on draped cloth, with concave top seam and divided utensil compartment.
vs=[(-.132,.733,-.150),(.132,.733,-.150),(.129,.858,-.149),(-.129,.858,-.149)]
o=mesh('Apron patch pocket',vs,[(0,1,2,3)],apron);s=o.modifiers.new('Pocket cloth','SOLIDIFY');s.thickness=.008;bind(o,'pelvis')
bind(tube('Pocket saddle stitch',[(-.125,.849,-.158),(-.126,.742,-.158),(.126,.742,-.158),(.125,.849,-.158)],.002,ivory),'pelvis')
bind(tube('Pocket top seam',[(-.125,.858,-.16),(0,.849,-.165),(.125,.858,-.16)],.0025,ivory),'pelvis')
for s in [-1,1]:
 bind(tube('Waist tie',[(s*.18,.90,-.06),(s*.195,.90,.06),(s*.11,.90,.132),(0,.90,.139)],.012,apron),'pelvis')
 # closed loop bow and hanging ribbon in rear view
 bind(tube('Apron bow loop',[(0,.898,.15),(s*.067,.937,.158),(s*.092,.914,.164),(s*.043,.889,.159),(0,.898,.15)],.012,apron),'pelvis')
 bind(tube('Apron tie end',[(s*.012,.89,.154),(s*.03,.81,.163),(s*.055,.73,.171)],.010,apron),'pelvis')
# Rig in authored coordinates; normalized scale, deform-only bone hierarchy.
bpy.ops.object.select_all(action='DESELECT');arm=bpy.data.armatures.new('Yorimichi_deform');rig=bpy.data.objects.new('Yorimichi_keeper_rig',arm);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(n,h,t,parent=None):
 b=arm.edit_bones.new(n)
 if n=='head' or n.startswith('blink'):
  h=(h[0],1.285+max(0,h[1]-1.285)*.87 if h[1]>1.285 else h[1],h[2]);t=(t[0],1.285+max(0,t[1]-1.285)*.87 if t[1]>1.285 else t[1],t[2])
 b.head=P(*h);b.tail=P(*t)
 if parent:b.parent=bones[parent]
 bones[n]=b
bone('root',(0,0,0),(0,.10,0));bone('pelvis',(0,.69,0),(0,.90,0),'root');bone('spine',(0,.90,0),(0,1.20,0),'pelvis');bone('head',(0,1.20,0),(0,1.62,0),'spine')
for s in [-1,1]:
 su='L' if s==-1 else 'R';bone('upper'+su,(s*.215,1.15,0),(s*.29,.905,0),'spine');bone('fore'+su,(s*.29,.905,0),(s*.321,.68,-.025),'upper'+su);bone('hand'+su,(s*.321,.68,-.025),(s*.327,.585,-.03),'fore'+su);bone('thigh'+su,(s*.105,.755,.01),(s*.105,.425,.01),'pelvis');bone('calf'+su,(s*.105,.425,.01),(s*.105,.14,.01),'thigh'+su);bone('foot'+su,(s*.105,.14,.01),(s*.105,.055,-.135),'calf'+su);bone('blink'+str(s),(s*.063,1.449,-.116),(s*.063,1.48,-.116),'head')
bpy.ops.object.mode_set(mode='OBJECT')
# Apply shape modifiers before skin; deform weights are explicit, smooth and reproducible.
for o,assignment in weighted:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
 for v in o.data.vertices:
  if assignment=='head' or assignment.startswith('blink'):
   co=o.matrix_world@v.co
   if co.z>1.285:co.z=1.285+(co.z-1.285)*.87;v.co=o.matrix_world.inverted()@co
  y=(o.matrix_world@v.co).z
  if assignment in ['torso','apron']:
   w=max(0,min(1,(y-.85)/.25));weights={'pelvis':1-w,'spine':w}
  elif assignment.startswith('leg'):
   su=assignment[-1];w=max(0,min(1,(y-.35)/.17));weights={'calf'+su:1-w,'thigh'+su:w}
  elif assignment.startswith('arm'):
   su=assignment[-1];w=max(0,min(1,(y-1.08)/.12));weights={'spine':w*.65,'upper'+su:1-w*.65}
  else:weights={assignment:1}
  for n,w in weights.items():
   if w>0:
    vg=o.vertex_groups.get(n) or o.vertex_groups.new(name=n);vg.add([v.index],w,'REPLACE')
 o.parent=None;mod=o.modifiers.new('Deform skin','ARMATURE');mod.object=rig
# Animations are rig actions; blink is baked into each clip, with no lip synchronization claim.
scene.render.fps=24
for name,end in [('idle',96),('greet',72),('talk',96)]:
 rig.animation_data_create();act=bpy.data.actions.new(name);rig.animation_data.action=act
 for b in rig.pose.bones:b.rotation_mode='XYZ'
 for f in sorted(set([1,end,*range(12,end,12),40,42,44])):
  scene.frame_set(f);phase=(f-1)/max(1,end-1)*math.tau
  for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  rig.pose.bones['spine'].rotation_euler.x=.012*math.sin(phase)
  rig.pose.bones['head'].rotation_euler.z=.023*math.sin(phase)
  if name=='greet':
   amount=math.sin(math.pi*(f-1)/(end-1))**.7
   rig.pose.bones['upperR'].rotation_euler.z=.68*amount;rig.pose.bones['foreR'].rotation_euler.x=1.8*amount;rig.pose.bones['handR'].rotation_euler.z=.24*math.sin(phase*3)*amount;rig.pose.bones['head'].rotation_euler.x=.10*amount
  if name=='talk':
   rig.pose.bones['head'].rotation_euler.x=.04*math.sin(phase*2);rig.pose.bones['foreL'].rotation_euler.x=.14+.15*math.sin(phase);rig.pose.bones['foreR'].rotation_euler.x=.17+.11*math.cos(phase)
  if f==42:
   for s in [-1,1]:rig.pose.bones['blink'+str(s)].scale.y=.09
  for b in rig.pose.bones:
   b.keyframe_insert(data_path='rotation_euler',frame=f,group=b.name);b.keyframe_insert(data_path='scale',frame=f,group=b.name)
 # glTF NLA tracks become exactly named clips.
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,act);strip.action_frame_start=1;strip.action_frame_end=end
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
scene.frame_set(1)
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.scale=(1,1,1)
# Authoring source retains separate garment, face, fingers and named deform weights.
for im in bpy.data.images:
 if im.source=='FILE':im.filepath=bpy.path.relpath(im.filepath,start=str(S))
bpy.ops.wm.save_as_mainfile(filepath=str(S/'yorimichi-keeper.blend'),compress=True)
# Batch meshes by material after source save, preserving vertex groups / armature modifier.
groups={}
for o in scene.objects:
 if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
for n,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=n
for t in rig.animation_data.nla_tracks:t.mute=False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(A/'yorimichi-keeper.glb'),export_format='GLB',export_yup=True,export_apply=False,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_cameras=False,export_lights=False)
print('KEEPER_EXPORTED')

import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from optimize_glb import optimize
optimize(A/'yorimichi-keeper.glb')
