// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GameOverDrawer from 'src/components/pente/GameOverDrawer'
import { BLACK, WHITE, GAME_MODES } from 'src/lib/pente/constants'

vi.mock('src/lib/analytics', () => ({ track: vi.fn() }))
import { track } from 'src/lib/analytics'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const baseProps = {
  gameOver: true,
  isOnline: false,
  winner: BLACK,
  gameMode: GAME_MODES.classic,
  resetLocalBoard: vi.fn(),
  moveHistory: [],
  gameAnalysis: null,
  handleAnalyze: vi.fn(),
  analysisViewTurn: null,
  setAnalysisViewTurn: vi.fn(),
  consultingCtaDismissed: false,
  setConsultingCtaDismissed: vi.fn(),
  botEnabled: false,
  humanColor: BLACK,
}

describe('GameOverDrawer', () => {
  it('renders nothing when the game is not over', () => {
    const { container } = render(<GameOverDrawer {...baseProps} gameOver={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for online games (multiplayer has its own end-of-game UI)', () => {
    const { container } = render(<GameOverDrawer {...baseProps} isOnline />)
    expect(container.firstChild).toBeNull()
  })

  it('announces the winner and, in team mode, which team won', () => {
    render(<GameOverDrawer {...baseProps} gameMode={GAME_MODES.team2v2} winner={WHITE} />)
    expect(screen.getByText(/White Wins!/)).toBeTruthy()
    expect(screen.getByText(/Team 1/)).toBeTruthy()
  })

  it('calls resetLocalBoard when "Play Again" is clicked', () => {
    const resetLocalBoard = vi.fn()
    render(<GameOverDrawer {...baseProps} resetLocalBoard={resetLocalBoard} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }))
    expect(resetLocalBoard).toHaveBeenCalledTimes(1)
  })

  it('offers Analyze only for classic games with move history and no analysis yet', () => {
    const { rerender } = render(
      <GameOverDrawer {...baseProps} moveHistory={[{ moveMadeBy: BLACK }]} />
    )
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeTruthy()

    rerender(
      <GameOverDrawer
        {...baseProps}
        moveHistory={[{ moveMadeBy: BLACK }]}
        gameMode={GAME_MODES.ffa4}
      />
    )
    expect(screen.queryByRole('button', { name: 'Analyze' })).toBeNull()
  })

  it('calls handleAnalyze when Analyze is clicked', () => {
    const handleAnalyze = vi.fn()
    render(
      <GameOverDrawer
        {...baseProps}
        moveHistory={[{ moveMadeBy: BLACK }]}
        handleAnalyze={handleAnalyze}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
    expect(handleAnalyze).toHaveBeenCalledTimes(1)
  })

  it('renders each analysis entry and toggles the viewed turn on click', () => {
    const setAnalysisViewTurn = vi.fn()
    const moveHistory = [{ moveMadeBy: BLACK }, { moveMadeBy: WHITE }]
    const gameAnalysis = [
      { annotation: 'Good move', evaluation: 1200 },
      { annotation: 'Blunder', evaluation: -3400 },
    ]
    render(
      <GameOverDrawer
        {...baseProps}
        moveHistory={moveHistory}
        gameAnalysis={gameAnalysis}
        setAnalysisViewTurn={setAnalysisViewTurn}
      />
    )
    expect(screen.getByText('Good move')).toBeTruthy()
    expect(screen.getByText('Blunder')).toBeTruthy()
    fireEvent.click(screen.getByText('Blunder'))
    expect(setAnalysisViewTurn).toHaveBeenCalledWith(1)
  })

  it('shows a "back to final" control while viewing a specific analyzed turn', () => {
    const setAnalysisViewTurn = vi.fn()
    render(
      <GameOverDrawer
        {...baseProps}
        moveHistory={[{ moveMadeBy: BLACK }]}
        gameAnalysis={[{ annotation: 'Good move', evaluation: 100 }]}
        analysisViewTurn={0}
        setAnalysisViewTurn={setAnalysisViewTurn}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Back to final' }))
    expect(setAnalysisViewTurn).toHaveBeenCalledWith(null)
  })

  it('shows the consulting CTA and fires a tracked "consulting_from_game" event on click', () => {
    render(<GameOverDrawer {...baseProps} winner={BLACK} humanColor={BLACK} botEnabled />)
    const link = screen.getByRole('link', { name: 'Work with me →' })
    fireEvent.click(link)
    expect(track).toHaveBeenCalledWith(
      'consulting_from_game',
      expect.objectContaining({ metadata: expect.objectContaining({ result: 'win' }) })
    )
  })

  it('dismisses the consulting CTA when its close button is clicked', () => {
    const setConsultingCtaDismissed = vi.fn()
    render(
      <GameOverDrawer {...baseProps} setConsultingCtaDismissed={setConsultingCtaDismissed} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(setConsultingCtaDismissed).toHaveBeenCalledWith(true)
  })

  it('hides the consulting CTA once dismissed', () => {
    render(<GameOverDrawer {...baseProps} consultingCtaDismissed />)
    expect(screen.queryByRole('link', { name: 'Work with me →' })).toBeNull()
  })
})
