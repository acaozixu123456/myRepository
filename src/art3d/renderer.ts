// 共享的 3D 渲染器：一个离屏 WebGL 画布，每次把一只猫画进去，再 drawImage 贴回主 Canvas 2D（特效 / 血条 / 层次照旧走 2D）。
import * as THREE from 'three';
import type { Cat3D } from './cat3d';

/** 取景范围（3D 单位）：猫脚底 y=0，高约 2.6；左右留足武器 / 披风空间 */
export const FRAME = { x0: -2.2, x1: 2.2, y0: -0.25, y1: 3.6 };
/** 战斗骨骼单位（猫高 ≈560）对应的 3D 单位：1 个 3D 单位 = K 骨骼单位 */
export const K = 168;

export class Renderer3D {
  private static inst: Renderer3D | null | undefined;
  static get(): Renderer3D | null {
    if (Renderer3D.inst === undefined) {
      try { Renderer3D.inst = new Renderer3D(); } catch { Renderer3D.inst = null; }
    }
    return Renderer3D.inst;
  }
  static get ok() { return Renderer3D.get() !== null; }

  readonly canvas: HTMLCanvasElement;
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private key: THREE.DirectionalLight;

  private constructor() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    this.r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    this.r.setPixelRatio(1);
    this.r.setClearColor(0x000000, 0);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = c;
    this.cam = new THREE.OrthographicCamera(FRAME.x0, FRAME.x1, FRAME.y1, FRAME.y0, 0.1, 50);
    this.cam.position.set(0, 0, 10);
    this.cam.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    this.key = new THREE.DirectionalLight(0xffffff, 1.45);
    this.key.position.set(-3, 5, 6); // 左上前方
    this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.4);
    rim.position.set(4, 2, -4);
    this.scene.add(rim);
  }

  /**
   * 画一只猫到 GL 画布左下角 pw×ph 的区域。yaw：朝向（弧度，正 = 面朝画面右侧）。
   * 返回可直接 drawImage 的源矩形。
   */
  render(cat: Cat3D, pw: number, ph: number, yaw: number): [number, number, number, number] {
    const c = this.canvas;
    if (c.width < pw || c.height < ph) this.r.setSize(Math.max(c.width, pw), Math.max(c.height, ph), false);
    this.r.setViewport(0, 0, pw, ph);
    this.r.setScissor(0, 0, pw, ph);
    this.r.setScissorTest(true);
    cat.root.rotation.y = yaw;
    this.scene.add(cat.root);
    this.r.render(this.scene, this.cam);
    this.scene.remove(cat.root);
    return [0, this.canvas.height - ph, pw, ph];
  }
}
