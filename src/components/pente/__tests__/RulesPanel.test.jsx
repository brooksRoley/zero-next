// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RulesPanel from 'src/components/pente/RulesPanel'
import { GAME_MODES } from 'src/lib/pente/constants'

afterEach(() => cleanup())

describe('RulesPanel', () => {
  it('falls back to the generic ruleset when no game mode is given', () => {
    render(<RulesPanel gameMode={null} />)
    expect(screen.getByText(/five-in-a-row/)).toBeTruthy()
    expect(
      screen.getByText('Bracket exactly two opponent stones with yours in a straight line.')
    ).toBeTruthy()
  })

  it('shows the pro rule for classic mode (and when no mode is set)', () => {
    render(<RulesPanel gameMode={GAME_MODES.classic} />)
    expect(screen.getByText(/Pro rule:/)).toBeTruthy()
  })

  it('hides the pro rule and shows mode-specific capture text for FFA', () => {
    render(<RulesPanel gameMode={GAME_MODES.ffa4} />)
    expect(screen.queryByText(/Pro rule:/)).toBeNull()
    expect(screen.getByText('Free-for-All (4 Players)')).toBeTruthy()
    expect(screen.getByText(/capture any opponent's pair/)).toBeTruthy()
  })

  it('shows the team composition and shared-capture note for team modes', () => {
    render(<RulesPanel gameMode={GAME_MODES.team2v2} />)
    expect(screen.getByText(/Teams:/)).toBeTruthy()
    expect(screen.getByText(/Black \+ White vs Red \+ Blue\./)).toBeTruthy()
    expect(screen.getByText(/teammate stones don.t count/)).toBeTruthy()
  })
})
