// 背卷与通用旌旗：几何只在装配时生成，根保持 back 插槽的单位变换。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

type ClothPoint = (t: number, u: number) => THREE.Vector3;

/** 有厚度的布片；前后两层与四边封口，避免单面板的硬黑边。 */
function cloth(point: ClothPoint, rows = 16, cols = 6, thick = .018): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const p = point(r / rows, c / cols);
      vertices.push(p.x, p.y, p.z + side * thick / 2);
    }
  }
  const stride = cols + 1, layer = stride * (rows + 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * stride + c, b = a + 1, d = a + stride, e = d + 1;
    indices.push(a, b, d, b, e, d, a + layer, d + layer, b + layer, b + layer, d + layer, e + layer);
  }
  const edge = (a: number, b: number) => {
    // 封口独立顶点保留薄布的转角；不将侧边法线平均到布面。
    const first = vertices.length / 3;
    for (const i of [a, b, a + layer, b + layer]) vertices.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
    indices.push(first + 1, first, first + 2, first + 1, first + 2, first + 3);
  };
  for (let c = 0; c < cols; c++) { edge(c, c + 1); edge(rows * stride + c + 1, rows * stride + c); }
  for (let r = 0; r < rows; r++) { edge((r + 1) * stride, r * stride); edge(r * stride + cols, (r + 1) * stride + cols); }
  // 左右镜像直接写入坐标后，保持封闭表面朝外的绕序。
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, d = indices[i + 2] * 3;
    volume += vertices[a] * (vertices[b + 1] * vertices[d + 2] - vertices[b + 2] * vertices[d + 1]) + vertices[a + 1] * (vertices[b + 2] * vertices[d] - vertices[b] * vertices[d + 2]) + vertices[a + 2] * (vertices[b] * vertices[d + 1] - vertices[b + 1] * vertices[d]);
  }
  if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function seam(points: THREE.Vector3[], color: string, radius = .018): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 6, false), toon(color), .006);
}

const sample = (point: ClothPoint, alongU: boolean, fixed: number) => Array.from({ length: 13 }, (_, i) => point(alongU ? fixed : i / 12, alongU ? i / 12 : fixed));

/** 纸卷与木轴梢连成卷包；短背带实际接到收腰束结。 */
export function scrollBack(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'back-tied-paper-scroll';
  const roll = new THREE.Group(); roll.name = 'scroll-roll';
  roll.position.set(-.23, -.08, -.20); roll.rotation.z = .70; g.add(roll);
  const paper = '#f1e6c8'; // 沿用旧卷的暖纸色，和浅白道袍保留反差。
  const body = solid(new THREE.CylinderGeometry(.14, .14, .78, 20), toon(paper), .010);
  body.name = 'scroll-paper-roll'; roll.add(body);
  const spindle = solid(new THREE.CylinderGeometry(.045, .045, 1.00, 12), toon(c.pal.sub), .008);
  spindle.name = 'scroll-wood-spindle'; roll.add(spindle);
  for (const side of [-1, 1]) {
    const cap = solid(sphere(.074, 1, .68, 1, 12), toon(c.pal.trim), .006);
    cap.name = 'scroll-rounded-axis-end'; cap.position.y = side * .495; roll.add(cap);
    const rim = solid(new THREE.TorusGeometry(.122, .017, 6, 20), toon(paper), .004);
    rim.name = 'scroll-paper-end-ring'; rim.rotation.x = Math.PI / 2; rim.position.y = side * .395; roll.add(rim);
    const spiral = seam(Array.from({length:25},(_,i)=>{
      const t=i/24, a=t*Math.PI*3.3, r=.022+.086*t;
      return new THREE.Vector3(Math.cos(a)*r,side*.399,Math.sin(a)*r);
    }), c.pal.trim, .006);
    spiral.name = 'scroll-paper-end-spiral'; roll.add(spiral);
  }
  const flap: ClothPoint = (t,u) => new THREE.Vector3(-.085+.17*u, -.31+.60*t,
    -.135-.05*Math.sin(u*Math.PI)-.016*Math.sin(t*Math.PI));
  const wrap = solid(cloth(flap,12,4,.012), toon(paper), .006);
  wrap.name = 'scroll-paper-overlap'; roll.add(wrap);
  const edge = seam(sample(flap,false,1), c.pal.sub, .009); edge.name='scroll-wrap-edge';roll.add(edge);
  const waist = solid(new THREE.TorusGeometry(.151, .027, 6, 20), toon(c.pal.sub), .005);
  waist.name = 'scroll-waist-binding'; waist.rotation.x=Math.PI/2;roll.add(waist);
  const knot = solid(sphere(.049,1.18,.75,.55,12),toon(c.pal.trim),.005);
  knot.name='scroll-binding-knot';knot.position.set(0,-.015,-.188);roll.add(knot);
  for(const side of [-1,1]){
    const cord=seam([new THREE.Vector3(0,-.015,-.188),new THREE.Vector3(side*.09,-.13,-.21),new THREE.Vector3(side*.07,-.235,-.185)],c.pal.sub,.016);
    cord.name='scroll-binding-end';roll.add(cord);
  }
  roll.updateMatrix();
  const tied = new THREE.Vector3(0,-.015,-.16).applyMatrix4(roll.matrix);
  const b=c.look.build??1;
  const sling=seam([new THREE.Vector3(.26*b,-.05,.45-.34*b),new THREE.Vector3(.18,.005,-.12),new THREE.Vector3(-.08,-.035,-.22),tied],c.pal.sub,.028);
  sling.name='scroll-attached-back-sling';g.add(sling);
  return g;
}

/** 未分配给任何角色的通用旌旗；猫爪符文直接贴合后向布面。 */
export function banner(c: PartCtx): THREE.Group {
  const g=new THREE.Group();g.name='back-soft-paw-banner';
  // 大头共用者仍按头宽留侧距，旗杆不从颅骨或耳根中穿出。
  const x=.86*(c.look.head??1)+.12, z=-.28;
  const pole=solid(new THREE.CylinderGeometry(.035,.041,1.65,12),toon('#6a4a30'),.008);
  pole.name='banner-round-pole';pole.position.set(x,.44,z);g.add(pole);
  const tip=solid(sphere(.074,1,.92,1,12),toon(c.pal.trim),.007);
  tip.name='banner-rounded-finial';tip.position.set(x,1.30,z);g.add(tip);
  const ferrule=solid(new THREE.CylinderGeometry(.047,.047,.12,12),toon(c.pal.trim),.005);
  ferrule.name='banner-foot-ferrule';ferrule.position.set(x,-.335,z);g.add(ferrule);
  const flag:ClothPoint=(t,u)=>new THREE.Vector3(x+.045+.58*u,
    1.19-.83*t+.055*Math.sin(u*Math.PI)*(1-t),
    z-.045-.075*Math.sin(u*Math.PI*1.6)-.025*Math.sin(t*Math.PI));
  const fabric=solid(cloth(flag,14,8,.026),toon(c.pal.main),.010);
  fabric.name='banner-curved-cloth';g.add(fabric);
  const header:ClothPoint=(t,u)=>flag(.025+t*.10,u).add(new THREE.Vector3(0,0,-.019));
  const band=solid(cloth(header,4,8,.008),toon(c.pal.sub),0);band.name='banner-top-band';g.add(band);
  for(const edge of [0,1]){const hem=seam(sample(flag,true,edge),c.pal.trim,.016);hem.name='banner-soft-gold-hem';g.add(hem);}
  const b=c.look.build??1;
  for(const [y,bodyY] of [[.055,.57],[-.25,.43]]){
    const bind=solid(new THREE.TorusGeometry(.047,.015,6,16),toon(c.pal.sub),.004);
    bind.name='banner-pole-binding';bind.rotation.x=Math.PI/2;bind.position.set(x,y,z);g.add(bind);
    // back 比裸躯干后表面更靠后；绑带先接到随体型变化的后腰表面。
    const bodyX=.18*b;
    const rear=.41*b*Math.sqrt(Math.max(0,1-(bodyX/(.5*b))**2-((bodyY-.42)/(.59*b))**2));
    const sling=seam([new THREE.Vector3(bodyX,bodyY-.95,.45-rear+.006),new THREE.Vector3(.42*b,bodyY-.87,.45-rear-.11),new THREE.Vector3(.64,y-.025,-.17),new THREE.Vector3(x,y,z)],c.pal.sub,.026);
    sling.name='banner-attached-back-tie';g.add(sling);
  }
  // 浅浮雕从布面后侧长出；不使用文字纹理或悬浮标志。
  const emblem=(t:number,u:number,r:number,sx:number,sy:number,name:string)=>{
    const relief=sphere(r,sx,sy,.16,12),positions=relief.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const p=flag(t-positions.getY(i)/.83,u+positions.getX(i)/.58);
      positions.setXYZ(i,p.x,p.y,p.z-.034+positions.getZ(i));
    }
    relief.computeVertexNormals();
    const mark=solid(relief,toon(c.pal.trim),.004);
    mark.name=name;g.add(mark);
  };
  emblem(.57,.51,.105,1.18,.93,'banner-paw-pad');
  for(const [t,u]of [[.39,.29],[.32,.43],[.32,.62],[.40,.76]])emblem(t,u,.046,.91,1.12,'banner-paw-toe');
  // 前爪沿实际三角布面贴合；浅浮雕根部进入厚布，最深处仍在背面以内。
  const clothPositions=fabric.geometry.getAttribute('position'),clothIndex=fabric.geometry.getIndex()!;
  const frontStart=(14+1)*(8+1);
  const frontZ=(p:THREE.Vector3):number=>{
    for(let i=0;i<clothIndex.count;i+=3){
      const a=clothIndex.getX(i),b=clothIndex.getX(i+1),d=clothIndex.getX(i+2);
      if(a<frontStart||b<frontStart||d<frontStart||a>=frontStart*2||b>=frontStart*2||d>=frontStart*2)continue;
      const ax=clothPositions.getX(a),ay=clothPositions.getY(a),bx=clothPositions.getX(b),by=clothPositions.getY(b),dx=clothPositions.getX(d),dy=clothPositions.getY(d);
      const det=(by-dy)*(ax-dx)+(dx-bx)*(ay-dy);
      const wa=((by-dy)*(p.x-dx)+(dx-bx)*(p.y-dy))/det;
      const wb=((dy-ay)*(p.x-dx)+(ax-dx)*(p.y-dy))/det,wc=1-wa-wb;
      if(wa>=-1e-8&&wb>=-1e-8&&wc>=-1e-8)return wa*clothPositions.getZ(a)+wb*clothPositions.getZ(b)+wc*clothPositions.getZ(d);
    }
    throw new Error('Banner front paw outside cloth surface');
  };
  const frontEmblem=(t:number,u:number,r:number,sx:number,sy:number,name:string)=>{
    const relief=sphere(r,sx,sy,.16,12),positions=relief.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const depth=positions.getZ(i),p=flag(t-positions.getY(i)/.83,u+positions.getX(i)/.58);
      positions.setXYZ(i,p.x,p.y,frontZ(p)+.002+depth);
    }
    relief.computeVertexNormals();
    const mark=solid(relief,toon(c.pal.trim),.004);
    mark.name=name;g.add(mark);
  };
  frontEmblem(.57,.51,.105,1.18,.93,'banner-front-paw-pad');
  for(const [t,u]of [[.39,.29],[.32,.43],[.32,.62],[.40,.76]])frontEmblem(t,u,.046,.91,1.12,'banner-front-paw-toe');
  return g;
}

