"""Build the original Yorimichi hero shop; shared authoring helpers in common.py."""
import sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from common import *
# Ground floor remains open at center, full modeled shell, inset timber shopfronts.
box('Foundation plinth',(0,-.105,2.85),(8.55,.21,5.7),dark,.025)
for i in range(24):
 x=-4.18+i*.355
 for j in range(4):box('Tongue and groove floor', (x,.022,.71+j*1.42),(.347,.044,1.411),wood,.006)
for x in [-4.18,4.18]:box('Full side plaster wall',(x,2.49,2.85),(.19,4.98,5.7),plaster,.016)
box('Rear plaster wall',(0,2.49,5.60),(8.18,4.98,.2),plaster,.014)
box('Upper storey front plaster',(0,4.03,.085),(8.36,1.90,.18),plaster,.015)
box('Interior ceiling',(0,2.98,2.86),(8.18,.12,5.50),plaster,.012)
for x in [-4.07,-1.065,1.065,4.07]:box('Mortised facade upright',(x,1.52,0),(.13,3.04,.25),wood,.012)
box('Entrance lintel',(0,2.91,-.015),(8.3,.23,.30),wood,.018)
for x in [-2.57,2.57]:
 box('Panel lower apron',(x,.48,.055),(2.88,.94,.13),wood,.012)
 for xx in [x-1.42,x+1.42]:box('Window inner jamb',(xx,1.9,.09),(.065,1.80,.17),dark,.005)
 box('Window sill deep',(x,.995,-.035),(2.95,.09,.32),wood,.012)
 box('Window top rebate',(x,2.78,.10),(2.9,.07,.14),dark,.007)
 for xx in [x-.94,x,x+.94]:
  box('Recessed glazing',(xx,1.88,.13),(.905,1.70,.012),glass,.001)
  box('Slender glazing mullion',(xx-.46,1.88,.045),(.037,1.72,.085),wood,.005)
 box('Window mid transom',(x,2.25,.03),(2.85,.04,.10),wood,.005)
 for k in range(14):box('Apron vertical slat',(x-1.34+k*.205,.48,-.036),(.041,.84,.037),dark,.004)
# Eave brackets and narrow vertical facade accents.
for x in [-4.06,-3.25,-1.06,1.06,3.25,4.06]:
 box('Upper timber stile',(x,4.06,-.055),(.115,1.91,.15),wood,.011)
 tube('Curved eave support',[(x,2.96,-.12),(x,3.06,-.34),(x,3.19,-.47),(x,3.22,-.68)],.033,brass)
box('Sign backing',(0,3.43,-.21),(5.56,.60,.14),dark,.04)
box('Sign inset',(0,3.43,-.295),(5.39,.46,.04),ivory,.012)
label('Shop name',0,0,3.43,-.321,5.24,.41)
for x in [-2.68,2.68]:
 for yy in [3.23,3.63]:ell('Sign mounting pin',(x,yy,-.33),(.019,.019,.008),brass,12,6)
# Upper windows: real projecting joinery and dark interior recesses.
for x in [-2.66,0,2.66]:
 box('Upper window dark reveal',(x,4.30,-.038),(1.94,1.02,.14),dark,.015)
 box('Upper frosted pane',(x,4.30,-.122),(1.76,.84,.013),glass,.002)
 for xx in [x-.94,x+.94]:box('Upper window jamb',(xx,4.30,-.18),(.075,1.07,.20),wood,.010)
 for yy in [3.81,4.79]:box('Upper frame rail',(x,yy,-.19),(1.93,.07,.22),wood,.008)
 for k in range(9):box('Upper lattice',(x-.8+k*.20,4.3,-.205),(.025,.90,.065),wood,.004)
 box('Deep upper sill',(x,3.77,-.20),(2.10,.095,.41),wood,.014)
# Traditional shallow fabric awning; cloth surface, shaped hem, exposed support rods.
vs=[];uv=[];nx=96;nz=12
for j in range(nz+1):
 t=j/nz
 for i in range(nx+1):
  x=-4.12+8.24*i/nx;vs.append((x,3.21-.32*t-.025*math.sin(math.pi*t)+.012*math.cos(x*10),-.19-.95*t));uv.append((i/nx*5,t))
fs=[]
for j in range(nz):
 for i in range(nx):q=j*(nx+1)+i;fs.append((q,q+1,q+nx+2,q+nx+1))
o=mesh('Tailored canvas awning',vs,fs,cloth,uv);s=o.modifiers.new('Canvas thickness','SOLIDIFY');s.thickness=.008
for x in [-4.10,0,4.10]:tube('Awning underside rod',[(x,3.17,-.20),(x,2.86,-1.15)],.018,brass)
vs=[];uv=[]
for j in range(2):
 for i in range(97):
  x=-4.12+8.24*i/96;vs.append((x,2.88-j*(.16+.027*math.sin(i/96*math.pi*24)**2),-1.145));uv.append((i/96*5,j*.2))
mesh('Scalloped awning hem',vs,[(i,i+1,i+98,i+97) for i in range(96)],cloth,uv)
tube('Awning hem seam',[(v[0],v[1]+.015,v[2]-.004) for v in vs[97:]],.006,ivory)
# Noren hangs above 2.60 m clear route, folds are geometry and seam is separate.
for panel in range(3):
 cx=(panel-1)*.66;vs=[];uv=[];nx=18;ny=16
 for j in range(ny+1):
  for i in range(nx+1):
   u=i/nx;v=j/ny;xx=cx+(u-.5)*.625;yy=3.035-v*.405+.015*math.sin(u*math.pi)*v;zz=-.10+.03*math.sin(u*math.pi*4+panel)*v;vs.append((xx,yy,zz));uv.append((u,v))
 fs=[]
 for j in range(ny):
  for i in range(nx):q=j*(nx+1)+i;fs.append((q,q+1,q+nx+2,q+nx+1))
 o=mesh('Split noren panel',vs,fs,cloth,uv);s=o.modifiers.new('Hem weight','SOLIDIFY');s.thickness=.006
 tube('Noren lower stitching',[(v[0],v[1]+.019,v[2]-.004) for v in vs[-19:]],.0024,ivory)
# Roof custom rolled clay tile meshes. Main body fits 5.65 m; overhang separately reported.
for side in [-1,1]:
 for row in range(7):
  for col in range(29):
   xx=-4.35+col*.305;z0=2.85+side*(row*.45);verts=[];uv=[]
   for j in range(4):
    z=z0+side*j*.17
    for i in range(9):
     u=i/8;x=xx+(u-.5)*.315;h=5.59-abs(z-2.85)*.20+.046*math.sin(u*math.pi)+.012*math.sin(j/3*math.pi)
     verts.append((x,h,z));uv.append((u,j/3))
   faces=[]
   for j in range(3):
    for i in range(8):q=j*9+i;faces.append((q,q+1,q+10,q+9) if side==1 else (q+9,q+10,q+1,q))
   mesh('Overlapping rolled roof tile',verts,faces,roofmat,uv)
 # Roof fascia and gutter run along frontage or rear.
 z=2.85+side*3.22;box('Roof fascia',(0,4.92,z),(8.98,.16,.09),wood,.014)
 tube('Half round gutter',[(x,4.95,z+side*.06) for x in [-4.46,4.46]],.053,metal)
from gable_details import add_gables
add_gables(scene,wood,plaster,mesh,box,P)
# Ridge cap semi cylindrical profile oriented across x.
for k in range(25):
 x=-4.48+k*.36;vs=[]
 for j in range(2):
  for i in range(13):
   t=math.pi*i/12;vs.append((x+j*.385,5.58+.07*math.sin(t),2.85+.11*math.cos(t)))
 mesh('Ceramic ridge cap',vs,[(i,i+1,i+14,i+13) for i in range(12)],roofmat)
for x in [-4.22,4.22]:
 tube('Rain downpipe',[(x,4.91,-.36),(x,4.77,-.36),(x,4.62,-.22),(x,.32,-.22),(x,.16,-.12)],.040,metal)
 for y in [.6,2.1,4.2]:box('Downpipe wall bracket',(x,y,-.18),(.125,.035,.12),brass,.008)
# Counter matches contract center/top. Front slatwork; no items in entry-to-counter route.
box('Counter carcase',(0,.54,3.43),(7.97,1.06,.65),wood,.028)
box('Counter toe recess',(0,.12,3.065),(7.8,.18,.055),dark,.009)
for i in range(48):box('Counter fluted batten',(-3.88+i*.165,.61,3.077),(.045,.77,.028),wood,.01)
box('Counter stone top',(0,1.105,3.4),(8.10,.11,.84),ivory,.035)
box('Counter front brass inlay',(0,1.079,2.973),(7.96,.012,.005),brass,.002)
# Back worktop, cabinets, floating storage, porcelain tile splashback.
for x in [-3,-1.5,0,1.5,3]:
 box('Kitchen cabinet',(x,.45,5.2),(1.46,.86,.68),wood,.015)
 box('Kitchen panel seam',(x,.45,4.844),(.012,.68,.012),dark,.002)
 for xx in [x-.10,x+.10]:tube('Cabinet pull',[(xx,.63,4.81),(xx,.69,4.77),(xx,.78,4.77),(xx,.81,4.81)],.009,brass)
box('Preparation stainless worktop',(0,.92,5.16),(7.66,.065,.85),metal,.018)
for j in range(4):
 for i in range(30):box('Glazed splashback tile',(-3.85+i*.265,1.15+j*.18,5.472),(.253,.168,.018),ivory,.007)
for y in [1.98,2.4]:
 box('Floating crockery shelf',(-2.5,y,5.20),(2.50,.05,.49),wood,.01)
 for x in [-3.48,-1.55]:tube('Shelf iron bracket',[(x,y-.20,5.43),(x,y-.04,5.05),(x,y,5.43)],.012,brass)
for k in range(9):
 for level in range(3):lathe('Stacked ceramic bowl',-3.44+(k%5)*.43,2.02+(k//5)*.42+level*.027,5.14,[(.065,0),(.13,.02),(.145,.10),(.133,.106),(.12,.033)],ivory,24)
# Sink inset basin rim with modeled bowl, faucet; cooking kettle.
lathe('Wash basin',2.2,.80,5.11,[(.18,0),(.26,.06),(.29,.15),(.31,.16),(.28,.17),(.25,.07),(.17,.015)],metal,36)
tube('Curved faucet',[(2.2+.18*math.cos(t),1.1+.22*math.sin(t),5.38) for t in [i*math.pi/18 for i in range(19)]],.017,metal)
lathe('Rice kettle',3.3,.96,5.10,[(0,0),(.23,0),(.29,.08),(.29,.36),(.25,.39),(.20,.41),(0,.43)],ivory,40)
lathe('Kettle lid handle',3.3,1.39,5.1,[(.055,0),(.057,.05),(.035,.07),(0,.07)],dark,20)
label('Daily board',2,0,2.17,5.445,2.6,.56)
# Lamps with actual turned shade, socket and cord. No exported illumination.
for x in [-2.65,0,3.505]:
 tube('Pendant cord',[(x,2.93,3.50),(x,3.502,3.50)],.009,dark)
 lathe('Pendant shade',x,2.37,3.50,[(.28,0),(.275,.025),(.18,.13),(.08,.20),(.055,.23),(.036,.23),(.056,.18),(.155,.10),(.25,.01)],ivory,48)
 ell('Frosted pendant bulb',(x,2.415,3.50),(.08,.07,.08),ivory)
# Bento trays: subdivided lacquer compartments, paper liner, grain/rice, glazed pieces and garnish.
for b in range(5):
 x=-3.10+b*1.10;z=3.36
 box('Bento tray base',(x,1.183,z),(.87,.045,.50),black,.038)
 for dx in [-.426,.426]:box('Bento tray rim',(x+dx,1.223,z),(.026,.075,.49),black,.011)
 for dz in [-.237,.237]:box('Bento tray rim',(x,1.223,z+dz),(.86,.075,.026),black,.012)
 box('Bento divider',(x+.02,1.212,z),(.023,.065,.44),black,.008)
 box('Rice paper liner',(x-.21,1.212,z),(.37,.012,.43),ivory,.024)
 for j in range(7):
  for i in range(7):
   xx=x-.36+i*.045+random.uniform(-.008,.008);zz=z-.17+j*.052+random.uniform(-.01,.01)
   o=ell('Individual rice grain',(xx,1.246+random.uniform(0,.012),zz),(.017,.012,.027),rice,10,6);o.rotation_euler.z=random.random()*math.pi
 ell('Umeboshi center',(x-.20,1.281,z),(.039,.025,.036),red)
 for k in range(3):
  o=ell('Teriyaki chicken cut',(x+.20,1.269,z-.13+k*.124),(.13,.042,.060),fish,20,10);o.rotation_euler.z=.12
  for s in range(3):tube('Grill glaze detail',[(x+.105+s*.085,1.305,z-.173+k*.124),(x+.10+s*.085,1.31,z-.087+k*.124)],.003,dark)
 for k in range(4):ell('Pickled greens',(x+.36,1.26,z-.14+k*.083),(.031,.023,.034),green,12,6)
# Discrete shelf price cards and register on right.
for x in [-2.75,-.55,1.65]:
 box('Small menu card',(x,1.235,3.03),(.50,.16,.014),ivory,.006);label('Price card',6,x,1.24,3.02,.475,.14)
box('Register base',(3.25,1.21,3.4),(.50,.10,.36),dark,.04)
box('Register upright',(3.25,1.40,3.46),(.07,.30,.07),metal,.01)
o=box('Register screen',(3.25,1.56,3.46),(.45,.28,.043),dark,.023);o.rotation_euler.x=-.2
# Menu is at x=-2.45; storefront copy does not move target.
box('Exterior menu wood frame',(-2.45,1.45,-.105),(1.17,.82,.065),wood,.017)
label('Exterior menu',1,-2.45,1.45,-.141,1.06,.70)
label('Open plaque',4,1.31,1.77,-.153,.35,.19)
# Plants: lathed thick pots, hand-shaped tapered leaves with midrib and curved tips.
for x,z,height in [(-3.65,-.62,.85),(3.62,-.56,1.04),(-3.58,4.7,.70)]:
 lathe('Terracotta planter',x,0,z,[(.17,0),(.19,.025),(.24,.32),(.255,.33),(.254,.375),(.218,.375),(.205,.325),(.16,.04)],earth,40)
 lathe('Visible soil',x,.328,z,[(0,0),(.212,0)],soil,24)
 for k in range(13):
  ang=k*2.399;h=height*(.65+.35*random.random());reach=.25+.15*random.random();base=(x,.34,z);tip=(x+math.cos(ang)*reach,h,z+math.sin(ang)*reach)
  tube('Plant stem',[base,(x+math.cos(ang)*reach*.3,h*.73,z+math.sin(ang)*reach*.3),tip],.006,leaf1)
  vs=[];uv=[]
  for j in range(13):
   t=j/12;w=.080*math.sin(math.pi*t)**.8;xx=x+math.cos(ang)*reach*t;zz=z+math.sin(ang)*reach*t;yy=.39+(h-.39)*t+.12*math.sin(math.pi*t)
   for s in [-1,0,1]:vs.append((xx-math.sin(ang)*w*s,yy-abs(s)*.024*math.sin(math.pi*t),zz+math.cos(ang)*w*s));uv.append(((s+1)/2,t))
  mesh('Curled lanceolate leaf',vs,[(j*3+i,j*3+i+1,j*3+i+4,j*3+i+3) for j in range(12) for i in range(2)],leaf1 if k%2 else leaf2,uv)
# Anchor empties export with names. Directions measured by viewer, not asserted after LH conversion.
for name,pos in [('ANCHOR_door',(0,0,0)),('ANCHOR_interior',(0,0,5)),('ANCHOR_right',(1,0,0)),('ANCHOR_counter',(0,1.16,3.4)),('ANCHOR_npc',(.4,0,4.25))]:
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=P(*pos)
# Save the editable authoring file before mesh baking/batching.

for im in bpy.data.images:
 if im.source=='FILE':im.filepath=bpy.path.relpath(im.filepath,start=str(S))
scene.world.color=(.45,.45,.45);scene.render.engine='CYCLES';scene.cycles.samples=16
bpy.ops.wm.save_as_mainfile(filepath=str(S/'yorimichi-shop.blend'),compress=True)
# Convert evaluated copies; retain original .blend intact. Curves and edge treatments survive GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in list(scene.objects):
 if o.type in {'MESH','CURVE'}:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.type=='MESH');bpy.ops.object.convert(target='MESH')
groups={}
for o in list(scene.objects):
 if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='shop_'+name.split(' |')[0]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(A/'yorimichi-shop.glb'),export_format='GLB',export_yup=True,export_apply=True,export_tangents=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
print('SHOP_EXPORTED')

import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from optimize_glb import optimize
optimize(A/'yorimichi-shop.glb')
