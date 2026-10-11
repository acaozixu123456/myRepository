// 木偶网格的 WebGL 绘制：一个共享的离屏 GL 画布，每次把一只猫画进去，再 drawImage 贴回主 Canvas 2D。
// 不需要 Three.js（~600KB）：这里只有「贴图 + 网格 + 一个着色器」，和现有的 Canvas 特效管线直接兼容。
import { COLS, NV, ROWS, gridIndices } from './puppet';
import type { PuppetMesh } from './puppet';

const VS = `attribute vec2 a_pos;attribute vec2 a_uv;uniform vec4 u_reg;varying vec2 v_uv;
void main(){v_uv=a_uv;vec2 p=(a_pos-u_reg.xy)/u_reg.zw;gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0);}`;
const FS = `precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;
void main(){gl_FragColor=texture2D(u_tex,v_uv);}`;

export class MeshGL {
  private static inst: MeshGL | null | undefined;
  /** WebGL 不可用时返回 null，调用方退回到单骨骼绘制 */
  static get(): MeshGL | null {
    if (MeshGL.inst === undefined) {
      try { MeshGL.inst = new MeshGL(); } catch { MeshGL.inst = null; }
    }
    return MeshGL.inst;
  }
  static get ok() { return MeshGL.get() !== null; }

  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private gl2: boolean;
  private prog: WebGLProgram;
  private posBuf: WebGLBuffer;
  private uvBuf: WebGLBuffer;
  private idxBuf: WebGLBuffer;
  private uReg: WebGLUniformLocation;
  private textures = new WeakMap<object, WebGLTexture>();
  private uvSet = false;

  private constructor() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false } as WebGLContextAttributes;
    const g2 = c.getContext('webgl2', opt) as WebGL2RenderingContext | null;
    const gl = (g2 ?? c.getContext('webgl', opt)) as WebGLRenderingContext | null;
    if (!gl) throw new Error('no webgl');
    this.gl = gl; this.gl2 = !!g2; this.canvas = c;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'a_pos'); gl.bindAttribLocation(p, 1, 'a_uv');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link failed');
    this.prog = p;
    this.uReg = gl.getUniformLocation(p, 'u_reg')!;
    this.posBuf = gl.createBuffer()!; this.uvBuf = gl.createBuffer()!; this.idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, gridIndices(), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
  }

  private tex(src: HTMLCanvasElement): WebGLTexture {
    let t = this.textures.get(src);
    if (t) return t;
    const gl = this.gl;
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (this.gl2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    this.textures.set(src, t);
    return t;
  }

  /**
   * 把木偶画进 GL 画布左下角 pw×ph 像素的区域。
   * reg = 图内像素坐标里被画出来的矩形 [x, y, w, h]（要比图本身大一圈，留出手臂甩出去的空间）。
   * 返回可直接 drawImage 的源矩形 [sx, sy, sw, sh]。
   */
  render(mesh: PuppetMesh, tex: HTMLCanvasElement, pos: Float32Array, reg: [number, number, number, number], pw: number, ph: number): [number, number, number, number] {
    const gl = this.gl, c = this.canvas;
    if (c.width < pw || c.height < ph) { c.width = Math.max(c.width, pw); c.height = Math.max(c.height, ph); }
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindTexture(gl.TEXTURE_2D, this.tex(tex));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    if (!this.uvSet) { gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW); this.uvSet = true; }
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.uniform4f(this.uReg, reg[0], reg[1], reg[2], reg[3]);
    gl.drawElements(gl.TRIANGLES, COLS * ROWS * 6, gl.UNSIGNED_SHORT, 0);
    void NV;
    return [0, c.height - ph, pw, ph];
  }
}
