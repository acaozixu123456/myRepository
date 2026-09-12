# CITY05

Four user-approved scene directions are selectable without resetting Japanese voice, the desktop teacher rail, selection study, custom topics, NHK articles, or expression records. Separate photographic vehicle cutouts approach, land, dwell, lift and depart; transit lanes and trains have independent timing. Billboard emissive scans and lower ticker content change independently. The camera does not merely pan a static image.

Music is an original locally synthesized sixteen-bar instrumental composition per scene, not a copied Cyberpunk 2077 soundtrack. It is off until explicitly enabled, has independent volume, hard-mutes while the microphone is open, ducks under Japanese playback, pauses when hidden, and is not persisted. Only the visual scene choice uses the new `hitokoto-city05-scene` key. No API credentials or new AI requests are needed for scenery or music.

## Artwork limitation — do not conceal
The supplied approved images are 1672×941 UI concept images. This version extracts their unobstructed scenery: 775–920 pixels wide by approximately847 pixels tall. These are NOT native4K background plates. Canvas detail settings do not create extra source detail. The previous original4K rain city is retained as an explicit option. Stationary vehicles remain in the original plate; only separately composited objects move. This is illustrated2.5D layering, not a complete real3D city or fully regenerated scene video. It does not yet satisfy a demand for four independently authored native4K UI-free environment masters.

The temporary image-generation helper was retired without calling the provider after its build request was blocked. This implementation does not reactivate it; all new imagery comes from user-approved visual assets, and music is locally composed.

## Acceptance
Unit tests check phase continuity, motion paths, content changes, native dimensions, isolated visual storage and audio precedence. Browser tests must compare actual rendered pixels, switch all four scenes without creating a new voice peer, verify MP3 decoding and opt-in behavior, hard microphone mute, ducking, zero gain, paused hidden/reduced-motion states and continuing teacher functionality. Existing voice, multi-turn hints, Teacher02 and Immersion03 regression tests remain required.

Voice and teacher providers are mocked during UI tests. Actual image rendering and MP3 playback are tested. Physical iPhone long press, long human conversation under rich motion, subjective music quality and learning-retention outcomes are not claimed. Production publication requires exact public resource hash checks and the actual hosted UI matrix.
