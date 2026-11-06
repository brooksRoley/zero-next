# BARREL: design note

A 2D surfing game at `/games/barrel`. The game loop, the physics (Box2D 2.4.1) and the drawing (raw WebGL2) run in a C++20 module compiled to WebAssembly with Emscripten. React supplies the canvas, touch buttons, the conditions panel and the shared game events.

```
native/barrel/src/
  conditions.*   SurfConditions -> WaveParams (game model, clamped)
  wave.*         Gerstner profile + exponential lip fold -> b2ChainShape, every step
  board.*        dynamic b2Body + hydrodynamic force model
  game.*         states, pop-up, scoring, particles; fixed 60 Hz step
  pool_alloc.*   arena + size classes behind b2Alloc/b2Free
  render.*       WebGL2: one shader, stencil-filled water, bitmap-font HUD
  main.cpp       rAF loop + accumulator, input, EMSCRIPTEN_BINDINGS
native/barrel/build.sh        native tests, then emcc -> public/barrel/
src/lib/barrel/               module types + loader, surf mapping, event mapping
src/pages/api/surf/conditions Open-Meteo -> game conditions (free, no key)
```

Rebuild with `native/barrel/build.sh` (needs `emcc`; Box2D is fetched once at a pinned commit). The build stamps a source hash into `src/lib/barrel/buildInfo.ts`, and `build.test.ts` fails if the C++ changed without a rebuild.

## Locked at 60

`requestAnimationFrame` drives `frame()` in `main.cpp`. A time accumulator advances the simulation in fixed 1/60 s steps (at most 8 per frame, so a background tab doesn't come back to a burst of catch-up steps). The renderer draws only on frames that advanced the simulation, so a 120 Hz display still gets 60 frames a second, not repeats. Measured in Chrome on a 120 Hz display over 5 s:
- 60.18 steps/s and 60.18 frames drawn per second;
- frame interval p50 16.7 ms, p99 18.0 ms;
- no frame over 25 ms.

## The wave

**Profile.** Gerstner: `X = a - (Q/k) e sin(ka)`, `Y = A e cos(ka)`, where `e` is a Gaussian envelope so one crest stands on flat water. Points bunch at the crest, which comes out sharp, and spread in the troughs, which come out flat. The test checks crest curvature against more than 10x trough curvature.

**The fold.** Above `foldStart` (0.42 of the height), each vertex moves forward by `curl * L * f(s)`, with `f(s) = (e^(βs) - 1)/(e^β - 1)` and β = 2.6, and the front droops by `D * f^2.5`. Moving the top forward faster than the face beneath it doubles the chain back over itself, and the air under it is the tube. The lip's top surface is rebuilt as an offset of the underside, so the two sides cannot cross. A local loop-cut and respace pass alternates until stable. The native tests sweep 3 breaks × 5 heights × 3 winds plus both directions for 24 s each and assert no self-intersection and no vertex pair within `b2_linearSlop`.

**Rebuilt every step, without allocating.** Box2D copies chain vertices with `b2Alloc` on every `CreateFixture`. The wave rebuilds 60 times a second, so `b2Alloc`/`b2Free` are routed to an 8 MB arena with size-class free lists (`B2_USER_SETTINGS`). After warm-up, every rebuild is a free-list reuse. The native test asserts 0 system mallocs and no arena growth over 3,000 rebuilds, and the browser showed `systemMallocs: 0` after a full wave. Vertex arrays are `std::array` pools.

### Tradeoff: a static body that still carries the board

The wave body is **static**, as the brief asks, and is moved by `SetTransform` each step. The catch: Box2D's contact solver sees a static surface as standing still, so on its own the moving face would not push the board. It would let the board sink into the face and correct the overlap with position fixes. A kinematic body moving at the wave's speed avoids that and was the first version. To keep the body static, `SurfboardController::applyForces` does what that contact would do. Before each step, if the board is on the face, any velocity pointing into the surface, measured relative to the surface's own velocity (`WaveTerrain::surfaceVelocity()`), is removed. Box2D then sees a board already moving away as fast as the face advances.

The two versions were checked against each other with the same bots:

| | kinematic | static |
|---|---|---|
| Pocket-bot wins (out of 10 lines), each break × 1/2/3/4.5/6 m | every cell ≥ 1 except Teahupo'o 1 m (0) | every cell ≥ 1; Teahupo'o 1 m 10, Pipeline 4.5 m 6 |
| Do-nothing players (never pop, or pop and hold no keys) who survived | 6 of 30 waves | 4 of 30 (three at 1 m, which crumble; one Teahupo'o 6 m straight-out) |

`native_test.cpp` (`staticWaveCarries`) asserts that the body is static, that it travels, and that the face lifts the board and pushes it along. Kinematic bodies count as static for CCD anyway, so continuous collision is unchanged: the board is a bullet.

### Tradeoff: one-sided chain

Box2D chains collide from one side. The chain is wound so the normals point out of the water: a board can sit on the face and on top of the lip, and ray casts for "is the lip over my head" only hit from the air. That is why the head check is a ray, not a fixture.

## The board

These forces are applied before each `b2World::Step`:

- **Planing lift** along the surface normal: `½ρ·C·A·v²` on the velocity relative to the water (the water near the crest moves with the orbital current), scaled by immersion and capped at 1 g.
- **Gravity** from Box2D: on a slope, it is what turns height into speed.
- **Drag** opposite to travel: `(c1 + c2|v|)·v`, multiplied by `(1 + 5·bite)`. A carve spikes `bite` to 1 on the press, settles at 0.45 and releases in 80 ms, so a sharp turn costs speed for a moment. The drag never reverses the velocity within a step.
- **Rail lift** while carving: a hydrofoil force along the face that turns momentum up (W) or down (S held), fading once the board already moves that way.
- **Pump** (tap S): an impulse along the face, stronger on steeper slope, with a cooldown and fatigue.

## Rules

Paddling → **pop-up**: S, then W within 0.5 s, while the face is lifting you (0.45–0.95 of crest height, or "caught": low on the face but keeping pace).
- Too early: **wipeout**.
- Too late: **over the falls**.
- Staying down once the wave has you: a **pearl**.

Riding: a ray from the board along the rider's body, 1.65 m standing or 0.9 m crouched. If it meets the wave, the lip has landed on you. Other wipeouts are a rail (board across the face) and landing an air sideways. In the barrel (the wave overhead), the score runs at 80/s instead of 10/s. Exits:
- **Kick out** over the back: score ×1.15.
- **Ride it out** when the wave backs off.

A wipeout costs the break's penalty.

A pocket bot (`native/barrel/test/bot.cpp`) checks that every break from 1 to 6 m has a winning line and that doing nothing loses.

## Conditions

`SetGlobalSurfConditions(height, period, wind, breakType)` is bound with `EMSCRIPTEN_BINDINGS` and assigned to `window` while the game runs.
- Height and period set the size, speed and energy.
- Offshore wind hollows the lip.
- Onshore wind adds chop and crumbles it.
- The break picks a profile:
  - Pipeline: hollow, heavy penalty.
  - Teahupo'o: a face that sucks below sea level, a thick lip.
  - Skeleton Bay: long, fast, with a speed wobble to match.

The page fetches `/api/surf/conditions?spot=` and calls `window.SetGlobalSurfConditions`. That route reads Open-Meteo's marine and wind APIs for three fixed coordinates, takes the offshore component against each spot's offshore bearing, and applies a reef gain to the swell height. It is cached for 30 minutes. When the upstream fails, it serves typical values labeled `typical`.

## What is not measured yet

- Balance: a player who pops up and then goes straight can survive a 6 m Teahupo'o by outrunning it (low score, no tube). That is legal surfing, but worth judging in the playtest.
- No one but the bot has played it. Whether the pop-up window feels fair, and whether a first-time player finds the barrel, needs a 5-minute playtest.
- Player metric to watch: first-session finish rate (`game_end` / `game_start`, slug `barrel`). Baseline: none, since this is a new game.
