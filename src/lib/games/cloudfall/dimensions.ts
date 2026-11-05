// Every size in Cloudfall, in one place. The engine owns the grid (10 × 20
// visible); this file owns how big that grid is on a screen. The full game at
// /games/cloudfall and the backstage overlay in the Theater both read from it.

import { COLS, VISIBLE_ROWS } from './engine'

/** Smallest and largest square, in CSS px. Under 14 a piece is hard to read; over 32 the well stops fitting a laptop. */
export const CELL_MIN = 14
export const CELL_MAX = 32
/** The cell used before the first measurement (server render). */
export const CELL_DEFAULT = 26

/** The site nav's height. */
export const NAV_H = 64
/** Width at which the side panels sit beside the well instead of above and below it. */
export const WIDE_MIN_W = 1024
/** Height kept free for chrome below the nav: the instruction line on wide screens; title, score bar and touch pad on phones. */
export const RESERVED_H = { wide: 110, narrow: 270 } as const
/** Side gutter on phones (16 px each side). */
export const GUTTER_W = 32

/** The well's border, drawn outside the cells (3 px each side). */
export const WELL_FRAME = 6

/** Width ÷ height of the visible well: 0.5. */
export const WELL_ASPECT = COLS / VISIBLE_ROWS

/** Preview canvases (hold and next), [width, height] in CSS px. */
export const PREVIEW = {
  bar: [44, 26],
  hold: [96, 52],
  next: [120, 60],
} as const satisfies Record<string, readonly [number, number]>

export function isWide(viewportW: number): boolean {
  return viewportW >= WIDE_MIN_W
}

/** The largest whole-pixel cell that fits the well and its chrome in the viewport, within CELL_MIN–CELL_MAX. */
export function fitCell(viewportW: number, viewportH: number): number {
  const wide = isWide(viewportW)
  const fromH = (viewportH - NAV_H - (wide ? RESERVED_H.wide : RESERVED_H.narrow)) / VISIBLE_ROWS
  const fromW = wide ? CELL_MAX : (viewportW - GUTTER_W) / COLS
  return Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(fromH, fromW))))
}

/** The well in CSS px: the cells alone, and with the frame around them. */
export function wellSize(cell: number): { w: number; h: number; framedW: number; framedH: number } {
  const w = COLS * cell
  const h = VISIBLE_ROWS * cell
  return { w, h, framedW: w + WELL_FRAME, framedH: h + WELL_FRAME }
}
