# Living Scene Audio V1 — 雨あがりの路地

Status: implementation branch `nihongo-living-scene-audio-v1-20260906`. This is the first adaptive soundscape pass for the approved rainy Living Scene V2. It is intentionally independent of NHK and the archived first-person game.

## Product rule

Audio is a second atmospheric layer, not a separate player UI. The artwork must still feel complete while muted. Sound begins only after a user gesture because browsers restrict autoplay; the audio button lives inside the same auto-fading chrome as pause/fullscreen.

## Four buses

1. **Ambience** — post-rain air, restrained filtered noise, rare residual drops. It should read as space rather than a looping “rain MP3”.
2. **Music** — very low-density original generative ambient harmony. Suspended/add9 voicings and sparse bell-like notes; no stereotypical shamisen/koto imitation and no obvious 30-second loop.
3. **Local / shop** — a warm low harmonic bed tied to the illuminated shop. It rises on hover and becomes closer after the camera pushes in.
4. **Interaction SFX** — tiny cues for audio enable, hotspot hover, enter/focus and return. They should confirm interaction without sounding like app notifications.

All buses feed one master with gentle compression. Music and cues share a generated convolution reverb so they occupy the same imagined alley.

## Scene-state mix

| Visual state | Ambience | Music | Shop layer | Cue |
| --- | --- | --- | --- | --- |
| Rest | normal | very soft | inaudible | occasional drop / sparse motif |
| Hover warm shop | normal | normal | gently rises | one quiet high bell, rate-limited |
| Push in / subtitle | slightly reduced | ducks | clearly present but still background | two-note warm entrance cue |
| Return | normal | restores | fades away | one lower release tone |
| Hidden tab | suspended | suspended | suspended | none |

Pointer X lightly positions one-off cues in stereo. The system does not attempt full 3D positional audio for this fixed-composition 2.5D scene.

## Procedural score

The current score is generated in Web Audio, so V1 has no external music/audio binaries and no third-party audio licensing dependency. A four-voice low-pass pad moves slowly through D/add9–B minor–G6–A suspended colors. A pentatonic-adjacent bell motif appears only every several seconds and is often skipped while the user is focused on text.

This is a prototype composition system, not final mastering. If the visual direction remains stable, a later production pass can replace or augment the procedural score with original recorded stems while keeping the same bus/state API.

## Ambient details

- Filtered brown/white noise bed for wet evening air and distant residual weather.
- Very slow gain modulation to avoid a static loop sensation.
- Randomized single or paired water drops with stereo placement.
- Warm interior harmonics around the shop, crossfaded from the visual hotspot state.
- Generated reverb impulse; no sampled IR or field recording in V1.

## UX and accessibility

- No autoplay on first visit.
- Audio preference is remembered, but the browser still requires a gesture to create/resume the AudioContext.
- Audio has its own control and does not overload the visual pause button.
- Hidden tabs suspend the AudioContext to avoid silent background playback.
- WebGL fallback does not require audio to function.
- Visual reduced-motion preference does not silently disable sound; users control sound explicitly.

## Next production audio pass

After V1 is listened to in the actual Living Scene rather than judged from code alone:

- tune the score density and tonal color by ear;
- add an optional original 90–150 second mastered music stem if procedural synthesis feels too synthetic;
- add higher-fidelity local SFX for eaves drip, cloth/noren movement, distant bicycle/footsteps and shop-door movement only when corresponding visual events exist;
- introduce Japanese voice only when a character or narration is actually present, keeping dialogue on its own ducking bus;
- build per-scene mix presets so future sunny / seaside / night scenes can share the engine without sharing the same music.

Do not add sound just because an asset exists. Every audible event should have a visible or narrative reason.
