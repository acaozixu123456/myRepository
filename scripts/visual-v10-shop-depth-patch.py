from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:220]
    s=s.replace(old,new)

old="""        const shopLight=new PointLight('shop-warm-light',new Vector3(0,2.15,2.5),scene);shopLight.parent=root;shopLight.diffuse=Color3.FromHexString('#ffd3a0');shopLight.specular=Color3.FromHexString('#d99b68');shopLight.intensity=.72;shopLight.range=8.5;
        for(const lx of [-2.0,0,2.0]){const bulb=sphere(.055,.055,.055,lx,2.42,2.4,'#f4c27d',root,false);bulb.material=lampGlow;}
        for(let i=0;i<4;i++){cyl(.40,.47,.2,-2.4+i*1.55,2.60,2,'#eee1bf',root);sphere(.15,.06,.15,-2.4+i*1.55,2.48,2,'#fff2c9',root);}
"""
new="""        const shopLight=new PointLight('shop-warm-light',new Vector3(0,2.15,2.5),scene);shopLight.parent=root;shopLight.diffuse=Color3.FromHexString('#ffd3a0');shopLight.specular=Color3.FromHexString('#d99b68');shopLight.intensity=.72;shopLight.range=8.5;
        for(const lx of [-2.0,0,2.0]){const bulb=sphere(.055,.055,.055,lx,2.42,2.4,'#f4c27d',root,false);bulb.material=lampGlow;}
        // Give the hero shop visible depth: back-wall shelves, jars, pendant shades and a slatted counter front.
        for(const sx of [-2.65,2.65]){
          for(const sy of [3.05,3.88])box(2.05,.11,.38,sx,sy,5.28,'#6a503a',root);
          for(let j=0;j<4;j++){const x=sx-.72+j*.48;cyl(.18,.22,.34,x,3.28,5.20,j%2?'#b68958':'#89977d',root);sphere(.12,.055,.12,x,3.49,5.20,'#d8c9a7',root);}
          for(let j=0;j<3;j++){const x=sx-.54+j*.54;box(.38,.22,.28,x,4.08,5.16,j%2?'#d9c8a7':'#b79169',root);box(.31,.035,.22,x,4.22,5.15,'#eee1c5',root);}
        }
        label('お茶とお惣菜',1.72,.55,-2.63,2.53,5.49,'#d8c9aa','#4c554a',root);label('今日も手づくり',1.72,.55,2.63,2.53,5.49,'#d8c9aa','#4c554a',root);
        for(const lx of [-2.25,2.25]){cyl(.035,.035,1.05,lx,3.83,2.75,'#4d4033',root);const shade=cyl(.30,.58,.28,lx,3.28,2.75,'#7a5d42',root);shade.material=mat('#7a5d42');const glow=sphere(.075,.075,.075,lx,3.14,2.75,'#ffc77f',root,false);glow.material=lampGlow;}
        for(let x=-3.62;x<3.7;x+=.43)box(.055,.43,.035,x,.63,3.02,x%1>.4?'#806044':'#684b36',root);
        for(const sx of [-2.7,2.7]){box(1.15,.075,.62,sx,1.18,3.26,'#d7c39d',root);for(let j=0;j<3;j++){box(.30,.09,.39,sx-.36+j*.36,1.27,3.24,'#eadcbc',root);sphere(.09,.035,.12,sx-.36+j*.36,1.34,3.22,j%2?'#a86642':'#71845d',root,false);}}
        for(let i=0;i<4;i++){cyl(.40,.47,.2,-2.4+i*1.55,2.60,2,'#eee1bf',root);sphere(.15,.06,.15,-2.4+i*1.55,2.48,2,'#fff2c9',root);}
"""
rep(old,new)
p.write_text(s)
