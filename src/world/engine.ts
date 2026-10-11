// 3D 世界渲染：透视「微缩景观」相机 + 泛光（赛博朋克霓虹）+ 雾 + 雨。画布在界面里占满，HUD 用 DOM 叠在上面。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface WorldQuality { bloom: boolean; shadows: boolean; rain: boolean; pixelRatio: number }
export const defaultQuality = (): WorldQuality => {
  const mobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return { bloom: true, shadows: !mobile, rain: true, pixelRatio: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2) };
};

export class WorldView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  readonly sun: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  /** 相机跟随点 / 视角 */
  focus = new THREE.Vector3();
  yaw = 0.5; pitch = 1.0; dist = 44;
  private rain: THREE.LineSegments | null = null;
  private last = 0;
  private raf = 0;
  /** 自适应画质：连续掉帧就逐级降（雨 → 阴影 → 泛光 → 分辨率） */
  private slow = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  qualityLevel = 0;
  onQuality: (level: number) => void = () => undefined;
  time = 0;
  onUpdate: (dt: number, t: number) => void = () => undefined;
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ptrs = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private downAt = 0;
  onTap: (p: THREE.Vector3, ndc: THREE.Vector2) => void = () => undefined;

  constructor(readonly canvas: HTMLCanvasElement, public q: WorldQuality = defaultQuality()) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.bloom, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
    this.scene.background = new THREE.Color(0x120a24);
    this.scene.fog = new THREE.FogExp2(0x1a1030, 0.0075);
    // 环境反射（让湿地面、玻璃、金属有反光）
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.2;
    pm.dispose();
    // 灯光：冷色月光 + 半球天光（霓虹点光在关卡里加）
    this.hemi = new THREE.HemisphereLight(0x5a68d0, 0x1c1030, 0.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0x8aa4ff, 0.6);
    this.sun.position.set(-30, 50, 24);
    if (q.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera; c.left = -42; c.right = 42; c.top = 42; c.bottom = -42; c.near = 10; c.far = 140;
      this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    }
    this.scene.add(this.sun);
    if (q.rain) this.makeRain();
    this.bindInput();
    this.resize();
  }

  /** 按关卡氛围换天光 / 雾色 / 背景色 */
  setMood(m: string) {
    const T: Record<string, [number, number, number, number]> = { // [天光, 地光, 雾/背景, 月光]
      neon: [0x5a68d0, 0x1c1030, 0x1a1030, 0x8aa4ff], street: [0x5a68d0, 0x1c1030, 0x1a1030, 0x8aa4ff], meadow: [0x5a68d0, 0x1c1030, 0x1a1030, 0x8aa4ff],
      market: [0x7a5a60, 0x2a1418, 0x2a1018, 0xffb080], redcliff: [0x8a4a40, 0x2a1010, 0x2a0e12, 0xff8a60],
      forest: [0x3a8a70, 0x0e2018, 0x0c2018, 0x9affc8], mist: [0x6a82c8, 0x1c2440, 0x1a2444, 0xc8d8ff], palace: [0x8a62c0, 0x241038, 0x241038, 0xffd8f0],
    };
    const [sky, gnd, fog, sun] = T[m] ?? T.neon;
    this.hemi.color.set(sky); this.hemi.groundColor.set(gnd);
    (this.scene.fog as THREE.FogExp2).color.set(fog); (this.scene.background as THREE.Color).set(new THREE.Color(fog).multiplyScalar(0.75));
    this.sun.color.set(sun);
  }

  private makeRain() {
    const N = 900, pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 90, y = Math.random() * 40, z = (Math.random() - 0.5) * 90; pos.set([x, y, z, x - 0.05, y - 1.2, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: 0.32, toneMapped: false, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 400, h = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 700;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 竖屏时拉远一点，保证左右看得到
    this.camera.fov = w / h < 0.8 ? 38 : 30;
    this.camera.updateProjectionMatrix();
    if (this.q.bloom) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.72, 0.55, 0.78);
        this.composer.addPass(this.bloom);
        // 调色：暗部偏青蓝、亮部偏品红暖，边缘轻微色散 + 暗角
        this.composer.addPass(new ShaderPass({
          uniforms: { tDiffuse: { value: null } },
          vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;
          void main(){vec2 c=vUv-.5;float d=dot(c,c);vec2 off=c*d*0.014;
          vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
          float l=dot(col,vec3(.3,.6,.1));
          col=mix(col*vec3(.88,.95,1.18),col*vec3(1.12,.98,1.02),smoothstep(.15,.9,l));
          col*=1.0-d*1.25;gl_FragColor=vec4(col,1.);}`,
        }));
        this.composer.addPass(new OutputPass());
      }
      this.composer.setPixelRatio(this.q.pixelRatio);
      this.composer.setSize(w, h);
    }
  }

  /** 屏幕坐标 → 地面交点 */
  pick(clientX: number, clientY: number): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.ground, p) ? p : null;
  }

  private bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = 0; this.downAt = performance.now(); });
    c.addEventListener('pointermove', (e) => {
      const p = this.ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (this.ptrs.size === 1) { this.moved += Math.abs(dx) + Math.abs(dy); if (this.moved > 10) { this.yaw -= dx * 0.006; this.pitch = Math.min(1.25, Math.max(0.55, this.pitch + dy * 0.004)); } }
      else if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()]; const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const [a2, b2] = [...this.ptrs.values()]; const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
        this.dist = Math.min(130, Math.max(24, this.dist * (before / Math.max(1, after)))); this.moved = 99; return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      if (this.ptrs.has(e.pointerId) && this.ptrs.size === 1 && this.moved < 10 && performance.now() - this.downAt < 450) {
        const pt = this.pick(e.clientX, e.clientY);
        if (pt) this.onTap(pt, new THREE.Vector2(e.clientX, e.clientY));
      }
      this.ptrs.delete(e.pointerId);
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.min(130, Math.max(24, this.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  }

  private placeCamera(dt: number) {
    const d = this.dist, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const want = new THREE.Vector3(this.focus.x + Math.sin(this.yaw) * cp * d, this.focus.y + sp * d, this.focus.z + Math.cos(this.yaw) * cp * d);
    this.camera.position.lerp(want, Math.min(1, dt * 8));
    this.camera.lookAt(this.focus.x, this.focus.y + 1.5, this.focus.z);
  }


  /** 战斗背景：从街面高度拍一张当前街景（隐藏所有小猫），给 2D 战斗当底图。失败返回 null。 */
  backdrop(w = 960, h = 600): HTMLCanvasElement | null {
    try {
      const hidden: THREE.Object3D[] = [];
      this.scene.traverse((o) => { if (o.visible && (o.name === 'cat' || ((o as THREE.Sprite).isSprite && ((o as THREE.Sprite).material as THREE.SpriteMaterial).depthTest === false))) { o.visible = false; hidden.push(o); } });
      const keep = { pos: this.camera.position.clone(), aspect: this.camera.aspect, fov: this.camera.fov, rain: this.rain?.visible };
      const cw = this.canvas.width, ch = this.canvas.height;
      this.renderer.setSize(w, h, false);
      this.composer?.setSize(w, h);
      this.camera.aspect = w / h; this.camera.fov = 34; this.camera.updateProjectionMatrix();
      // 沿最近的一条马路方向（yaw 取 π/2 的整数倍），低机位看出去，地面落在画面下三分之一
      const yaw = Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2) + 0.12;
      const cp = Math.cos(0.2), sp = Math.sin(0.2), d = 26, f = this.focus;
      this.camera.position.set(f.x + Math.sin(yaw) * cp * d, f.y + 1.6 + sp * d * 0.5, f.z + Math.cos(yaw) * cp * d);
      this.camera.lookAt(f.x, f.y + 3.4, f.z);
      if (this.composer) this.composer.render(0); else this.renderer.render(this.scene, this.camera);
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const g = out.getContext('2d')!;
      g.drawImage(this.canvas, 0, 0, w, h);
      // 还原
      for (const o of hidden) o.visible = true;
      this.renderer.setSize(cw / this.renderer.getPixelRatio(), ch / this.renderer.getPixelRatio(), false);
      this.camera.position.copy(keep.pos); this.camera.aspect = keep.aspect; this.camera.fov = keep.fov; this.camera.updateProjectionMatrix();
      this.resize();
      // 压暗：让上面的小猫和血条更清楚
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(8,4,20,.25)'); gr.addColorStop(0.55, 'rgba(8,4,20,.35)'); gr.addColorStop(1, 'rgba(8,4,20,.55)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      return out;
    } catch { return null; }
  }

  /** 相机立刻到位（切换场景 / 截图用） */
  snapCamera() { this.camera.position.set(1e6, 1e6, 1e6); this.placeCamera(1); }

  render(dt = 0) {
    this.time += dt;
    this.placeCamera(dt);
    if (this.rain) {
      const a = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const fy = this.focus.y;
      for (let i = 0; i < a.count; i += 2) {
        let y = a.getY(i) - dt * 34;
        if (y < fy - 0.5) y += 40;
        a.setY(i, y); a.setY(i + 1, y - 1.2);
      }
      a.needsUpdate = true;
      this.rain.position.set(Math.round(this.focus.x / 45) * 45 * 0, 0, 0);
    }
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const raw = (now - this.last) / 1000;
      const dt = Math.min(0.05, raw); this.last = now;
      this.watchFps(raw);
      this.onUpdate(dt, this.time);
      this.render(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  /** 平滑帧率（调试 / 设置里显示） */
  fps = 0;
  /** 手动画质：true 时不再自动降档 */
  lockQuality = false;
  get level() { return this.qualityLevel; }
  /** 手动设定画质档位：0 全开 … 3 关光晕 / 4 最低；只能往下压（场景重载时重新套用） */
  forceLevel(n: number) { while (this.qualityLevel < n) this.degrade(); }
  private watchFps(raw: number) {
    if (raw > 0.5) return; // 切后台 / 战斗浮层后恢复的第一帧，不算
    this.fps = this.fps ? this.fps * 0.92 + (1 / raw) * 0.08 : 1 / raw;
    if (this.lockQuality) return;
    this.fpsAcc += raw; this.fpsN++;
    if (this.fpsN < 90) return;
    const avg = this.fpsAcc / this.fpsN; this.fpsAcc = 0; this.fpsN = 0;
    this.slow = avg > 0.034 ? this.slow + 1 : 0; // 平均低于 ~30fps
    if (this.slow >= 2 && this.qualityLevel < 4) { this.slow = 0; this.degrade(); }
  }
  private degrade() {
    this.qualityLevel++;
    const L = this.qualityLevel;
    if (L === 1 && this.rain) this.rain.visible = false;
    if (L === 2) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; }); }
    if (L === 3) { this.q.bloom = false; this.composer = null; this.renderer.setPixelRatio(Math.min(this.q.pixelRatio, 1.25)); this.resize(); }
    if (L === 4) { this.renderer.setPixelRatio(1); this.resize(); }
    this.onQuality(L);
  }
  /** 当前一帧的绘制统计（调试 / 性能预算） */
  stats() { const i = this.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  dispose() { this.stop(); this.renderer.dispose(); }
}
