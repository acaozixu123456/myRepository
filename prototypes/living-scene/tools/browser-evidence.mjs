import { recordBrowser } from "./record-browser.mjs";
/** Actual headed Chrome/Metal QA. Set PLAYWRIGHT_MODULE and CHROME_PATH on another workstation. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const evidence = path.join(root, "docs/living-scene/evidence");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
);
const url = process.env.SCENE_URL || "http://127.0.0.1:8768/";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: false,
  args: ["--use-angle=metal"],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const failures = [],
  network = [];
page.on("pageerror", (e) => failures.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") failures.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) network.push({ url: r.url(), status: r.status() });
});
await page.goto(url);
await page.waitForFunction(() => window.__livingScene?.ready);
await page.waitForTimeout(5000);
const hardware = await page.evaluate(() => window.__livingScene.hardware);
if (/SwiftShader|llvmpipe/i.test(hardware.renderer))
  throw Error("Hardware GPU required");
const tests = {};
await page.mouse.move(960, 540);
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(evidence, "hero-desktop.png") });
await page.mouse.move(20, 20);
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(evidence, "parallax-left.png") });
await page.mouse.move(1895, 1050);
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(evidence, "parallax-right.png") });
await page.locator("#hotspot").hover();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(evidence, "hover.png") });
await page.locator("#hotspot").click();
await page.waitForTimeout(3000);
tests.noScrollOnFocus = await page.evaluate(
  () =>
    document.querySelector("#app").scrollLeft === 0 &&
    document.querySelector("#app").scrollTop === 0,
);
tests.focus = await page.evaluate(
  () =>
    window.__livingScene.snapshot().focused &&
    document.querySelector("#subtitle").getAttribute("aria-hidden") === "false",
);
await page.screenshot({ path: path.join(evidence, "subtitle.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(1800);
tests.escape = await page.evaluate(
  () => !window.__livingScene.snapshot().focused,
);
await page.locator("#pause").click();
const t = await page.evaluate(() => window.__livingScene.snapshot().time);
await page.waitForTimeout(800);
tests.pause = await page.evaluate(
  (t) => window.__livingScene.snapshot().time === t,
  t,
);
await page.locator("#pause").click();
await page.locator("#fullscreen").click();
await page.waitForTimeout(600);
tests.fullscreen = await page.evaluate(() => !!document.fullscreenElement);
await page.evaluate(async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
});
await page.setViewportSize({ width: 1920, height: 1080 });
await page.waitForTimeout(1000);
const perf = [];
for (const [w, h, dpr] of [
  [1920, 1080, 1],
  [1440, 900, 2],
]) {
  let p = page;
  if (dpr === 2) {
    p = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: dpr,
    });
    await p.goto(url);
    await p.waitForFunction(() => window.__livingScene?.ready);
    await p.waitForTimeout(4000);
  }
  const start = await p.evaluate(
    () => window.__livingScene.snapshot().frames.length,
  );
  for (let i = 0; i < 60; i++) {
    await p.mouse.move(
      w * (0.5 + 0.42 * Math.sin(i * 0.2)),
      h * (0.5 + 0.34 * Math.cos(i * 0.17)),
    );
    if (i === 20) await p.locator("#hotspot").click();
    if (i === 36) await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
  }
  const s = await p.evaluate(() => window.__livingScene.snapshot());
  const values = s.frames.slice(start),
    sorted = [...values].sort((a, b) => a - b);
  const percentile = (q) => sorted[Math.floor((sorted.length - 1) * q)];
  perf.push({
    ...s,
    frames: undefined,
    requestedDpr: dpr,
    samples: values.length,
    durationMs: values.reduce((a, b) => a + b, 0),
    averageFps: (1000 * values.length) / values.reduce((a, b) => a + b, 0),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    over33ms: values.filter((v) => v > 33.34).length,
    rawFramesMs: values,
  });
  if (p !== page) await p.close();
}
await page.bringToFront();
await page.emulateMedia({ reducedMotion: "reduce" });
await page.waitForFunction(() => window.__livingScene.snapshot().paused);
await page.waitForTimeout(200);
const reducedStart = await page.evaluate(
  () => window.__livingScene.snapshot().time,
);
await page.waitForTimeout(500);
tests.reducedMotion = await page.evaluate(
  (t) =>
    window.__livingScene.snapshot().paused &&
    window.__livingScene.snapshot().time === t,
  reducedStart,
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(evidence, "mobile-layout.png") });
tests.mobileNoOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth === innerWidth,
);
await page.emulateMedia({ reducedMotion: "no-preference" });
await page.setViewportSize({ width: 1600, height: 900 });
await page.waitForTimeout(1600);
const captureInfo = await recordBrowser(
  page,
  process.env.CAPTURE_DIR ||
    "/Users/xiaruonan/nihongo-art-work/toolchain/living-scene-capture",
);
const fallback = await browser.newPage({
  viewport: { width: 1280, height: 800 },
});
await fallback.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type.startsWith("webgl")) return null;
    return original.call(this, type, ...args);
  };
});
await fallback.goto(url);
await fallback.waitForTimeout(1600);
tests.staticFallback = await fallback.evaluate(
  () =>
    document.querySelector(".still").naturalWidth > 0 &&
    !document.body.classList.contains("ready") &&
    document.querySelector("#notice").textContent.includes("静态"),
);
await fallback.screenshot({ path: path.join(evidence, "static-fallback.png") });
await fallback.close();
const report = {
  date: new Date().toISOString(),
  url,
  browser: browser.version(),
  hardware,
  tests,
  errors: failures,
  networkErrors: network,
  performance: perf,
  capture: captureInfo,
};
await fs.writeFile(
  path.join(evidence, "browser-report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    { ...report, performance: perf.map(({ rawFramesMs, ...s }) => s) },
    null,
    2,
  ),
);
await browser.close();
if (Object.values(tests).some((v) => !v) || failures.length || network.length)
  process.exitCode = 1;
