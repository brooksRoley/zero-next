/**
 * Cloudfall's controls in one place: the keys the page listens for, and the key a player
 * reads beside the well. `controls.test.ts` fails if a key works but isn't listed, or is
 * listed but doesn't work.
 */

export type Action = 'left' | 'right' | 'rotate' | 'rotateBack' | 'soft' | 'hard' | 'hold'

/** Gameplay keys, by `KeyboardEvent.key` lower-cased. */
export const KEYS: Record<string, Action> = {
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
  w: 'rotate',
  arrowup: 'rotate',
  x: 'rotate',
  z: 'rotateBack',
  q: 'rotateBack',
  s: 'soft',
  arrowdown: 'soft',
  ' ': 'hard',
  c: 'hold',
  shift: 'hold',
}

/** Keys that run the game rather than move a piece. Space and Enter also start a new game. */
export const PAUSE_KEYS = ['p', 'escape'] as const
export const RESTART_KEY = 'r'
export const START_KEYS = [' ', 'enter'] as const

export type LegendRow = { keys: string[]; does: string }
export type LegendGroup = { title: string; rows: LegendRow[] }

/** What a key looks like printed on a keycap. */
export function keyCap(key: string): string {
  const caps: Record<string, string> = {
    ' ': 'Space',
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓',
    escape: 'Esc',
    enter: 'Enter',
    shift: 'Shift',
  }
  return caps[key] ?? key.toUpperCase()
}

/** The key printed beside the well for keyboard players. Keys are `KeyboardEvent.key` values. */
export const KEYBOARD_LEGEND: LegendGroup[] = [
  {
    title: 'Play',
    rows: [
      { keys: ['a', 'd', 'arrowleft', 'arrowright'], does: 'Move' },
      { keys: ['w', 'arrowup', 'x'], does: 'Turn' },
      { keys: ['z', 'q'], does: 'Turn back' },
      { keys: ['s', 'arrowdown'], does: 'Fall faster' },
      { keys: [' '], does: 'Drop to bottom' },
      { keys: ['c', 'shift'], does: 'Hold piece' },
    ],
  },
  {
    title: 'Game',
    rows: [
      { keys: [...START_KEYS], does: 'Start' },
      { keys: [...PAUSE_KEYS], does: 'Pause' },
      { keys: [RESTART_KEY], does: 'Start over' },
    ],
  },
]

/** The same key for touch screens, naming the on-screen buttons. */
export const TOUCH_LEGEND: LegendGroup[] = [
  {
    title: 'Play',
    rows: [
      { keys: ['Left', 'Right'], does: 'Move' },
      { keys: ['Turn'], does: 'Rotate' },
      { keys: ['Down'], does: 'Fall faster' },
      { keys: ['Drop'], does: 'Drop to bottom' },
      { keys: ['Hold'], does: 'Save for later' },
    ],
  },
  {
    title: 'Game',
    rows: [
      { keys: ['Pause'], does: 'Pause or start over' },
    ],
  },
]
