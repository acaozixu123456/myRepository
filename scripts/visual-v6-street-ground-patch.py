from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:160]
    s=s.replace(old,new)

old="""  const roadMat=mat('#958a77');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);const c=roadTex.getContext();
  c.fillStyle='#9d927f';c.fillRect(0,0,512,512);let seed=19;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<14000;i++){const v=110+Math.floor(rand()*90);c.fillStyle=`rgba(${v},${v*.94},${v*.82},.24)`;c.fillRect(rand()*512,rand()*512,1+rand()*2,1+rand()*2);}
  c.strokeStyle='rgba(100,91,75,.2)';c.lineWidth=1;for(let y=0;y<512;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();for(let x=(y%128?32:0);x<512;x+=128){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+64);c.stroke();}}
  roadTex.update();roadTex.uScale=1.3;roadTex.vScale=4;roadMat.diffuseTexture=roadTex;
"""
new="""  const roadMat=mat('#62635f');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);const c=roadTex.getContext();
  c.fillStyle='#666762';c.fillRect(0,0,512,512);let seed=19;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  // Fine asphalt aggregate. Keep it irregular; the previous grid read like tiled flooring rather than a Japanese side street.
  for(let i=0;i<22000;i++){const v=68+Math.floor(rand()*92);const alpha=.09+rand()*.18;c.fillStyle=`rgba(${v},${v+Math.floor(rand()*5)},${v+Math.floor(rand()*4)},${alpha})`;const r=.45+rand()*1.35;c.fillRect(rand()*512,rand()*512,r,r);}
  // Subtle repaired seams and hairline cracks, intentionally sparse enough not to become a repeating pattern.
  for(let i=0;i<22;i++){let x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);for(let k=0;k<4;k++){x+=-18+rand()*36;y+=10+rand()*38;c.lineTo(x,y);}c.strokeStyle=`rgba(40,42,40,${.07+rand()*.08})`;c.lineWidth=.6+rand()*1.1;c.stroke();}
  for(let i=0;i<8;i++){const y=rand()*512;c.fillStyle=`rgba(44,46,44,${.025+rand()*.035})`;c.fillRect(0,y,512,4+rand()*15);}
  roadTex.update();roadTex.uScale=1.9;roadTex.vScale=7.2;roadMat.diffuseTexture=roadTex;roadMat.specularColor=new Color3(.025,.025,.023);roadMat.specularPower=20;
"""
rep(old,new)
rep("const paving=box(7.3,.1,len+.18,0,0,0,'#958a77',root,true);paving.material=roadMat;", "const paving=box(7.3,.1,len+.18,0,0,0,'#62635f',root,true);paving.material=roadMat;")
rep("for(const side of [-1,1]){box(.24,.15,len+.1,side*3.7,.035,0,'#d5c7af',root);box(.18,.04,len,side*3.48,.071,0,'#857f70',root);}", "for(const side of [-1,1]){box(.30,.13,len+.1,side*3.67,.025,0,'#85847d',root);box(.15,.028,len,side*3.47,.074,0,'#454846',root);for(let dz=-len/2+.7;dz<len/2;dz+=3.1)box(.06,.016,.44,side*3.45,.095,dz,'#343735',root);}")
rep("box(230,.2,270,0,-.23,80,'#b6bd99',undefined,true);", "box(230,.2,270,0,-.23,80,'#77796c',undefined,true);")
p.write_text(s)
