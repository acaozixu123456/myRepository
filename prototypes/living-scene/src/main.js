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
import "./chapter.css";
import { createChapter } from "./chapter.js";
import { createCat } from "./cat.js";
import { createLivingSceneAudio } from "./audio.js";
import { encounters } from "./encounters.js";
import fragmentShader from "./scene.frag.glsl?raw";
const params = new URLSearchParams(location.search);
const qa = params.get("qa") === "1";
const pipeline =
  qa && ["half", "byte", "small", "local"].includes(params.get("pipeline"))
    ? params.get("pipeline")
    : "local";
const instanced = !qa || params.get("leaves") !== "mesh";
const $ = (s) => document.querySelector(s),
  canvas = $("#scene"),
  reduced = matchMedia("(prefers-reduced-motion: reduce)");
let contextLost = false;
let chapterRoom = 'street';
let paused = reduced.matches || (qa && params.get("still") === "1"),
  focused = false,
  time = 0,
  last = 0,
  push = 0,
  hover = 0,
  hovered = false;
const cpuMs = [],
  gpuMs = [],
  gpuPending = [];
let gpuExt,
  glContext,
  frameId = 0;
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
  leafBatch,
  dummy = new T.Object3D(),
  width = innerWidth,
  height = innerHeight,
  aspect = width / height;
function pauseLabel() {
  $("#pause").setAttribute("aria-label", paused ? "恢复动态" : "暂停动态");
  $("#pause").title = paused ? "恢复动态" : "暂停动态";
  $("#pause").textContent = paused ? "▷" : "Ⅱ";
}
const focusOffset = new T.Vector2();
const targetOffset = new T.Vector2();
const hoverPoint = new T.Vector2(.735, .445);
let hoverKind = 0;
const sound = createLivingSceneAudio(updateSoundButton);
function updateSoundButton(state = sound.snapshot()) {
  const button = $("#sound");
  button.disabled = !state.supported;
  button.setAttribute("aria-pressed", String(state.enabled));
  button.setAttribute("aria-label", state.enabled ? "关闭声音" : "开启声音");
  button.title = state.enabled ? "关闭声音" : "开启声音";
  button.textContent = state.enabled ? "♫" : "♪";
}
function focusScene(place) {
  focused = !!place;
  document.body.classList.toggle("focused", focused);
  targetOffset.set(place ? (place.uv[0] - .5) * .081 : 0,
                   place ? (place.uv[1] - .5) * .073 : 0);
  sound.setFocus(focused, place?.id);
}
const story = encounters({
  onFocus(place) { focusScene(place); },
  onHover(place) {
    hovered = !!place;
    sound.setHover(hovered, place?.id);
    if (place) {
      hoverPoint.set(...place.uv);
      hoverKind = {shop: 0, reflection: 1, lantern: 2, maple: 3, alley: 4}[place.id];
    }
  },
});
const cat = createCat({ sound, focusScene, closeStory: () => story.close() });
const chapter = createChapter({ onChange(room) {
  story.close(); cat.close();
  chapterRoom = room;
  document.querySelector('#hotspots').inert = room !== 'street';
  sound.setRoom(room);
  last = 0;
} });
for (const [room, text] of [['shop', '推门进便当店'], ['sento', '沿巷去钱汤']]) {
  const entry = document.createElement('button');
  entry.textContent = text; entry.id = `enter-${room}`;
  entry.onclick = () => chapter.go(room);
  document.querySelector('#places-nav').append(entry);
}
const enter = document.createElement('button');
enter.id = 'story-enter'; enter.hidden = true;
enter.onclick = () => chapter.go(story.snapshot().active === 'shop' ? 'shop' : 'sento');
document.querySelector('#subtitle .story-actions').prepend(enter);
new MutationObserver(() => {
  const place = story.snapshot().active;
  enter.hidden = !['shop', 'alley'].includes(place);
  enter.textContent = place === 'shop' ? '推门进店 →' : '沿巷去钱汤 →';
}).observe(document.querySelector('#story-line'), { childList: true });
window.__chapter = { snapshot: chapter.snapshot };
updateSoundButton();
$("#sound").onclick = async () => {
  $("#sound").disabled = true;
  await sound.toggle();
  updateSoundButton();
  if (!sound.snapshot().started) $("#notice").textContent="声音暂时未能开启，街景仍可继续欣赏。";
};
addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / width) * 2 - 1, 1 - (e.clientY / height) * 2);
  sound.setPointer(mouse.x);
});
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
document.addEventListener("visibilitychange", () => { last = 0; sound.setHidden(document.hidden); });
function align() {
  const z = 1.035 + push * 0.045;
  for (const { place, button } of story.buttons) {
    const x = (.5 + ((place.uv[0] - .5 - focusOffset.x - pointer.x*.006*(place.depth-.2)) / cover.x)*z)*width;
    const y = (.5 - ((place.uv[1] - .5 - focusOffset.y - pointer.y*.003*(place.depth-.2)) / cover.y)*z)*height;
    button.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%)`;
    // Keep hotspots on their objects; cropped objects remain accessible through the walk menu.
    button.hidden = x < 25 || x > width-25 || y < 35 || y > height-70;
  }
}
function resize() {
  width = innerWidth;
  height = innerHeight;
  aspect = width / height;
  const ia = 3039 / 1710;
  cover.set(aspect > ia ? 1 : aspect / ia, aspect > ia ? ia / aspect : 1);
  if (renderer && composer) {
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, 1.5, Math.sqrt(2073600 / (width * height))),
    );
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
  const [hero, back, depth, semanticA, semanticB, glow] = await Promise.all(
    [
      "hero.webp",
      "foliage-back.webp",
      "depth.png",
      "semantic-a.png",
      "semantic-b.png",
      "local-glow.webp",
    ].map((p) => loader.loadAsync("/scene/" + p)),
  );
  hero.colorSpace = back.colorSpace = glow.colorSpace = T.SRGBColorSpace;
  u = {
    uHero: { value: hero },
    uBack: { value: back },
    uDepth: { value: depth },
    uSemanticA: { value: semanticA },
    uSemanticB: { value: semanticB },
    uGlow: { value: glow },
    uCover: { value: cover },
    uPointer: { value: pointer },
    uTime: { value: 0 },
    uPush: { value: 0 },
    uHover: { value: 0 },
    uFocusOffset: { value: focusOffset },
    uHoverPoint: { value: hoverPoint },
    uHoverKind: { value: 0 },
    uLocalGlow: { value: pipeline === "local" ? 1 : 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms: u,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader,
  });
  const plane = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  plane.frustumCulled = false;
  plane.renderOrder = -10;
  scene.add(plane);
  composer = new EffectComposer(renderer, {
    frameBufferType: pipeline === "half" ? T.HalfFloatType : T.UnsignedByteType,
    multisampling: 0,
  });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [new VignetteEffect({ offset: 0.25, darkness: 0.18 })];
  if (pipeline !== "local")
    effects.unshift(
      new BloomEffect({
        intensity: 0.12,
        luminanceThreshold: 0.72,
        luminanceSmoothing: 0.25,
        mipmapBlur: true,
        levels: pipeline === "small" ? 4 : 8,
      }),
    );
  composer.addPass(new EffectPass(camera, ...effects));
  particles();
  await cat.load(scene);
  resize();
  const gl = renderer.getContext(),
    ext = gl.getExtension("WEBGL_debug_renderer_info");
  glContext = gl;
  gpuExt = qa ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
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
      pipeline,
      instanced,
      sourceSize: [3039, 1710],
      cpuMs: [...cpuMs],
      gpuMs: [...gpuMs],
      gpuTiming: !!gpuExt,
      width,
      height,
      dpr: renderer.getPixelRatio(),
      renderSize: renderer.getDrawingBufferSize(new T.Vector2()).toArray(),
      paused,
      focused,
      story: story.snapshot(),
      chapter: chapter.snapshot(),
      cat: cat.snapshot(),
      audio: sound.snapshot(),
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
  if (qa) window.__livingAudioCapture = () => { const dest = sound.ctx.createMediaStreamDestination(); sound.output.connect(dest); return dest.stream; };
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
  const mat = new T.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.64,
    side: T.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  if (instanced) {
    leafBatch = new T.InstancedMesh(geo, mat, 18);
    leafBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    leafBatch.frustumCulled = false;
    leafBatch.renderOrder = 3;
    scene.add(leafBatch);
  }
  for (let i = 0; i < 18; i++) {
    let mesh;
    if (instanced) {
      leafBatch.setColorAt(i, new T.Color(i % 3 ? 0x75402d : 0x9b5634));
    } else {
      mesh = new T.Mesh(geo, mat.clone());
      mesh.material.color.setHex(i % 3 ? 0x75402d : 0x9b5634);
      mesh.renderOrder = 3;
      scene.add(mesh);
    }
    leaves.push({
      mesh,
      index: i,
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
  if (!document.hidden && chapterRoom !== 'street') chapter.update(dt, paused, reduced.matches);
  if (!document.hidden && !contextLost && chapterRoom === 'street') {
    const cpuStart = performance.now();
    if (!paused) {
      time += dt;
      pointer.lerp(mouse, 1 - Math.exp(-dt * 2.4));
      batch.update(dt);
    }
    push = T.MathUtils.damp(push, focused ? 1 : 0, 2, dt);
    focusOffset.lerp(targetOffset, 1 - Math.exp(-dt * 2));
    hover = T.MathUtils.damp(hover, hovered ? 1 : 0, 4, dt);
    if (reduced.matches) {
      push = focused ? 1 : 0;
      pointer.set(0, 0);
      focusOffset.copy(targetOffset);
    }
    u.uTime.value = time;
    u.uPush.value = push;
    u.uHover.value = hover;
    u.uHoverKind.value = hoverKind;
    for (const { mesh: single, index, seed, speed, size } of leaves) {
      const mesh = instanced ? dummy : single;
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
      if (instanced) {
        mesh.updateMatrix();
        leafBatch.setMatrixAt(index, mesh.matrix);
      }
    }
    if (instanced) leafBatch.instanceMatrix.needsUpdate = true;
    align();
    cat.update(dt, time, { cover, pointer, focusOffset, push, width, height, aspect, paused, reduced: reduced.matches, storyFocused: !!story.snapshot().active });
    renderer.info.reset();
    let query;
    if (gpuExt && frameId++ % 30 === 0 && gpuPending.length < 4) {
      query = glContext.createQuery();
      glContext.beginQuery(gpuExt.TIME_ELAPSED_EXT, query);
    }
    composer.render(dt);
    if (query) {
      glContext.endQuery(gpuExt.TIME_ELAPSED_EXT);
      gpuPending.push(query);
    }
    if (
      gpuPending.length &&
      glContext.getQueryParameter(
        gpuPending[0],
        glContext.QUERY_RESULT_AVAILABLE,
      )
    ) {
      const q = gpuPending.shift();
      if (!glContext.getParameter(gpuExt.GPU_DISJOINT_EXT))
        gpuMs.push(
          glContext.getQueryParameter(q, glContext.QUERY_RESULT) / 1e6,
        );
      glContext.deleteQuery(q);
    }
    if (qa) {
      cpuMs.push(performance.now() - cpuStart);
      if (cpuMs.length > 18000) cpuMs.shift();
    }
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

let chromeTimer;
function revealChrome(duration = 2600) {
  document.body.classList.add("show-chrome");
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(
    () => document.body.classList.remove("show-chrome"),
    duration,
  );
}
revealChrome(4500);
addEventListener("pointermove", (e) => {
  if (e.clientY < 90 || e.clientY > innerHeight - 90) revealChrome();
});
addEventListener("keydown", (e) => {
  if (e.key === "Tab") revealChrome(6000);
});
