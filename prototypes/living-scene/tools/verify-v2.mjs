import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordBrowser } from "./record-browser.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
);
const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/living-scene/v2/evidence",
);
const b = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: false,
  args: ["--use-angle=metal"],
});
let p = await b.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
const wire = (page) => {
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
};
wire(p);
const performance = [];
for (const [name, port, dpr] of [
  ["v1-A", 8768, 1],
  ["v2-B", 8770, 1],
  ["v2-B-repeat", 8770, 1],
  ["v1-A-repeat", 8768, 1],
  ["v2-retina", 8770, 2],
]) {
  if (dpr === 2) {
    await p.close();
    p = await b.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    wire(p);
  }
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.bringToFront();
  await p.waitForFunction(() => window.__livingScene?.ready);
  await p.mouse.move(700, 400);
  await p.waitForTimeout(5000);
  const begin = await p.evaluate(
    () => window.__livingScene.snapshot().frames.length,
  );
  const size = p.viewportSize();
  for (let i = 0; i < 60; i++) {
    await p.mouse.move(
      size.width * (0.5 + 0.4 * Math.sin(i * 0.2)),
      size.height * (0.5 + 0.32 * Math.cos(i * 0.17)),
    );
    if (i === 20) await p.locator("#hotspot").click();
    if (i === 36) await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
  }
  const s = await p.evaluate(() => window.__livingScene.snapshot()),
    values = s.frames.slice(begin),
    sort = [...values].sort((a, b) => a - b),
    q = (n) => sort[Math.floor((sort.length - 1) * n)];
  const row = {
    name,
    durationMs: values.reduce((a, b) => a + b, 0),
    samples: values.length,
    avgFps: (1000 * values.length) / values.reduce((a, b) => a + b, 0),
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    slow: values.filter((v) => v > 33.34).length,
    drawCalls: s.drawCalls,
    renderSize: s.renderSize,
    dpr: s.dpr,
    rawFrames: values,
  };
  performance.push(row);
  console.log(JSON.stringify({ ...row, rawFrames: undefined }));
}
await p.close();
p = await b.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
wire(p);
await p.goto("http://127.0.0.1:8770/");
await p.waitForFunction(() => window.__livingScene?.ready);
await p.waitForTimeout(7000);
await p.mouse.move(950, 550);
await p.screenshot({ path: path.join(out, "hero-clean.png") });
const tests = {};
tests.chromeFades = await p.evaluate(
  () =>
    getComputedStyle(document.querySelector("header")).opacity === "0" &&
    getComputedStyle(document.querySelector(".chapter")).opacity === "0",
);
await p.keyboard.press("Tab");
await p.waitForTimeout(500);
tests.keyboardReveal = await p.evaluate(() =>
  document.body.classList.contains("show-chrome"),
);
await p.mouse.move(900, 1070);
await p.waitForTimeout(400);
tests.edgeReveal = await p.evaluate(() =>
  document.body.classList.contains("show-chrome"),
);
await p.screenshot({ path: path.join(out, "controls-revealed.png") });
await p.locator("#hotspot").hover();
await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(out, "hover.png") });
await p.locator("#hotspot").click();
await p.waitForTimeout(3000);
tests.focus = await p.evaluate(
  () =>
    window.__livingScene.snapshot().focused &&
    document.querySelector("#subtitle").getAttribute("aria-hidden") === "false",
);
tests.noScroll = await p.evaluate(
  () =>
    document.querySelector("#app").scrollLeft === 0 &&
    document.querySelector("#app").scrollTop === 0,
);
await p.screenshot({ path: path.join(out, "subtitle.png") });
await p.keyboard.press("Escape");
tests.escape = await p.evaluate(() => !window.__livingScene.snapshot().focused);
await p.mouse.move(1800, 1060);
await p.locator("#pause").click();
const t = await p.evaluate(() => window.__livingScene.snapshot().time);
await p.waitForTimeout(650);
tests.pause = await p.evaluate(
  (t) => window.__livingScene.snapshot().time === t,
  t,
);
await p.locator("#pause").click();
await p.locator("#fullscreen").click();
await p.waitForTimeout(700);
tests.fullscreen = await p.evaluate(() => !!document.fullscreenElement);
await p.evaluate(() => document.exitFullscreen());
await p.emulateMedia({ reducedMotion: "reduce" });
await p.waitForFunction(() => window.__livingScene.snapshot().paused);
const rt = await p.evaluate(() => window.__livingScene.snapshot().time);
await p.waitForTimeout(700);
tests.reducedMotion = await p.evaluate(
  (t) => window.__livingScene.snapshot().time === t,
  rt,
);
await p.setViewportSize({ width: 390, height: 844 });
tests.mobileNoOverflow = await p.evaluate(
  () => document.documentElement.scrollWidth === innerWidth,
);
await p.screenshot({ path: path.join(out, "mobile.png") });
const hardware = await p.evaluate(() => window.__livingScene.hardware);
const capture = await recordBrowser(
  p,
  "/Users/xiaruonan/nihongo-art-work/toolchain/living-scene-v2-capture",
);
const fallback = await b.newPage({ viewport: { width: 1280, height: 800 } });
await fallback.addInitScript(() => {
  const fn = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...args) {
    return t.startsWith("webgl") ? null : fn.call(this, t, ...args);
  };
});
await fallback.goto("http://127.0.0.1:8770/");
await fallback.waitForTimeout(1700);
tests.fallback = await fallback.evaluate(
  () =>
    document.querySelector(".still").naturalWidth === 1672 &&
    document.querySelector("#notice").textContent.includes("静态"),
);
await fallback.screenshot({ path: path.join(out, "fallback.png") });
await fallback.close();
const report = {
  date: new Date().toISOString(),
  browser: b.version(),
  hardware,
  performance,
  tests,
  errors,
  capture,
};
await fs.writeFile(
  path.join(out, "verification.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    { ...report, performance: performance.map(({ rawFrames, ...r }) => r) },
    null,
    2,
  ),
);
await b.close();
if (errors.length || Object.values(tests).some((x) => !x)) process.exitCode = 1;
