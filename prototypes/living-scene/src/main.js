import * as T from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
} from "postprocessing";
import {
  BatchedRenderer,
  ParticleSystem,
  ConstantValue,
  IntervalValue,
  ConstantColor,
  SphereEmitter,
  RenderMode,
} from "three.quarks";
import "./style.css";
const $ = (s) => document.querySelector(s),
  canvas = $("#scene"),
  hotspot = $("#hotspot"),
  reduced = matchMedia("(prefers-reduced-motion: reduce)");
let contextLost = false;
let paused = reduced.matches,
  focused = false,
  time = 0,
  last = 0,
  push = 0,
  hover = 0,
  hovered = false;
const pointer = new T.Vector2(),
  mouse = new T.Vector2(),
  cover = new T.Vector2(),
  frames = [],
  errors = [],
  leaves = [];
let renderer,
  composer,
  scene,
  camera,
  u,
  batch,
  dust,
  width = innerWidth,
  height = innerHeight,
  aspect = width / height;
function pauseLabel() {
  $("#pause").setAttribute("aria-label", paused ? "恢复动态" : "暂停动态");
  $("#pause").title = paused ? "恢复动态" : "暂停动态";
  $("#pause").textContent = paused ? "▷" : "Ⅱ";
}
function focus(next) {
  focused = next;
  document.body.classList.toggle("focused", next);
  $("#subtitle").setAttribute("aria-hidden", String(!next));
  hotspot.tabIndex = next ? -1 : 0;
  $("#back").tabIndex = next ? 0 : -1;
  (next ? $("#back") : hotspot).focus({ preventScroll: true });
}
$("#back").tabIndex = -1;
hotspot.onpointerenter = () => (hovered = true);
hotspot.onpointerleave = () => (hovered = false);
hotspot.onfocus = () => (hovered = true);
hotspot.onblur = () => (hovered = false);
hotspot.onclick = () => focus(true);
$("#back").onclick = () => focus(false);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && focused) focus(false);
});
addEventListener("pointermove", (e) =>
  mouse.set((e.clientX / width) * 2 - 1, 1 - (e.clientY / height) * 2),
);
document.documentElement.onpointerleave = () => mouse.set(0, 0);
$("#pause").onclick = () => {
  paused = !paused;
  pauseLabel();
};
reduced.addEventListener("change", () => {
  paused = reduced.matches;
  pauseLabel();
});
pauseLabel();
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#app").requestFullscreen();
  } catch {
    $("#notice").textContent = "当前浏览器暂不支持全屏。";
  }
};
document.addEventListener("visibilitychange", () => (last = 0));
function align() {
  const z = 1.035 + push * 0.045;
  const x =
    (0.5 +
      ((0.735 - 0.5 - push * 0.019) / cover.x) * z -
      (pointer.x * 0.003) / cover.x) *
    width;
  const y =
    (0.5 -
      ((0.445 - 0.5 + push * 0.004) / cover.y) * z +
      (pointer.y * 0.0015) / cover.y) *
    height;
  hotspot.style.left = `${Math.min(width - 90, Math.max(85, x))}px`;
  hotspot.style.top = `${Math.min(height - 200, Math.max(140, y))}px`;
}
function resize() {
  width = innerWidth;
  height = innerHeight;
  aspect = width / height;
  const ia = 1672 / 941;
  cover.set(aspect > ia ? 1 : aspect / ia, aspect > ia ? ia / aspect : 1);
  if (renderer && composer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(2073600 / (width * height))));
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.left = -aspect;
    camera.right = aspect;
    camera.updateProjectionMatrix();
  }
  align();
}
addEventListener("resize", resize);
resize();
async function init() {
  renderer = new T.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.info.autoReset = false;
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const loader = new T.TextureLoader();
  const [hero, depth, masks] = await Promise.all(
    ["hero.webp", "depth.png", "motion-masks.png"].map((p) =>
      loader.loadAsync("/scene/" + p),
    ),
  );
  hero.colorSpace = T.SRGBColorSpace;
  u = {
    uHero: { value: hero },
    uDepth: { value: depth },
    uMasks: { value: masks },
    uCover: { value: cover },
    uPointer: { value: pointer },
    uTime: { value: 0 },
    uPush: { value: 0 },
    uHover: { value: 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms: u,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `precision highp float;varying vec2 vUv;uniform sampler2D uHero,uDepth,uMasks;uniform vec2 uCover,uPointer;uniform float uTime,uPush,uHover;
void main(){vec2 uv=(vUv-.5)*uCover/(1.035+uPush*.045)+.5+vec2(uPush*.019,-uPush*.004);float d=texture2D(uDepth,uv).r;vec2 p=uv+uPointer*vec2(.006,.003)*(d-.20);d=texture2D(uDepth,p).r;p=uv+uPointer*vec2(.006,.003)*(d-.20);vec3 m=texture2D(uMasks,p).rgb;p.x+=sin(uTime*.8+p.y*23.)*.00055*m.r;p.y+=sin(uTime*.63+p.x*17.)*.00025*m.r;vec3 col=texture2D(uHero,clamp(p,vec2(.002),vec2(.998))).rgb;float breath=.65+.35*sin(uTime*.19+uv.x*7.);col=mix(col,vec3(.26,.36,.43),m.g*.018*breath);col*=1.+m.b*(.012*sin(uTime*.7)+.075*uHover);float ray=exp(-pow((p.x-.78+(p.y-.48)*.26)/.052,2.))*(1.-smoothstep(.46,.78,p.y))*smoothstep(.36,.65,p.y);col+=vec3(.16,.095,.035)*ray*.028*breath;gl_FragColor=vec4(col,1.);}`,
  });
  const plane = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  plane.renderOrder = -10;
  scene.add(plane);
  composer = new EffectComposer(renderer, {
    frameBufferType: T.HalfFloatType,
    multisampling: 0,
  });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new EffectPass(
      camera,
      new BloomEffect({
        intensity: 0.12,
        luminanceThreshold: 0.72,
        luminanceSmoothing: 0.25,
        mipmapBlur: true,
        resolutionScale: 0.5,
      }),
      new VignetteEffect({ offset: 0.25, darkness: 0.18 }),
    ),
  );
  particles();
  resize();
  const gl = renderer.getContext(),
    ext = gl.getExtension("WEBGL_debug_renderer_info");
  window.__livingScene = {
    ready: true,
    errors,
    hardware: {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "unavailable",
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
    },
    versions: { three: T.REVISION, postprocessing: "6.38.3", quarks: "0.17.1" },
    snapshot: () => ({
      frames: [...frames],
      width,
      height,
      dpr: renderer.getPixelRatio(),
      renderSize: renderer.getDrawingBufferSize(new T.Vector2()).toArray(),
      paused,
      focused,
      time,
      push,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      particleCount: dust.particleNum,
      leafCount: leaves.length,
      textureCount: renderer.info.memory.textures,
      errors: [...errors],
    }),
  };
  document.body.classList.add("ready");
  requestAnimationFrame(tick);
}
function particles() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d"),
    g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,245,214,.9)");
  g.addColorStop(0.2, "rgba(255,238,200,.5)");
  g.addColorStop(1, "rgba(255,230,190,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  batch = new BatchedRenderer();
  scene.add(batch);
  dust = new ParticleSystem({
    duration: 30,
    looping: true,
    prewarm: true,
    worldSpace: true,
    shape: new SphereEmitter({ radius: 0.45, thickness: 1 }),
    startLife: new IntervalValue(12, 22),
    startSpeed: new IntervalValue(0.004, 0.012),
    startSize: new IntervalValue(0.003, 0.009),
    startColor: new ConstantColor(new T.Vector4(1, 0.83, 0.59, 0.28)),
    emissionOverTime: new ConstantValue(3),
    renderMode: RenderMode.BillBoard,
    material: new T.MeshBasicMaterial({
      map: new T.CanvasTexture(c),
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
    renderOrder: 2,
  });
  dust.emitter.position.set(0.65, -0.04, 0.2);
  scene.add(dust.emitter);
  batch.addSystem(dust);
  // Original tiny maple silhouettes, with restrained density and no simulation backend.
  const shape = new T.Shape();
  [
    [0, 0.9],
    [0.15, 0.36],
    [0.55, 0.6],
    [0.38, 0.15],
    [0.8, 0.12],
    [0.35, -0.13],
    [0.48, -0.53],
    [0.1, -0.33],
    [0, -0.82],
    [-0.1, -0.33],
    [-0.48, -0.53],
    [-0.35, -0.13],
    [-0.8, 0.12],
    [-0.38, 0.15],
    [-0.55, 0.6],
    [-0.15, 0.36],
  ].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new T.ShapeGeometry(shape);
  for (let i = 0; i < 18; i++) {
    const mesh = new T.Mesh(
      geo,
      new T.MeshBasicMaterial({
        color: i % 3 ? 0x75402d : 0x9b5634,
        transparent: true,
        opacity: 0.64,
        side: T.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.renderOrder = 3;
    scene.add(mesh);
    leaves.push({
      mesh,
      seed: i * 2.399,
      speed: 0.013 + (i % 5) * 0.002,
      size: 0.0035 + (i % 4) * 0.0014,
    });
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  if (last && !document.hidden) {
    frames.push(now - last);
    if (frames.length > 18000) frames.shift();
  }
  last = now;
  if (!document.hidden && !contextLost) {
    if (!paused) {
      time += dt;
      pointer.lerp(mouse, 1 - Math.exp(-dt * 2.4));
      batch.update(dt);
    }
    push = T.MathUtils.damp(push, focused ? 1 : 0, 2, dt);
    hover = T.MathUtils.damp(hover, hovered ? 1 : 0, 4, dt);
    if (reduced.matches) {
      push = focused ? 1 : 0;
      pointer.set(0, 0);
    }
    u.uTime.value = time;
    u.uPush.value = push;
    u.uHover.value = hover;
    for (const { mesh, seed, speed, size } of leaves) {
      mesh.position.set(
        ((seed * 0.371 + time * speed * 0.22) % 1) * 2 * aspect -
          aspect +
          Math.sin(time * 0.5 + seed) * 0.035,
        1.12 - ((seed * 0.219 + time * speed) % 1) * 2.3,
        0.3,
      );
      mesh.rotation.set(
        Math.sin(time * 0.5 + seed) * 0.8,
        Math.sin(time * 0.7 + seed) * 1.2,
        time * 0.23 + seed,
      );
      mesh.scale.setScalar(size);
    }
    align();
    renderer.info.reset();
    composer.render(dt);
  }
  requestAnimationFrame(tick);
}
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  contextLost = true;
  document.body.classList.remove("ready");
  $("#notice").textContent = "动态画面暂时休息，仍可欣赏静态街景。";
});
init().catch((e) => {
  errors.push(String(e));
  console.error(e);
  window.__livingScene = { ready: false, errors };
  $("#notice").textContent = "当前环境显示静态街景；动态效果未能加载。";
  resize();
});
