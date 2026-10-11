// 3D 世界渲染：透视「微缩景观」相机 + 泛光（赛博朋克霓虹）+ 雾 + 雨。画布在界面里占满，HUD 用 DOM 叠在上面。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
  /** 相机跟随点 / 视角 */
  focus = new THREE.Vector3();
  yaw = 0.5; pitch = 1.0; dist = 44;
  private rain: THREE.LineSegments | null = null;
  private last = 0;
  private raf = 0;
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
    this.scene.environmentIntensity = 0.28;
    pm.dispose();
    // 灯光：冷色月光 + 半球天光（霓虹点光在关卡里加）
    this.scene.add(new THREE.HemisphereLight(0x6a78e0, 0x2a1840, 0.95));
    this.sun = new THREE.DirectionalLight(0x9db4ff, 1.35);
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
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.onUpdate(dt, this.time);
      this.render(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  dispose() { this.stop(); this.renderer.dispose(); }
}
