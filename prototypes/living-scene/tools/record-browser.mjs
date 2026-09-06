/** Actual viewport recording, including DOM UI. Source frames remain outside the repository. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function recordBrowser(page, capture) {
  await page.bringToFront();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // A fresh foreground page prevents preceding reduced-motion QA state leaking into recording.
  await page.reload();
  await page.waitForFunction(() => window.__livingScene?.ready);
  await page.waitForFunction(
    () =>
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !window.__livingScene.snapshot().paused,
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.mouse.move(800, 450);
  await page.waitForTimeout(2500);
  const before = await page.evaluate(
    () => window.__livingScene.snapshot().time,
  );
  await fs.mkdir(capture, { recursive: true });
  const cdp = await page.context().newCDPSession(page),
    frames = [],
    writes = [];
  let active = true;
  cdp.on("Page.screencastFrame", (e) => {
    if (active) {
      const index = frames.length;
      frames.push({ index, timestamp: e.metadata.timestamp });
      writes.push(
        fs.writeFile(
          path.join(capture, `frame-${String(index).padStart(5, "0")}.jpg`),
          Buffer.from(e.data, "base64"),
        ),
      );
    }
    cdp
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    maxWidth: 1600,
    maxHeight: 900,
    everyNthFrame: 2,
  });
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(
      800 + 550 * Math.sin(i * 0.14),
      450 + 230 * Math.cos(i * 0.15),
    );
    if (i === 14) await page.locator("#hotspot").click();
    if (i === 29) await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  await cdp.send("Page.stopScreencast");
  active = false;
  await Promise.all(writes);
  await fs.writeFile(
    path.join(capture, "timestamps.json"),
    JSON.stringify(frames, null, 2),
  );
  const after = await page.evaluate(() => window.__livingScene.snapshot());
  if (after.paused || after.time <= before + 10)
    throw Error("Capture must contain advancing animation");
  return {
    method:
      "Chrome DevTools Page.startScreencast; actual viewport including HTML UI",
    frames: frames.length,
    durationSeconds: frames.at(-1).timestamp - frames[0].timestamp,
    animationSeconds: after.time - before,
    paused: after.paused,
    encoding:
      "Resampled by timestamp to 15 fps; never used for performance numbers",
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE ||
      "/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  );
  const b = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
    args: ["--use-angle=metal"],
  });
  const p = await b.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  await p.goto(process.env.SCENE_URL || "http://127.0.0.1:8768/");
  const capture = await recordBrowser(
    p,
    process.env.CAPTURE_DIR ||
      "/Users/xiaruonan/nihongo-art-work/toolchain/living-scene-capture",
  );
  const evidence = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docs/living-scene/evidence",
  );
  const report = JSON.parse(
    await fs.readFile(path.join(evidence, "browser-report.json"), "utf8"),
  );
  report.capture = capture;
  await fs.writeFile(
    path.join(evidence, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(capture);
  await b.close();
}
