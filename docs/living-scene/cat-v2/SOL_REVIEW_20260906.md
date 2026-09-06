# Sol Review — Cat Companion V2 — 2026-09-06

Reviewer: ChatGPT Sol.

## Decision

- **PASS — current cat scale and scene composition.** Keep the accepted 4.5% source-width scale; do not shrink again.
- **PASS — unified character-reference direction.** V2 is materially more consistent than V1 and is suitable as the working identity baseline for Latte / ラテ.
- **PASS — bounded autonomous travel concept.** The browser evidence proves real intermediate positions and directional walk frames between three authored dry-step anchors. It is not teleportation and it does not need open-world pathfinding.
- **REVISE — stand-up / turn / settle transitions.** This is now the most visible motion defect. The current ~0.65 s pose blend briefly reads as a ghosted/morphing cat when leaving or returning to the loaf pose.
- **REVISE — identity fidelity and atlas consistency.** The reference now clearly reads as the same tabby-and-white character family, but face width, eye expression, flank markings, fur edge and body volume still drift across rest/walk frames. It is not yet a locked production character sheet.
- **NEEDS_ATTENTION — subjective final audio mix.** Browser routing, ducking, purr state and non-silent output are technically evidenced; final pleasantness of purr/music/ambience still needs real listening, not another numeric performance pass.

## What Sol actually reviewed

I reviewed the delivered character-reference sheet, clean scene, attentive/purring stills, departure/mid-walk/arrival stills, matte atlas and the ~29 s browser recording. I also reviewed the browser report showing all 16 checks true, including continuousDryPathFrom0/1/2, actualIntermediatePositions, walkingFramesVisible, audioStillDucks and actualAudioNotSilent.

### Character likeness

Compared with the user's supplied photos, the new reference preserves the important identity cues much better: green eyes, white muzzle/chest/paws, forehead M, cheek stripes, brown-black tabby body and thin brown collar. It is now believable as a stylized version of the same household cat rather than a generic tabby.

Remaining identity differences should be treated as art calibration, not a reason to replace the whole approach. The generated reference is still somewhat rounder / more evenly idealized than the real cat in several photos, and the exact flank pattern changes between atlas frames. Preserve the reference-sheet workflow and refine from it instead of generating unrelated poses independently.

### Scene composition

The cat remains a discoverable secondary life-form in the scene rather than the visual subject. The current size works. In the clean frame it occupies only a small part of the warm shop edge, which preserves the street composition. Do not enlarge it for the sake of showing animation detail; close interaction can use the existing camera/subtitle treatment when needed.

### Autonomous movement

The V2 movement is the right product abstraction: three dry anchors, adjacent authored paths, infrequent decisions, user attention delaying departure, and movement freezing for pause/reduced-motion/background state. This creates the feeling that Latte has its own rhythm without turning Living Scene into a pet simulator.

The mid-walk still reads clearly as a walking cat and the arrival returns to a plausible resting placement. The browser report shows a 1→2 trip lasting ~4.33 s with actual intermediate positions and a later arrival at anchor 2; this is sufficient evidence that the movement is continuous.

## P0 revision: transition animation

Do **not** add more locations or AI behavior before fixing the motion seam.

Current departure/arrival blends visually superimpose loaf and walk silhouettes for a short period. At this small scale it is tolerable but still visible, especially against the bright shop floor.

Preferred fix order:

1. Add authored transition poses rather than lengthening the crossfade:
   - loaf → forelegs extend / shoulders rise;
   - stand / orient;
   - first walking step;
   - final step;
   - crouch / legs fold;
   - loaf.
2. Use a very short opacity overlap only where silhouettes are already close. Avoid two clearly different body volumes at 50/50 opacity.
3. If the cat changes travel direction, add one believable orientation/turn frame; do not horizontally mirror a distinctive asymmetric pose if that makes markings visibly swap sides.
4. Keep paws grounded to the authored dry step. Do not solve the seam with a vertical float or whole-body scale pulse.

A 4–6 transition-frame mini-sequence per direction is enough at the current screen size; full skeletal animation is not required.

## P1 revision: production character consistency

After the transition is fixed, refine the identity sheet and atlas:

- lock eye color and iris brightness to the supplied photos;
- preserve the forehead M and cheek stripes across front/side/rest poses;
- keep white chest and white forepaw proportions stable;
- reduce frame-to-frame flank-pattern drift;
- clean green/background contamination and hard fur cutout edges, especially ears, back and tail;
- add a small amount of individual whisker/fur silhouette only where it survives at the actual 4.5% display scale;
- document the unseen-side pattern as an authored approximation unless a real reference photo supports it.

Do not chase pixel-perfect photorealism. The goal is **recognizable Latte + the same painterly Living Scene aesthetic**.

## Audio

Keep the existing Sol Audio V1 architecture. No new audio framework is needed.

For walking, use only restrained soft paw/cloth/wood contact, preferably sparse rather than one hard tick per animation frame. Purring should continue to duck music subtly. Do not add collar jingles, reward sounds or frequent meows unless there is a specific scene reason.

No more performance benchmark work is required for this revision unless audio causes a real glitch.

## After Cat V2.1 passes

Do not keep polishing this one street forever. Once transition quality and identity consistency are good enough, freeze the cat system as a reusable companion layer and move to the next Living Scene while preserving:

- Latte's confirmed identity/reference sheet;
- the same 4.5% approximate visual hierarchy for distant scenes;
- authored safe anchors per scene;
- autonomous but sparse movement;
- current sound-bus behavior;
- scene-first composition and minimal UI.

Recommended next scene order remains: **window-side dusk → night study desk → sofa nap**, because these are strongly supported by the user's real cat photos and give Latte natural behavior roles without forcing game-like mechanics.
