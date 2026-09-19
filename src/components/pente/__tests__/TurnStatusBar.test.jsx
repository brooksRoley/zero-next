// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import TurnStatusBar from 'src/components/pente/TurnStatusBar'
import { BLACK, WHITE, RED, BLUE, GAME_MODES } from 'src/lib/pente/constants'

afterEach(() => cleanup())

const baseProps = {
  showLobby: false,
  gameStatus: 'in_progress',
  currentPlayer: BLACK,
  playerName: 'Black',
  botEnabled: false,
  humanColor: BLACK,
  botThinking: false,
  moveCount: 0,
  lastBotStats: null,
  activePlayers: [BLACK, WHITE],
  gameMode: GAME_MODES.classic,
  captures: {},
}

describe('TurnStatusBar', () => {
  it('renders nothing while the lobby is showing', () => {
    const { container } = render(<TurnStatusBar {...baseProps} showLobby />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the game is in an error state', () => {
    const { container } = render(<TurnStatusBar {...baseProps} gameStatus="error" />)
    expect(container.firstChild).toBeNull()
  })

  it("shows the current player's name and turn suffix", () => {
    render(<TurnStatusBar {...baseProps} />)
    expect(screen.getByText(/Black/)).toBeTruthy()
    expect(screen.getByText(/’s turn/)).toBeTruthy()
  })

  it('appends "(Bot)" when the bot is playing this turn', () => {
    render(
      <TurnStatusBar
        {...baseProps}
        botEnabled
        currentPlayer={WHITE}
        playerName="White"
        humanColor={BLACK}
      />
    )
    expect(screen.getByText(/\(Bot\)/)).toBeTruthy()
  })

  it('shows an ellipsis instead of "\'s turn" while the bot is thinking', () => {
    render(<TurnStatusBar {...baseProps} botThinking />)
    expect(screen.getByText(/…/)).toBeTruthy()
    expect(screen.queryByText(/’s turn/)).toBeNull()
  })

  it('shows the move counter once at least one move has been made', () => {
    render(<TurnStatusBar {...baseProps} moveCount={7} />)
    expect(screen.getByText('#7')).toBeTruthy()
  })

  it('does not show a move counter before the first move', () => {
    render(<TurnStatusBar {...baseProps} moveCount={0} />)
    expect(screen.queryByText(/^#\d/)).toBeNull()
  })

  it('shows engine search stats for the bot, abbreviating large node counts', () => {
    render(
      <TurnStatusBar
        {...baseProps}
        botEnabled
        botThinking={false}
        lastBotStats={{ depth: 3, nodes: 4200 }}
      />
    )
    expect(screen.getByText('d3 4.2kn')).toBeTruthy()
  })

  it('renders per-player capture counts against the threshold, keyed by player in non-team modes', () => {
    render(
      <TurnStatusBar
        {...baseProps}
        activePlayers={[BLACK, WHITE]}
        captures={{ [BLACK]: 2, [WHITE]: 1 }}
      />
    )
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getAllByText('/5')).toHaveLength(2)
  })

  it('reads per-team capture counts in team mode, shared across both teammates', () => {
    render(
      <TurnStatusBar
        {...baseProps}
        gameMode={GAME_MODES.team2v2}
        activePlayers={[BLACK, RED, WHITE, BLUE]}
        captures={{ team0: 3, team1: 0 }}
      />
    )
    // team0 = [BLACK, WHITE], so the shared count of 3 is shown once per teammate.
    expect(screen.getAllByText('3')).toHaveLength(2)
    expect(screen.getAllByText('0')).toHaveLength(2)
  })
})
