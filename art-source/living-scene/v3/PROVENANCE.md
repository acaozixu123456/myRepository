# V3 localized detail experiment

Built-in `image_gen.imagegen` was used, with one separate edit call per source quadrant. No CLI/API fallback, no external upscaler, and no repeated full-frame 4K request. All four outputs contain newly generated local detail. Four lossless crops were prepared from the accepted original; they were not enlarged before generation.

Original: `/Users/xiaruonan/nihongo-art-work/living-scene-v2/art-source/living-scene/hero-original.png`, 1672 × 941.

Inputs, outputs, exact prompts, hashes and alignment evidence are preserved in this directory. Original source and Site checkout were not modified.

## Results and decision

All generated outputs are natively 1672 × 941. Each input was 920 × 518. The nominal combined density is approximately 3039 × 1710, but there is **no approved seamless 3039 × 1710 master**. Do not label this native 4K.

| Tile | Native size | Median / p90 drift in original crop pixels | Assessment |
|---|---|---|---|
| top-left | 1672 × 941 | 0.54 / 1.10 | Strong composition retention; useful candidate |
| top-right | 1672 × 941 | 2.23 / 3.31 | Small shift; approximate global registration available |
| bottom-left | 1672 × 941 | 93.46 / 148.91 | Reframed/zoomed; cannot cover original crop |
| bottom-right | 1672 × 941 | 18.27 / 20.49 | Shifted; registration needed, slight missing edge coverage |

Feature-matched global registration has median inlier errors of 0.46–0.60 original pixels. This indicates many original objects can be aligned globally; it does not verify every pixel or every changed detail. Texture and local geometry still differ. The bottom-left registered image covers only approximately source-crop x=30–753, y=53–461 instead of x=0–920, y=0–518. Missing borders require retaining original pixels, a further artistic edit, or another source; they must not be hidden by an unsupported claim of a complete high-resolution redraw.

`compositing-manifest.json` includes the exact input crop coordinates and approximate output-to-source-crop homographies, mapped corner coverage, generation dimensions, and SHA-256 hashes. These provide a precise starting point for an editable composition, but seam choice and visual validation are outstanding. All tiles remain separate. At that initial checkpoint, only input crops and numerical QA had been computed; the follow-up composition below supersedes that checkpoint.

The intended scene remains blue rainy alley, warm shop on the right, red maple at upper left. Native tile inspection shows finer leaf, roof, wood, shop and wet-pavement detail. Lower-tile framing drift prevents direct drop-in adoption of all four tiles.

## Tool output origins

- top-left: `/Users/xiaruonan/.codex/generated_images/01a07536-5f46-7493-b909-9a6901872686/exec-f6e9e6bf-66a7-4508-92d2-b8bf4cac540b.png`
- top-right: `/Users/xiaruonan/.codex/generated_images/01a07536-5f46-7493-b909-9a6901872686/exec-600f9819-f2c7-4724-baba-618b7191af75.png`
- bottom-left: `/Users/xiaruonan/.codex/generated_images/01a07536-5f46-7493-b909-9a6901872686/exec-13c72ae7-13f5-4a37-9070-f52692fb76d6.png`
- bottom-right: `/Users/xiaruonan/.codex/generated_images/01a07536-5f46-7493-b909-9a6901872686/exec-c7fa01c6-ebe1-4b1f-b60b-463952868992.png`

These were copied losslessly to `outputs/`, leaving tool originals in place.

## Follow-up deterministic evaluation composition

The owner explicitly requested a registered candidate for visual evaluation after the initial bounded generation pass. `evaluation/candidate-registered-3039x1710.png` was then assembled with the measured global homographies and 36-pixel inward feather masks. Separate full-canvas registered RGBA layers are available, alongside full-resolution feature correspondence overlays, a coverage overlay, original/candidate checkerboard, and contact sheet. No further images were generated.

Coverage measured on the 3039 × 1710 canvas: 95.97% has some generated tile coverage; 4.03% is original-only fallback; 88.95% has full generated contribution; 7.02% blends a generated boundary with original fallback. The original fallback is ordinary Lanczos interpolation, explicitly not newly generated detail. The assembled candidate is not native single-frame 4K and is not yet approved for production. The original-only areas are mainly the lower-left edge/bottom and thin gaps between registered lower tiles.

Visual contact-sheet inspection: the accepted composition is retained by registration, including the blue rainy alley, warm shop on right and maple above left. Fine roof and material detail has increased. There is visible exposure/texture variation between independently redrawn regions, most apparent near the lower-left coverage border and in the upper overlapping sky. Full-resolution seam review by the owner remains necessary. No manual nonuniform warp was applied beyond the recorded feature-fitted homographies. The reconstruction script `compose-evaluation.py` records the exact compositing process for this evaluation only.

## V3 owner integration

The owner inspected the assembled frame and adopted it only in the isolated V3 review prototype. `hero-original.png` is the composite pipeline input, not a native single-frame tool output. Native originals remain in `outputs/`. Depth and semantic mattes were regenerated from this composite; 4.03% original-only fallback and seam limitations remain declared. The runtime hero is WebP encoded from this composite.

Art was generated using the user-authorized built-in image tool. No external paid API, third-party source image, or real-person likeness was added. Source-art provenance continues the V1 `art-source/living-scene/PROVENANCE.md`; this output is generated art, not a stock asset claimed under an invented open-source art license. Code dependencies and offline Depth Anything V2 Small retain the licenses documented there.
