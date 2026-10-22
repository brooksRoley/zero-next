import { describe, it, expect } from 'vitest'
import { sanitizePlayerFields, PENTE_PLAYER_FIELDS, GO_PLAYER_FIELDS } from 'src/lib/playerFields'

describe('sanitizePlayerFields', () => {
  it('clamps ratings into range instead of storing whatever the browser sends', () => {
    expect(sanitizePlayerFields({ elo: 99999, game_elo: -5 }, PENTE_PLAYER_FIELDS)).toEqual({ elo: 2400, game_elo: 400 })
    expect(sanitizePlayerFields({ go_elo: 1e9 }, GO_PLAYER_FIELDS)).toEqual({ go_elo: 3500 })
  })

  it('drops fields of the wrong type and fields it does not know', () => {
    expect(
      sanitizePlayerFields({ elo: '2400', puzzles_solved: null, is_admin: true, lesson_progress: [1] }, { ...PENTE_PLAYER_FIELDS, ...GO_PLAYER_FIELDS }),
    ).toEqual({})
  })

  it('keeps names short plain text', () => {
    const out = sanitizePlayerFields({ name: '  Ada‮\n  Lovelace' + 'x'.repeat(100) }, PENTE_PLAYER_FIELDS)
    expect(out.name).toMatch(/^Ada Lovelace/)
    expect((out.name as string).length).toBe(40)
  })

  it('caps arrays to their newest entries', () => {
    const history = Array.from({ length: 900 }, (_, i) => i)
    const out = sanitizePlayerFields({ elo_history: history }, PENTE_PLAYER_FIELDS)
    expect(out.elo_history).toHaveLength(500)
    expect((out.elo_history as number[])[499]).toBe(899)
  })

  it('passes a normal sync through unchanged', () => {
    const sync = { name: 'Brooks', elo: 1210, peak_elo: 1250, puzzles_solved: 12, last_solve_date: '2026-10-21', solved_puzzles: ['p1'] }
    expect(sanitizePlayerFields(sync, PENTE_PLAYER_FIELDS)).toEqual(sync)
  })
})
