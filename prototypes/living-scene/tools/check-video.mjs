import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const dir =
  process.env.EVIDENCE_DIR ||
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docs/living-scene/evidence",
  );
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
);
const b = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: false,
});
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(pathToFileURL(path.join(dir, "browser-tour.mp4")).href);
await p.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
const result = await p.evaluate(async () => {
  const v = document.querySelector("video");
  v.pause();
  v.controls = false;
  v.currentTime = 10;
  await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
  return {
    width: v.videoWidth,
    height: v.videoHeight,
    duration: v.duration,
    decodedFrames: v.getVideoPlaybackQuality().totalVideoFrames,
    currentTime: v.currentTime,
    readyState: v.readyState,
    error: v.error?.message || null,
  };
});
await p.screenshot({ path: path.join(dir, "video-playback-check.png") });
await fs.writeFile(
  path.join(dir, "video-check.json"),
  JSON.stringify(result, null, 2),
);
console.log(result);
await b.close();
if (result.error || result.width !== 1600 || result.duration < 20)
  process.exitCode = 1;
