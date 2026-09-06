import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const p = await b.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const results = [];
let hardware;
const cases = [
  ["half", "mesh"],
  ["byte", "mesh"],
  ["byte", "instanced"],
  ["small", "instanced"],
  ["local", "instanced"],
];
for (const [pipeline, leaves] of cases) {
  await p.goto(
    `http://127.0.0.1:8770/?qa=1&pipeline=${pipeline}&leaves=${leaves}&still=1`,
  );
  await p.waitForFunction(() => window.__livingScene?.ready);
  await p.mouse.move(960, 540);
  await p.waitForTimeout(6500);
  await p.screenshot({ path: path.join(out, `ab-${pipeline}-${leaves}.png`) });
  await p.mouse.move(1700, 1060);
  await p.locator("#pause").click();
  await p.mouse.move(960, 540);
  await p.waitForTimeout(4000);
  hardware = await p.evaluate(() => window.__livingScene.hardware);
  const start = await p.evaluate(() => {
    const s = window.__livingScene.snapshot();
    return { frame: s.frames.length, cpu: s.cpuMs.length, gpu: s.gpuMs.length };
  });
  for (let i = 0; i < 30; i++) {
    await p.mouse.move(
      960 + 700 * Math.sin(i * 0.21),
      540 + 300 * Math.cos(i * 0.19),
    );
    await p.waitForTimeout(500);
  }
  const s = await p.evaluate(() => window.__livingScene.snapshot());
  const values = s.frames.slice(start.frame),
    sort = [...values].sort((a, b) => a - b),
    quantile = (a, q) =>
      [...a].sort((a, b) => a - b)[Math.floor((a.length - 1) * q)];
  const row = {
    pipeline,
    leaves,
    avgFps: (1000 * values.length) / values.reduce((a, b) => a + b, 0),
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    slow: values.filter((x) => x > 33.34).length,
    frames: values.length,
    drawCalls: s.drawCalls,
    renderSize: s.renderSize,
    cpuP50: quantile(s.cpuMs.slice(start.cpu), 0.5),
    cpuP95: quantile(s.cpuMs.slice(start.cpu), 0.95),
    gpuP50: quantile(s.gpuMs.slice(start.gpu), 0.5),
    gpuP95: quantile(s.gpuMs.slice(start.gpu), 0.95),
    rawFrames: values,
    rawCpu: s.cpuMs.slice(start.cpu),
    rawGpu: s.gpuMs.slice(start.gpu),
  };
  results.push(row);
  console.log(
    JSON.stringify({
      ...row,
      rawFrames: undefined,
      rawCpu: undefined,
      rawGpu: undefined,
    }),
  );
}
await fs.writeFile(
  path.join(out, "ab-performance.json"),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      browser: b.version(),
      hardware,
      errors,
      results,
    },
    null,
    2,
  ),
);
await b.close();
if (errors.length) process.exitCode = 1;
