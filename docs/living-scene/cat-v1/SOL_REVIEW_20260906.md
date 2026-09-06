# Cat Companion V1 — Sol review — 2026-09-06

## Verdict

**PASS — Cat Companion direction, scale, scene integration and interaction architecture.**

**REVISE — likeness consistency and edge/matte finish before the cat becomes a reusable cross-scene character.**

**NEEDS_ATTENTION — natural movement between anchors and final human listening review of the purr/music mix.** These are next-stage items, not blockers for preserving Cat V1 as the current baseline.

The reviewed candidate is based on `6e668dd3858e1993119ca6f881dcb7477d72f870`. Sol inspected the delivered browser screenshots, the state montage, the actual browser video frames, the state/audio documentation and the browser report. The temporary evidence-packaging commit created only for review is not part of the product verdict.

## What is accepted

1. **Current scale is accepted. Do not shrink again by default.** At 4.5% of source width, the cat reads as a discoverable living detail near the shop instead of a foreground mascot. It no longer competes with the street composition. Keep the feet/contact point fixed when changing poses or anchors.
2. **The cat belongs in the existing Living Scene rather than in a separate pet UI.** Current shop-step placement, restrained shadow, no card/chrome around the cat, and the same cinematic subtitle treatment preserve the artwork-first product direction.
3. **The interaction state model is appropriate:** observing → attentive / purring / watching / sleeping → observing. Hover, click, chin-hold, rest, reduced-motion and pause behavior form a valid V1 life layer without pretending to be a full pet simulation.
4. **Limited memory and multiple anchors are useful.** Alternating between two believable dry shop-side anchors on revisit is better than always spawning in one position. Keep this idea and expand it gradually.
5. **Audio integration architecture is accepted.** The cat gets its own bus; purring ducks music; the shop ambience is not triggered by unrelated hotspots; audio remains opt-in after a user gesture. The delivered recording contains the actual page output, not substituted post-production audio.
6. **Existing five scene hotspots and shop story remain intact.** The cat supplements the Living Scene instead of replacing the Japanese exploration layer.

## Visual review against the user's real cat photos

The current stylized cat successfully communicates a tabby-and-white domestic cat at scene scale, and the large-scale aesthetic is compatible because the cat is small and lit to match the warm/cool street palette. However, it is not yet a definitive reusable likeness.

Before generating many more poses, create a stable **character reference sheet** from the user's supplied photos and lock these traits across every pose:

- face is slightly slimmer / less round than the current generated candidate;
- green eyes and the user's cat's eye shape;
- white muzzle, chin, chest and front paws;
- forehead/tabby stripe layout and cheek markings;
- dark saddle/side markings and overall brown-black tabby balance;
- ear proportions and head silhouette;
- collar appearance only if intentionally retained;
- body proportions should not drift between alert/content/rest poses.

Do not chase photographic realism. Preserve the same painterly / cinematic rendering language as the street, but make the *identity* stable. Three poses should look like the same cat, not three separately generated similar cats.

The current technical alpha is acceptable for this scale but visible hair/fur contour work should be improved before close-up scenes. Do not spend time on individual-hair simulation; refine silhouette, whiskers, ear edge and white-chest transitions manually or with controlled masks.

## Next P0: make it feel alive without building a pet simulator

Do **not** jump to full navigation, physics, skeletal 3D or arbitrary pathfinding. Implement directed, believable autonomy inside the artwork.

### A. Natural anchor-to-anchor movement

Replace instant relocation with a small directed movement system:

- 3–4 safe anchors in the current rainy street: shop step, under-eave recess, near a planter/wooden post, second shop-side resting point;
- author a short path between compatible anchors;
- use a consistent walking/travel asset (small sprite sequence, layered motion, short transparent animation, or another approach that preserves the cat's identity);
- movement should be infrequent and purposeful, not continuous wandering;
- arrival should blend into observing/resting rather than snap;
- never walk into the wet road simply because it is geometrically possible.

A good result is: the user looks away, and later notices the cat has calmly moved somewhere plausible.

### B. Autonomous micro-behavior

Add a lightweight director, not AI pathfinding:

- observe → ear twitch / glance;
- occasionally watch leaves;
- rest after a calm interval;
- change anchor only after a longer idle interval or after selected interactions;
- if the user approaches/pets it, postpone autonomous departure;
- use time ranges and weighted choices so behavior does not repeat mechanically.

The cat should sometimes do nothing. Stillness is part of the aesthetic.

### C. Interaction

Keep current chin-pet interaction. Add at most one or two high-value reactions next:

- look toward a clicked/hovered nearby object;
- stretch or small reposition before resting;
- optional short approach to a nearby anchor after repeated friendly visits.

Do not turn every mouse move into a reaction.

## Sound next steps

Do not rebuild the sound engine. Continue from Sol Audio V1 + current cat bus.

- Keep the existing ambient/music/warm-shop/cat buses.
- Purr should be subtle and local; music ducking is correct conceptually.
- Add only scene-justified sounds: soft paw/cloth movement during relocation, very occasional landing/rustle if a movement visually requires it.
- Do not add generic frequent meows, game reward chimes or unexplained collar bells.
- Final balance remains **human listening review**. Numeric RMS/peak and presence of an audio stream prove wiring, not musical quality. Do not spend a new cycle on audio performance benchmarks.

## Naming

`拿铁 / ラテ` in the delivery was described as a temporary name inferred from local photo-folder context. **Do not treat that name as verified user product truth unless the user explicitly confirms it.** Keep display copy neutral (e.g. 猫 / あの子) until confirmed.

## Cross-scene direction

Once identity is stable and one natural move works in the rainy street, reuse the same cat reference across new Living Scenes rather than regenerating an unrelated cat each time. Suggested future scenes remain:

1. window-side evening — looking outside / ears reacting to distant city sounds;
2. night study desk — sitting near books, occasionally settling on the workspace;
3. sofa nap — strongest resting/purring scene.

Each new scene should maintain the existing artwork-first rule: static image quality first, cat integrated into composition second, subtle life/interaction third, Japanese content fourth. The cat is an emotional continuity layer, not the main UI.

## Explicitly deprioritized

- no FPS micro-optimization unless there is visible failure;
- no full 3D cat or free-roam physics;
- no complex AI decision model;
- no large pet-management UI, meters, food/health systems or gamified rewards;
- no NHK work/regression in this branch;
- no production merge/deploy until the user asks.
