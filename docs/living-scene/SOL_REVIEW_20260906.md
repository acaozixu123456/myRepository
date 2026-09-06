# Sol Review — Living Scene V1 — 2026-09-06

Reviewed source delivery: `7dd296e78b48516a19f0bfb003987fb25b45e6ea`.
The later workflow-only commit used to package review evidence does not change the prototype/art assessment.

## Verdict

- **PASS — visual direction / hero-frame threshold.** This is the first iteration in the project that meets the intended high-fidelity dynamic-illustration direction. The actual browser hero screenshot is strong enough to keep and iterate instead of returning to the first-person 3D map route.
- **PASS — technical concept.** A single high-quality image + retained depth + editable masks + restrained Three.js reprojection + particles/post-processing is the correct architecture for the current product goal.
- **REVISE — final production art.** The master image is 1672×941, not a high-DPI desktop master; depth bands are broad work layers rather than semantic object mattes; persistent UI still occupies more of the composition than necessary.
- **REVISE — motion richness.** Current motion is intentionally small and avoids artifacts, which is better than cheap large parallax. The next gain should come from local believable motion (foliage, curtain/lantern, reflections, steam/mist/light) rather than increasing global camera travel.
- **NEEDS_ATTENTION — smoothness.** Radeon Pro 555 / Chrome evidence averages 48.15–51.14 FPS, with P95 up to 49.7 ms. This is usable prototype evidence but not a stable-60 claim. Safari, Windows GPU, high-DPI modern desktop and long-duration thermal behavior remain unverified.

## Visual review against the user reference bar

The delivered `hero-desktop.png` now succeeds at the qualities that mattered in the reference: deliberate composition, coherent architectural detail, strong warm/cool lighting contrast, deep atmosphere, reflections, vegetation framing, and a frame that is attractive before any interaction occurs. The rainy blue-hour mood is different from the supplied sunlit reference, but that is an art-direction variation, not a quality failure.

Do not interpret this PASS as permission to lower the bar for future scenes. Every new hero scene must pass as a still image first.

## P0 next iteration

1. **High-resolution master**
   - Produce/re-render a true high-resolution hero master suitable for 2560–3840 px desktop output; do not merely upscale the current 1672×941 image and label it 4K.
   - Preserve the current rainy-street composition unless a new master is demonstrably better.
   - Keep the exact generation/provenance record and retain the original unprocessed master.

2. **Semantic matte refinement, not more global parallax**
   - Separate foreground maple branches/leaves from the house/sky boundary with hand/refined masks.
   - Separate hero-shop window/lantern/noren-or-curtain area and road reflection regions.
   - Create background repair only where a local foreground movement exposes hidden pixels; do not invent broad camera freedom.
   - Keep current global parallax magnitude roughly in the same restrained range until mattes are artifact-free.

3. **Local living motion**
   Prioritize four effects that create life without degrading the painting:
   - restrained branch/leaf movement with edge-safe masks;
   - warm shop/lantern light breathing or very subtle flicker that also affects the corresponding wet-road reflection;
   - tiny steam/mist or warm-air motion near the shop, if visually justified;
   - slow fog/cloud/atmosphere drift in the far depth band.
   Falling leaves/dust may remain sparse. Do not add generic particle density merely to make motion obvious.

4. **Reduce UI footprint further**
   - Default scene should look almost like a full-screen moving artwork.
   - Keep branding/scene number/title either auto-fading, entrance-only, or reveal-on-intent instead of permanently competing with the frame.
   - The Japanese subtitle interaction is acceptable; keep it typographic and cinematic, not a card/dialog form.
   - Hotspots should be discoverable through light/scene response, not persistent UI chrome.

5. **Performance A/B without sacrificing hero quality**
   - Preserve the high-quality image path; optimize implementation first.
   - A/B test RGBA8/default composer buffers versus current HalfFloat post-processing because the source image is LDR and no HDR tone pipeline is required.
   - Convert the 18 leaf meshes to an `InstancedMesh` or equivalent single/few draw calls.
   - Profile whether full-screen Bloom at ~2 MP is the dominant GPU cost; test a smaller bloom resolution or a targeted glow implementation and compare screenshots before accepting.
   - Consider matching the render-pixel budget to source/master resolution rather than rendering beyond source information.
   - Acceptance target on the same Radeon Pro 555 evidence machine: improve average and reduce slow-frame count materially; do not declare success only from one newer GPU.

## P1 after V2 hero polish

- One additional sunlit daytime scene should be created only after V2 of this rainy scene is visually and technically accepted. It can target the brighter, lush, sun-and-shadow quality of the user's supplied reference and prove that the system is not dependent on a dark scene to look good.
- Then establish a reusable scene manifest format for hero image, depth, semantic mattes, motion zones, hotspots, subtitle content and audio hooks.
- Only after two visually accepted scenes should the product shell/navigation be redesigned around the Living Scene concept.

## Explicitly frozen / out of scope

- Do not resume the first-person Babylon free-walk art effort.
- Do not expand the old 3D street map.
- Do not spend this iteration on NHK regression or learning dashboards.
- Do not integrate Gaussian Splatting merely for novelty; the current fixed-view illustration approach is sufficient unless a future scene genuinely needs larger viewpoint motion.
- Do not deploy or replace production until the user has reviewed a public preview of the Living Scene prototype.

## Evidence reviewed by Sol

- `hero-desktop.png`: actual browser hero frame.
- `subtitle.png`: Japanese interaction state.
- `parallax-left.png` / `parallax-right.png`: restrained depth reprojection evidence.
- `asset-pipeline.png`: original hero, raw/refined depth and far/mid/near working layers.
- `browser-tour.mp4`: actual viewport capture; reviewed through extracted timeline frames.
- `PERFORMANCE.md` / `qa-summary.txt`: actual Chrome / AMD Metal measurements and functional checks.
- `PROVENANCE.md` / `RESEARCH.md`: generated-art provenance, Depth Anything V2 Small usage and integrated library licensing.
