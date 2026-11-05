// The Hardwood case study on /games/hardwood: how it's built, what was
// measured, how it's played and where the code is. Every line is a fact from
// the BballTactics repo or the bundle in public/hardwood/. The sizes are
// checked against the shipped files by __tests__/hardwoodCase.test.ts, so a
// rebuild that changes them fails until this file is updated.

export const SOURCE = {
  game: 'https://github.com/brooksRoley/BballTactics',
  engine: 'https://github.com/brooksRoley/BballTactics/tree/main/include',
  launcher: 'https://github.com/brooksRoley/BballTactics/tree/main/launcher',
  backend: 'https://github.com/brooksRoley/zero-next/tree/main/src/pages/api/bball',
} as const

export type Layer = { name: string; stack: string; body: string; source: string }

export const LAYERS: Layer[] = [
  {
    name: 'Simulation',
    stack: 'C++17 → WebAssembly (Emscripten, embind)',
    body: 'Movement, shot probability under contest, synergies and the round state machine. The browser calls one game-manager API; no game rule lives in JavaScript.',
    source: SOURCE.engine,
  },
  {
    name: 'Client',
    stack: 'Vue 3 · PixiJS 8 · Vite',
    body: 'Vue owns the shop, the planning board and the menus. PixiJS draws the court each frame from the engine’s state. Drag-and-drop uses pointer events, so the same code serves mouse and touch.',
    source: SOURCE.game,
  },
  {
    name: 'Ghost boards',
    stack: 'Next.js API routes · Postgres',
    body: 'Each round you fight a board another player saved. This site’s /api/bball routes start runs, store boards and hand back an opponent, served same-origin with no CORS in the path.',
    source: SOURCE.backend,
  },
  {
    name: 'Launcher',
    stack: 'Electron · React · TypeScript',
    body: 'A desktop launcher that installs, patches and rolls back the game. Files split on content-defined chunk boundaries, so an edit changes only the chunks it touches. Every chunk is hash-verified and an interrupted update resumes.',
    source: SOURCE.launcher,
  },
]

/** Bytes, raw and gzipped (gzip -9), measured from public/hardwood/ on 2026-11-04 (BballTactics e0813b4). */
export type Measure = { label: string; file: string; raw: number; gzip: number; note: string }

export const BUNDLE: Measure[] = [
  { label: 'C++ engine', file: 'engine.wasm', raw: 236_662, gzip: 87_635, note: 'The whole simulation.' },
  { label: 'Engine glue', file: 'engine.js', raw: 90_681, gzip: 24_389, note: 'Emscripten’s loader and the embind bindings.' },
  { label: 'Game client', file: 'assets/index-BgWkuoK7.js', raw: 551_983, gzip: 187_353, note: 'Vue, PixiJS core and the game UI.' },
  { label: 'WebGL renderer', file: 'assets/WebGLRenderer-BC-rSgr6.js', raw: 72_238, gzip: 19_617, note: 'Split out: loaded only when PixiJS picks WebGL. The WebGPU and Canvas renderers are separate chunks too.' },
]

export const LAUNCHER_UPDATE = {
  changedKB: 16,
  totalMB: 1.07,
  note: 'A one-line change downloads 16 KB of the 1.07 MB build (1.5%), measured on a smoke run of the real game. A forced chunk cut at 4× the average size once turned that into 160 KB; a test now catches it.',
}

export const NOT_MEASURED = 'Frame time on a mid-range phone, and time to first interaction. Those come next.'

export const CONTROLS: [string, string][] = [
  ['Draft and placement', 'Mouse or touch. Drag players between the bench and the 5×5 court.'],
  ['Full Court (5v5 live)', 'Desktop: right-click to move, left-click to pass, Space to shoot, Q W E R for abilities. Phone: tap to move, tap a teammate to pass.'],
  ['Sound', 'Starts muted here. The speaker button in the game turns it on.'],
]

export const kb = (bytes: number) => `${Math.round(bytes / 1000)} KB`
