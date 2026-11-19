import { describe, expect, it } from 'vitest'
import { KEYBOARD_LEGEND, KEYS, PAUSE_KEYS, RESTART_KEY, START_KEYS, TOUCH_LEGEND, keyCap } from '../controls'

const listed = KEYBOARD_LEGEND.flatMap((g) => g.rows.flatMap((r) => r.keys))

describe('the controls key', () => {
  it('lists every key the game listens for', () => {
    const live = [...Object.keys(KEYS), ...PAUSE_KEYS, RESTART_KEY, ...START_KEYS]
    for (const key of live) expect(listed, `"${key}" works but is not in the key`).toContain(key)
  })

  it('lists no key that does nothing', () => {
    const live = new Set<string>([...Object.keys(KEYS), ...PAUSE_KEYS, RESTART_KEY, ...START_KEYS])
    for (const key of listed) expect(live.has(key), `"${key}" is in the key but does nothing`).toBe(true)
  })

  it('keeps R for restart, free of any gameplay action', () => {
    expect(KEYS[RESTART_KEY]).toBeUndefined()
    expect(KEYS[RESTART_KEY.toUpperCase()]).toBeUndefined()
  })

  it('names the touch pad buttons the page draws', () => {
    const touch = TOUCH_LEGEND.flatMap((g) => g.rows.flatMap((r) => r.keys))
    expect(touch).toEqual(expect.arrayContaining(['Left', 'Right', 'Turn', 'Down', 'Drop', 'Hold', 'Pause']))
  })

  it('prints keys the way a keycap does', () => {
    expect(keyCap(' ')).toBe('Space')
    expect(keyCap('arrowleft')).toBe('←')
    expect(keyCap('escape')).toBe('Esc')
    expect(keyCap('r')).toBe('R')
  })
})
