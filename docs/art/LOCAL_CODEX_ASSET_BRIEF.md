# Optional local Codex art assistance — 2026-09-06

Status: HANDOFF PREPARED. No local agent has been started by Sol. This document is a proposed bounded assignment for the user to give their local Codex; it does not certify local tool availability or asset quality.

## Current user direction (takes precedence over older product plans)

Desktop first. Prioritize beautiful, coherent Japanese street art, rich but controlled lighting, and appealing stylized characters, NOT photorealistic human faces. Reduce app-like UI; preserve the view of the actual character and environment during conversations. Do not expand the map or add learning features in this art batch. NHK work and NHK regression tests are explicitly out of scope; do not delete or modify its data/code.

Sol owns the live game's rendering integration, lighting/post-processing, camera/controls, HUD/dialogue presentation, review, and release. Optional local assistance owns offline 3D asset production, export/baking, and separately identified actual-hardware evidence. This is user-initiated local assistance, not an instruction to use an old Windows/Cursor/Luna gateway or to alter POSIF.

## Repository and branch isolation

Repository: acaozixu123456/myRepository.
Sol's working branch: nihongo-desktop-art-20260906.
Current production baseline for this art batch: 85134634d7eeb0b593c9b533145711849f7d57b1 on nihongo-vercel.
Read README.md, this document, src/explore/world.ts and src/explore/geo.ts before work. Create your OWN branch/worktree, suggested name nihongo-art-assets-local-20260906, from the art working branch. Do not work on the repository default Demo branch. Never reset or clean an existing dirty worktree. Existing README prohibits automatically routing the whole app to a Windows executor; this optional user-authorized asset assignment is limited to the scope below.

Allowed new paths:
- art-source/desktop-v1/ — original Blender source and source manifests.
- public/explore/assets/desktop-v1/ — delivery models and textures.
- tools/art/desktop-v1/ — repeatable production/export scripts and an isolated asset viewer.
- docs/art/desktop-v1/ — environment report, asset manifest, provenance, limitations and review evidence.

Do NOT modify src/explore/world.ts, main.ts, style.css, state.ts, audio.ts, shared Vite/package configuration, service workers, API code, NHK code, production branches, databases or secrets. Integration suggestions go in documentation, not main application edits. No deployment or merge. Avoid committing large source archives or vendor libraries; provide a documented artifact where appropriate. Never place credentials in files, logs or public artifacts.

## First check: tools and hardware

Report OS, GPU model, Blender availability/version and usable rendering backend, Node/browser availability, and repository/branch state. Local Codex can only orchestrate tools actually available and permitted. Do not invent GPU support, install unknown scripts, bypass permissions, purchase assets or use a paid generation service without explicit approval. If Blender is absent, report that specific blocker and complete asset/provenance preparation that is possible; do not substitute a toy primitive scene and call it finished.

## Asset priority A: one excellent bento storefront / small interior

Make ONE coherent, high-quality modular hero shop first, not dozens of mediocre assets. Japanese animation-influenced everyday street: restrained warm wood, plaster, fabric noren, readable editable signage, recessed windows, modeled trim/bevels, counter, display trays, small plants and believable fixtures. Architectural proportions should remain usable in first person. No photo facade with fake doors, no building made only of a flat box, and no effects used to hide poor geometry.

Integration envelope extracted from the current source, as a TARGET CONTRACT rather than a surveyed real building:
- Approximate width 8.55 m, depth 5.70 m, height 5.65 m.
- Shop-local origin at the front doorway on the ground; x across frontage, y up, interior toward positive z; street toward negative z.
- Centered walkable doorway: x from -1 to +1 m, clear opening to about y=2.6 m.
- Keep the center doorway and route to the counter unobstructed.
- Existing counter center near z=3.4 m, top near y=1.16 m; NPC standing anchor near x=0.4, z=4.25 m.
- Geometry and rendered appearance may improve, but proposed changes to the movement/collision envelope must be explicitly listed.

Export a neutral-lighting version with materials and optional separate AO/indirect-light textures. Do not bake a hard sunset shadow into base color: the runtime will have its own sun. Full-scene indirect-light baking requires agreement on final geometry, light positions and UV mapping; do not silently assume a Blender bake will match the game.

## Asset priority B: one stylized shopkeeper

Adult shopkeeper with roughly 4.5–5.5-head stylized proportions; warm approachable silhouette, simple facial features, matte skin, sculpted hair masses, apron/cloth with readable shape. Not a realistic scanned face, not a flat avatar card, not a primitive sphere with cylindrical limbs. Do not infer the character is a real person. No real-person photos or likeness required.

Prefer original work or a base asset with confirmed modification AND redistribution rights. A coherent licensed base refined for this style is better than a rushed from-scratch toy model. Keep claims honest if no suitable asset exists.

Deliver a game-readable full-body model, feet at the origin, transform scale normalized, documented forward direction, clean rig and named animation clips where actually implemented: idle, greet, talk. Blink can be a morph target or simple bone/mesh animation; do not claim lip synchronization unless tested. Provide neutral and warm-light close-ups, side/back views, and animation evidence.

## Delivery / interoperability

Required runtime format: glTF 2.0 GLB, with embedded or explicitly packaged textures, intended for the current Babylon.js 9.25.0 project. Export in meter units with glTF +Y up and DOCUMENT the model forward axis; verify the existing Babylon left-handed scene's import transformation rather than guessing orientation.

Do not assume Blender-only shaders, geometry nodes, procedural materials or lights will survive glTF export. Apply/bake required geometry/material details and test the actual exported GLB in a separate Babylon.js viewer. Keep base color, normal, roughness/metallic and AO semantics explicit. Optional indirect lightmaps must be separate with documented UV channel and suggested integration, not mislabeled as albedo or a claimed automatic glTF feature.

Provisional budgets (review targets, not a claim that these alone guarantee FPS): hero NPC roughly 25k–60k triangles, hero shop roughly 50k–150k triangles, primarily 1k/2k textures, no unapproved 8k textures, avoid hundreds of materials or draw calls. Record actual triangles, vertices, material count, texture sizes, asset bytes and load errors. Optimize after appearance review instead of lowering quality blindly.

Required deliverables: exported GLB/textures; editable .blend or reproducible source scripts; asset manifest; exact origin/license/attribution/redistribution notes; neutral-view and in-browser screenshots; short rotation/animation capture if available; commands used; errors and unverified limitations. A gorgeous Blender-only still is NOT game-art acceptance.

## Hardware validation (after a candidate is integrated or in the isolated viewer)

Use an actual hardware-accelerated desktop browser; report GPU/renderer, browser version, physical/render resolution, device pixel ratio, quality settings, frame-time distribution and visible defects. Verify that the renderer is not SwiftShader/software rendering. Record sustained movement and a character close-up, not only a static FPS counter. Separate offline path-traced renders from live in-browser evidence.

## Return protocol

Return your asset branch + commit SHA, manifest path, downloadable source artifact where needed, and a concise implemented/not-implemented report. Do not mark final art as accepted, do not deploy, and do not modify production. Sol reviews exported assets in the actual street before accepting and integrating them. The first review target is the hero shop; it is acceptable to deliver that first rather than block it on the NPC.
