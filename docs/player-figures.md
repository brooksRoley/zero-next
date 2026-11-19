# Player figures in 3D — design note

Status: spike built, measurements partial (2026-11-05). Owner: Brooks.
Companion to `docs/player-roles.md`: that note decides *what* a player is;
this one decides *how they look and move*.

## The problem

The current figures (`PlayerSprite.tsx` in zero-next, `PlayerSprite.vue` in
Hardwood) are flat SVG with CSS keyframes. They read their role clearly, but:

- **They don't move like basketball.** A shot is a ball sliding along keyframes.
  Nothing has weight, and there's no jump, release or follow-through.
- **They can't be seen from more than one side.** Front-on only, so a special
  move can't be staged.
- **They don't scale with the player.** Every figure is the same height.

The target is an **arcade sports** look: exaggerated proportions, cel shading,
thick outlines and big special moves. It's a genre, not a copy. The figures
stay original, with no player likenesses, no franchise marks and no imitation
of any particular game's characters or presentation.

## Constraints

1. **Phones first.** Hardwood is played on phones held upright. The budget is
   60 fps on a recent iPhone and a mid-range Android, without heating the phone.
2. **Don't tax the rest of the game.** The shop, planning board and fight
   already load Vue, Pixi and a WASM engine. 3D has to be a separate chunk that
   loads only when a player opens it.
3. **The sim decides; the art plays it back.** Fight outcomes come from the C++
   engine (`shared-core`), which is deterministic. That's what makes ghost
   boards, the Film Room and the fuzz tests work. Nothing in the 3D layer may
   decide a result.
4. **The same input always draws the same output.** Pure functions of
   (player, move, time) can be unit-tested in plain Node, like the rest of
   `client/game/`.

## Decisions

### Renderer: plain Three.js, loaded on demand
- **React Three Fiber:** wrong framework (Hardwood is Vue) and adds a layer of
  overhead per frame.
- **Babylon.js / PlayCanvas:** capable, but larger, and a whole engine for one
  card.
- **Pixi 3D / extending the 2D court:** keeps one renderer, but has no real 3D
  lighting or outlines.

Three.js core, imported with a dynamic `import()` from the inspector component,
so only players who open a figure download it.

### Figures: built in code, not downloaded models
- **Rigged models from an asset library (e.g. Mixamo):** good animation, but
  far above the polygon budget, heavy downloads, a licence to track, and still
  a generic human that doesn't carry the role.
- **Hand-made glTF models:** the best long-term quality, but needs an artist
  and a pipeline we don't have.
- **Chosen: procedural low-poly figures** built from capsules, boxes and
  spheres in a small joint tree (hips, chest, head, arms, legs). Under 3,000
  triangles, no asset files. Proportions come from data: the role's gear and
  colours from `archetype.js`, and height from `heightInches` once
  `player-roles.md` lands it (until then, build). The joint tree is named so a
  glTF model can be swapped in later without touching the moves.

### Shading: toon material with an inverted-hull outline
- **A Sobel edge pass (EffectComposer):** a full-screen pass every frame, the
  kind of post-processing that costs the most on phones.
- **Chosen:** `MeshToonMaterial` with a 3-step gradient for the shading, plus
  an **inverted hull** for outlines: each mesh drawn a second time, back faces
  only, in black, pushed out along its normals. No extra screen pass, and the
  outline weight is in world units, so it stays even at any size.
- No real-time shadows. A **blob shadow** (a soft disc texture on the floor)
  that shrinks and fades as the player leaves the ground.

### Motion: authored curves, not a physics engine
- **Rapier (WASM rigid bodies):** right for things that tumble freely; wrong
  for a scripted shot whose result is already decided. It adds a sizable WASM
  download, and its results depend on floating-point and step timing, which
  breaks rule 4.
- **Chosen:** every move is a pure function `pose(move, t)` returning joint
  angles and offsets, with easing written per move. The ball is a **two-gravity
  parabola**: normal gravity rising, heavier gravity falling, for the arcade
  snap through the rim. It's solved in closed form so it always lands exactly
  in the rim at the set time. Tested in `client/figure3d/__tests__/`.

### Effects: instanced, additive and cheap
Blur's streaks and the sparks are one `InstancedMesh` each (one draw call per
effect). The Wall is a translucent hexagon; Glue is a ring. All use additive
blending; no bloom.

### Rendering policy
- Pixel ratio capped at 2.
- Render only while a move plays or the figure is being turned; stop when the
  inspector closes or the tab is hidden.
- Dispose of every geometry, material and texture on close.
- Under `prefers-reduced-motion`: show the move's key pose as a still and play
  nothing.

## The spike

Where: a **3D** button on each Hardwood shop card opens an inspector showing
that player's figure. The inspector can replay the special move and turn the
figure by dragging. Files are in BballTactics `client/figure3d/`.

### What decides whether 3D spreads further

| Measure | Bar | Result (2026-11-05) |
|---|---|---|
| Added download, loaded only when opened (gzip) | ≤ 200 KB | **130.5 KB** (`FigureStage` chunk: Three.js plus the stage) ✓ |
| Main bundle growth (gzip) | 0 KB | **+1.2 KB** (196.29 vs 195.05 KB): the inspector shell and the 3D button. Three.js isn't in it (no `MeshToonMaterial` in the main chunk). Missed as written |
| Triangles per figure | ≤ 3,000 | **2,518** (a Two-Way); 2,980–3,172 with the ball and hoop ✓ |
| Frame time, desktop Chrome, 1× pixel ratio, 558×510 canvas | p95 ≤ 16.7 ms | **p95 14.2–14.3 ms**, p50 13.3 ms (the display's refresh rate) over 830–1,350 frames per move. ✓ |
| Worst frame | — | 102 ms on the first measure, from compiling shaders on the first frame. With `renderer.compile()` at open: **14.3–23.4 ms** |
| Frame time, recent iPhone (Safari) | p95 ≤ 16.7 ms | **not measured**: needs Brooks's phone |
| Frame time, mid-range Android (Chrome) | p95 ≤ 16.7 ms | **not measured**: needs a device |

The desktop numbers only show the scene isn't heavy. They say little about a
phone: the canvas there is drawn at 2× pixel ratio (four times the pixels) on a
much weaker GPU. The phone rows decide the question.

### What the spike showed, beyond the numbers

- **Works:** all four moves play from the pure curves. Splash goes up in
  profile, the ball rises, hangs, snaps through the rim and sparks; Blur runs in
  low with streaks; The Wall goes up with a hexagon; Glue spins with a floor
  ring. The toon bands, ink outlines and blob shadows read clearly.
- **Additive blending washed the green Glue ring to white** on the light floor;
  the ring now uses normal blending. Additive stays for streaks and sparks over
  the dark background.
- **Not good enough yet:** the figure reads as a mannequin. The limbs are
  separate capsules with visible joints, the face is two dots, and the hands
  are balls. That's the cost of building figures from primitives. The next
  step would be one modelled, low-poly body (a single skinned mesh) on the same
  joint names, so the move curves carry over unchanged.

If the phone numbers pass, the next step is the fight's special-move
close-ups. If they fail, the figures stay 2D, and the useful parts of the spike
(the move curves and the ball arc) move into the Pixi court.

### Measuring on a phone (Brooks, about 5 minutes)

1. In `BballTactics-sprites`, run `npm run dev -- --host` and open the printed
   network URL on the phone (same Wi-Fi).
2. Run It, then press **3D** on any shop card.
3. Add `?fps` to the URL. The inspector then plays the move 10 times and
   prints p50/p95 frame times on screen.
