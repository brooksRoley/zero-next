import React, { useCallback, useEffect, useState } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { EMPTY, BLACK, WHITE, createEmptyBoard } from 'src/lib/go/gameLogic'
import InteractiveBoard from './InteractiveBoard'
import { StepCard } from './LessonShell'

const TARGET_STONES = 5

export default function StageVoid({ onAdvance }) {
  const [board, setBoard] = useState(() => createEmptyBoard(9))
  const [color, setColor] = useState(BLACK)
  const [stonesPlaced, setStonesPlaced] = useState(0)
  const [step, setStep] = useState(0)
  const { playPlace } = useGameSounds()

  const handleClick = useCallback((r, c) => {
    if (board[r][c] !== EMPTY) return
    const next = board.map(row => [...row])
    next[r][c] = color
    setBoard(next)
    setColor(color === BLACK ? WHITE : BLACK)
    setStonesPlaced(n => n + 1)
    playPlace()
  }, [board, color, playPlace])

  useEffect(() => {
    if (step === 1 && stonesPlaced >= TARGET_STONES) setStep(2)
  }, [step, stonesPlaced])

  const reset = () => {
    setBoard(createEmptyBoard(9))
    setColor(BLACK)
    setStonesPlaced(0)
    setStep(1)
  }

  const steps = [
    {
      title: 'The board',
      body: 'A Go board is a grid of 9, 13, or 19 lines each way. We’ll learn on a 9×9. Stones are placed at the intersections of lines — not in the squares like chess. Black plays first; players alternate.',
      action: { label: 'Try it →', onClick: () => setStep(1) },
    },
    {
      title: 'Place some stones',
      body: 'Click any intersection to place a stone. Each click switches color. Place 5 stones to get a feel for the rhythm.',
      progress: `${Math.min(stonesPlaced, TARGET_STONES)} / ${TARGET_STONES}`,
    },
    {
      title: 'You’ve got the input',
      body: 'That’s the entire physical layer of Go: stones on intersections, alternating colors. Stones never move once placed (with one exception you’ll meet next stage). Onto liberties — where the actual game begins.',
      action: { label: 'Continue', onClick: onAdvance },
      secondary: { label: 'Reset board', onClick: reset },
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <div className="flex justify-center">
        <InteractiveBoard
          board={board}
          hoverColor={color}
          onCellClick={handleClick}
          disabled={step === 0}
        />
      </div>
      <div className="space-y-3">
        <StepCard {...steps[step]} />
        <div className="text-xs text-forest-500 leading-relaxed px-1">
          Tip: there’s no &ldquo;wrong&rdquo; spot in this stage. The board accepts any move. The rules start arriving next stage.
        </div>
      </div>
    </div>
  )
}
