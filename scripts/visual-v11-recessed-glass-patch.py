from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:220]
    s=s.replace(old,new)

rep("const warmWindow=emissiveMat('warm-window','#ffd59a',.42);const lampGlow=emissiveMat('lamp-glow','#ffc879',.58);", "const warmWindow=emissiveMat('warm-window','#ffd59a',.42);const lampGlow=emissiveMat('lamp-glow','#ffc879',.58);const glassDay=new StandardMaterial('cool-window-glass',scene);glassDay.diffuseColor=Color3.FromHexString('#6f817d');glassDay.specularColor=Color3.FromHexString('#d7e0dc').scale(.44);glassDay.specularPower=96;glassDay.emissiveColor=Color3.FromHexString('#263633').scale(.15);")
old="""  function windowFrame(root:TransformNode,x:number,y:number,w:number,h:number,z:number){
    box(w+.12,h+.12,.14,x,y,z,'#66594c',root);box(w,h,.06,x,y,z-.09,'#aec8bf',root);
    box(.05,h,.08,x,y,z-.15,'#efdfc2',root);box(w,.045,.08,x,y-.05,z-.15,'#efdfc2',root);
    // Glazing highlight and recessed sill.
    box(w*.36,h*.82,.02,x-w*.28,y+.025,z-.14,'#c3d5c8',root);box(w+.22,.11,.34,x,y-h/2-.08,z-.08,'#786e59',root);
  }
"""
new="""  function windowFrame(root:TransformNode,x:number,y:number,w:number,h:number,z:number){
    box(w+.12,h+.12,.14,x,y,z,'#66594c',root);const pane=box(w,h,.045,x,y,z+.045,'#6f817d',root);pane.material=glassDay;
    // Frames sit forward of the glass; the pane now reads as genuinely recessed instead of pasted onto the facade.
    box(.05,h,.065,x,y,z-.07,'#e6d8bc',root);box(w,.045,.065,x,y-.05,z-.07,'#e6d8bc',root);
    box(w*.18,h*.80,.014,x-w*.30,y+.025,z+.018,'#9eafa9',root);box(w+.22,.11,.34,x,y-h/2-.08,z-.015,'#786e59',root);
  }
"""
rep(old,new)
p.write_text(s)
