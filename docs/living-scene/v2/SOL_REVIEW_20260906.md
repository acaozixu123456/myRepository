# Sol Review — Living Scene V2 — 2026-09-06

Reviewer: ChatGPT Sol.

## Decision

- **PASS — visual direction and current Rainy Living Scene V2 baseline.**
- **PASS — subtle local animation model:** foliage micro-motion, linked warm window/lantern/reflection rhythm, fog, warm-air distortion, sparse particles, restrained parallax.
- **PASS — UI direction:** default scene becomes essentially clean artwork; chrome can be revealed intentionally; the subtitle interaction is substantially less app-like than the earlier 3D/game UI.
- **REVISE — source-art resolution and final semantic edge polish.** The master remains 1672×941. This is not a 4K master and must not be described as one.
- **NEEDS_ATTENTION — only material performance blockers.** Do not spend additional primary development time chasing small FPS/tail-latency differences. Current desktop behavior is sufficient for visual/content iteration unless obvious stutter, crash, loading failure, or interaction failure appears.

## Visual review

The clean browser capture now reads as a finished illustration first, not as a web UI or game prototype. Composition is strong: dark maple canopy frames the top/left, the warm shop is the focal point, wet pavement carries the warm light toward the viewer, and the cool mountain/fog corridor provides depth. This is the correct product direction.

The V2 interaction is also appropriately restrained. The Japanese subtitle appears without turning the scene into a card-based app. Controls fading away by default is accepted. Future UI should preserve this rule: artwork dominates; controls appear only when requested or contextually necessary.

Semantic mattes are useful enough for the current motion amplitudes. They separate foliage, shop window, lanterns, wet-road warm reflection, fog, and warm interior air. They are not pixel-perfect object mattes and should not be used to justify larger motion. Existing micro-motion is the right scale.

## What to stop doing

Do not spend the next cycle on:

- further 60 FPS benchmark tuning when the scene already renders acceptably,
- broad cross-device optimization,
- larger global parallax,
- returning to free-walk 3D gameplay,
- adding permanent HUD/card UI,
- NHK regression or unrelated legacy work,
- additional architecture research unless a concrete visual blocker requires it.

Keep the current performance improvements, but treat them as complete enough for now.

## Next development direction

### P0 — Obtain a genuinely higher-resolution master

The largest remaining visual limitation is the 1672×941 source. The next master should be genuinely authored/generated with substantially higher native detail, target roughly 2560–3840 px width or more. Do not satisfy this by ordinary interpolation and do not label a simple upscale as a new high-resolution master.

If the current built-in generation path continues returning 1672×941, change the art-production method rather than repeatedly requesting the same unsupported dimensions. Valid directions include a higher-resolution art source, multi-pass detail reconstruction/repaint, or another rights-clear production workflow. Preserve provenance.

Once the high-resolution master is accepted, rerun depth estimation and semantic-matte production from that master instead of stretching existing masks.

### P1 — Turn one beautiful scene into a real 5–10 minute Japanese experience

Do not create many scenes yet. Add 3–5 carefully chosen interaction points to this same rainy street, for example:

1. **Shop light / owner** — brief human exchange around the rain stopping.
2. **Wet street / reflection** — environmental phrase or observation rather than a quiz.
3. **Lantern / shop notice** — naturally useful written Japanese.
4. **Maple leaves / season** — short vocabulary or expression tied to the image.
5. **Distant street** — optional ambient line / small story hook.

Interaction should remain cinematic: hover/light response, slight push-in, one or two lines, optional explanation. Avoid modal study panels.

### P2 — Add restrained audio

After the first interaction cluster is visually settled, add ambience and sparse sound: post-rain dripping, distant street tone, faint interior shop sound, and voice only when an interaction needs it. Audio must feel like part of the scene, not a lesson player.

### P3 — Create the second visual benchmark

Only after Rainy V2 + interactions are coherent, create a second scene with a deliberately different lighting challenge: **sunny late-afternoon Japanese residential / shopping street**, closer to the user's original warm reference image. This verifies that the Living Scene system is not dependent on dark rainy imagery to look premium.

## Acceptance rule going forward

For every future scene:

1. Static frame must first be beautiful enough to stand on its own.
2. Motion must enhance the still image rather than advertise itself.
3. Interaction must preserve the composition.
4. Japanese learning content must emerge from objects/people already present in the scene.
5. Performance tuning is secondary unless it visibly harms the experience.

V2 is accepted as the current Rainy Living Scene baseline. Do not merge into production yet solely because of this review; integrate only when the product entrypoint and first interaction set are ready for user-facing preview.
