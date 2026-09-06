from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:220]
    s=s.replace(old,new)

rep("""      const point=sampleRoad(s),root=new TransformNode(`facade-${side}-${index}`,scene);root.position.set(point.x+point.tz*4.03*side,0,point.z-point.tx*4.03*side);root.rotation.y=Math.atan2(point.tz*side,-point.tx*side);
      const shop=side===1 && index===3; if(shop)shopRoot=root;
      const w=8.55,h=shop?5.65:5.25+(index%3)*.55,d=5.7,colors=palettes[(index+(side===1?0:2))%palettes.length];
""", """      const point=sampleRoad(s),shop=side===1 && index===3,variant=(index*3+(side===1?1:4))%5;
      const setbacks=[0,.08,.18,.05,.24],widths=[8.42,8.70,8.86,8.54,8.76],heights=[5.02,5.40,5.86,5.20,5.64],depths=[5.45,5.80,5.62,5.94,5.35];
      const setback=shop?4.03:4.03+setbacks[variant],root=new TransformNode(`facade-${side}-${index}`,scene);root.position.set(point.x+point.tz*setback*side,0,point.z-point.tx*setback*side);root.rotation.y=Math.atan2(point.tz*side,-point.tx*side);
      if(shop)shopRoot=root;
      const w=shop?8.55:widths[variant],h=shop?5.65:heights[variant],d=shop?5.7:depths[variant],colors=palettes[(index+(side===1?0:2))%palettes.length];
""")
rep("""        box(w,h,d,0,h/2,d/2,colors[0],root,true);
        box(w-.35,2.43,.10,0,1.25,-.14,'#806e58',root);
        for(const x of [-2.7,0,2.7])windowFrame(root,x,1.45,2.25,1.64,-.25);
""", """        box(w,h,d,0,h/2,d/2,colors[0],root,true);
        box(w-.35,2.43,.10,0,1.25,-.14,'#806e58',root);
        const lowerXs=variant===1||variant===4?[-2.18,2.18]:variant===3?[-2.78,0,2.78]:[-2.62,0,2.62],lowerW=variant===1||variant===4?2.62:2.12;
        for(const x of lowerXs)windowFrame(root,x,1.45,lowerW,1.64,-.25);
""")
rep("""      for(const x of [-2.55,0,2.55]){windowFrame(root,x,4.09,1.65,1.37,-.18);for(let k=0;k<5;k++)box(.035,.46,.04,x-.7+k*.35,3.56,-.53,'#6d7765',root);box(1.74,.05,.07,x,3.81,-.53,'#6d7765',root);}
""", """      const upperXs=shop?[-2.55,0,2.55]:(variant===1||variant===4?[-2.12,2.12]:[-2.55,0,2.55]);
      for(const x of upperXs){windowFrame(root,x,4.09,variant===2?1.48:1.65,1.37,-.18);for(let k=0;k<5;k++)box(.035,.46,.04,x-.7+k*.35,3.56,-.53,'#6d7765',root);box(1.74,.05,.07,x,3.81,-.53,'#6d7765',root);}
""")
rep("""      const awningColor=shop?'#426b60':colors[2];
      const awning=box(w-.16,.10,1.2,0,2.79,-.65,awningColor,root);awning.rotation.x=-.14;
      box(w-.16,.23,.055,0,2.59,-1.25,awningColor,root);
      for(let j=0;j<12;j++){const trim=box(.17,.015,1.16,-w/2+.35+j*.7,2.855,-.64,'#dfd5b5',root);trim.rotation.x=-.14;}
""", """      const awningColor=shop?'#426b60':colors[2],awningWidth=shop?w-.16:(variant===1?w*.62:variant===4?w*.76:w-.16),awningX=shop?0:(variant===1?-.88:variant===4?.52:0),awningDepth=shop?1.2:(variant===3?.76:1.0+(variant%2)*.16);
      const awning=box(awningWidth,.10,awningDepth,awningX,2.79,-.65,awningColor,root);awning.rotation.x=-.14;
      box(awningWidth,.23,.055,awningX,2.59,-1.25,awningColor,root);
      const trimCount=Math.max(5,Math.floor(awningWidth/.7));for(let j=0;j<trimCount;j++){const trim=box(.17,.015,awningDepth,awningX-awningWidth/2+.35+j*.7,2.855,-.64,'#dfd5b5',root);trim.rotation.x=-.14;}
""")
p.write_text(s)
