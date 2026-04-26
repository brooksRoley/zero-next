import React, { useCallback, useMemo, useState } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { EMPTY, BLACK, WHITE, createEmptyBoard, applyMove } from 'src/lib/go/gameLogic'
import { libertiesOf, allLibertiesOfColor } from 'src/lib/go/highlights'
import InteractiveBoard from './InteractiveBoard'
import { StepCard } from './LessonShell'

function place(board, stones) {
  const next = board.map(r => [...r])
  for (const [r, c, color] of stones) next[r][c] = color
  return next
}

function singleStoneBoard() {
  return place(createEmptyBoard(9), [[4, 4, BLACK]])
}

function groupBoard() {
  return place(createEmptyBoard(9), [[3, 4, BLACK], [4, 4, BLACK]])
}

function atariBoard() {
  return place(createEmptyBoard(9), [
    [3, 4, BLACK], [5, 4, BLACK], [4, 3, BLACK],
    [4, 4, WHITE],
  ])
}

function groupAtariBoard() {
  return place(createEmptyBoard(9), [
    [2, 4, BLACK], [2, 5, BLACK],
    [4, 4, BLACK], [4, 5, BLACK],
    [3, 3, BLACK],
    [3, 4, WHITE], [3, 5, WHITE],
  ])
}

export default function StageBreath({ onAdvance }) {
  const [step, setStep] = useState(0)
  const { playPlace, playCapture } = useGameSounds()

  // For practice steps we let the user mutate the board; demos are static.
  const [practiceBoard, setPracticeBoard] = useState(null)
  const [practiceCaptured, setPracticeCaptured] = useState(false)

  const enterPractice = useCallback((boardFactory) => {
    setPracticeBoard(boardFactory())
    setPracticeCaptured(false)
  }, [])

  const advanceTo = useCallback((next) => {
    setStep(next)
    setPracticeBoard(null)
    setPracticeCaptured(false)
    if (next === 2) enterPractice(atariBoard)
    if (next === 3) enterPractice(groupAtariBoard)
  }, [enterPractice])

  // Compute the visible board + highlights based on the current step.
  const view = useMemo(() => {
    if (step === 0) {
      const b = singleStoneBoard()
      return { board: b, liberties: libertiesOf(b, 4, 4), atari: [], region: null, disabled: true }
    }
    if (step === 1) {
      const b = groupBoard()
      return { board: b, liberties: allLibertiesOfColor(b, BLACK), atari: [], region: null, disabled: true }
    }
    if (step === 2) {
      const b = practiceBoard || atariBoard()
      const targetLib = practiceCaptured ? [] : libertiesOf(b, 4, 4)
      const region = practiceCaptured || targetLib.length === 0
        ? null
        : { rMin: targetLib[0][0], rMax: targetLib[0][0], cMin: targetLib[0][1], cMax: targetLib[0][1] }
      return { board: b, liberties: [], atari: targetLib, region, disabled: practiceCaptured }
    }
    if (step === 3) {
      const b = practiceBoard || groupAtariBoard()
      const targetLib = practiceCaptured ? [] : libertiesOf(b, 3, 4)
      const region = practiceCaptured || targetLib.length === 0
        ? null
        : { rMin: targetLib[0][0], rMax: targetLib[0][0], cMin: targetLib[0][1], cMax: targetLib[0][1] }
      return { board: b, liberties: [], atari: targetLib, region, disabled: practiceCaptured }
    }
    return { board: createEmptyBoard(9), liberties: [], atari: [], region: null, disabled: true }
  }, [step, practiceBoard, practiceCaptured])

  const handleClick = useCallback((r, c) => {
    if (step !== 2 && step !== 3) return
    const result = applyMove(view.board, r, c, BLACK, null)
    if (result.error) return
    setPracticeBoard(result.newBoard)
    playPlace()
    if (result.captured.length > 0) {
      setTimeout(() => playCapture(), 60)
      setPracticeCaptured(true)
    }
  }, [step, view.board, playPlace, playCapture])

  const steps = [
    {
      title: 'Liberties',
      body: 'Every stone has liberties — the empty points orthogonally adjacent to it (up, down, left, right; never diagonal). The lone stone here has 4 liberties, glowing cyan.',
      action: { label: 'Got it →', onClick: () => advanceTo(1) },
    },
    {
      title: 'Groups share liberties',
      body: 'Stones of the same color that touch are a single group. They share their liberties. This 2-stone group has 6 liberties between them — losing all 6 means losing both stones.',
      action: { label: 'Got it →', onClick: () => advanceTo(2) },
    },
    {
      title: 'Atari — one liberty left',
      body: practiceCaptured
        ? 'Captured! When a group has zero liberties, it’s removed from the board. That’s the only way stones leave the board in Go.'
        : 'When a group has exactly one liberty, it’s in atari — one move from death. The white stone has one liberty (red dot). Play there to capture it.',
      action: practiceCaptured
        ? { label: 'Try a group capture →', onClick: () => advanceTo(3) }
        : null,
    },
    {
      title: 'Capture a whole group',
      body: practiceCaptured
        ? 'Both white stones gone. A group of any size dies the same way — fill its last liberty.'
        : 'Two white stones, one shared liberty (red dot). One move captures them both.',
      action: practiceCaptured
        ? { label: 'Continue', onClick: () => advanceTo(4) }
        : null,
    },
    {
      title: 'You’ve got Breath',
      body: 'You can now spot liberties, recognize atari, and capture stones — alone or in groups. The next stages aren’t live yet; they’ll cover Survival (life and death), Expansion (territory), Combat (ladders), and Flow (ko & sente).',
      action: { label: 'Done — back to lessons', onClick: onAdvance },
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <div className="flex justify-center">
        <InteractiveBoard
          board={view.board}
          hoverColor={BLACK}
          onCellClick={handleClick}
          liberties={view.liberties}
          atariCells={view.atari}
          region={view.region}
          disabled={view.disabled}
        />
      </div>
      <div className="space-y-3">
        <StepCard {...steps[step]} />
        <div className="text-xs text-forest-500 leading-relaxed px-1">
          {step <= 1 && 'Cyan dots show liberties — the empty points keeping a group alive.'}
          {step >= 2 && step <= 3 && 'Red dot = the last liberty. Play there to capture.'}
        </div>
      </div>
    </div>
  )
}
