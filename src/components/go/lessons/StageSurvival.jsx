import React, { useCallback, useMemo, useState } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { BLACK, createEmptyBoard, applyMove } from 'src/lib/go/gameLogic'
import InteractiveBoard from './InteractiveBoard'
import { StepCard } from './LessonShell'

function place(board, stones) {
  const next = board.map(r => [...r])
  for (const [r, c, color] of stones) next[r][c] = color
  return next
}

// One-eye demo: small black ring with a single internal empty point
function oneEyeBoard() {
  return place(createEmptyBoard(9), [
    [1, 2, BLACK], [1, 3, BLACK], [1, 4, BLACK],
    [2, 2, BLACK],                [2, 4, BLACK],
    [3, 2, BLACK], [3, 3, BLACK], [3, 4, BLACK],
  ])
}

// Two-eye demo: longer ring enclosing two separate single-point eyes
function twoEyesBoard() {
  return place(createEmptyBoard(9), [
    [1, 2, BLACK], [1, 3, BLACK], [1, 4, BLACK], [1, 5, BLACK], [1, 6, BLACK],
    [2, 2, BLACK],                [2, 4, BLACK],                [2, 6, BLACK],
    [3, 2, BLACK], [3, 3, BLACK], [3, 4, BLACK], [3, 5, BLACK], [3, 6, BLACK],
  ])
}

// Vital-point puzzle: black has three internal points in a row.
// Black plays the middle (2,4) → splits into two single-point eyes → alive.
// Any other move leaves one eye-region (or none) → dead.
function vitalPointBoard() {
  return place(createEmptyBoard(9), [
    [1, 2, BLACK], [1, 3, BLACK], [1, 4, BLACK], [1, 5, BLACK], [1, 6, BLACK],
    [2, 2, BLACK],                                              [2, 6, BLACK],
    [3, 2, BLACK], [3, 3, BLACK], [3, 4, BLACK], [3, 5, BLACK], [3, 6, BLACK],
  ])
}

const VITAL_POINT = [2, 4]
const VITAL_REGION = { rMin: 2, rMax: 2, cMin: 3, cMax: 5 }

// Eye locations are hardcoded per demo. Algorithmic eye detection over a
// mostly-empty board treats all open space as "enclosed by black" (which is
// correct under Tromp-Taylor, but useless for teaching). Demo positions
// always have known eye points, so we just label them directly.
const ONE_EYE_LOCATIONS = [[2, 3]]
const TWO_EYE_LOCATIONS = [[2, 3], [2, 5]]
const VITAL_INTERNAL_POINTS = [[2, 3], [2, 4], [2, 5]]
const VITAL_SOLVED_EYES = [[2, 3], [2, 5]]

export default function StageSurvival({ onAdvance }) {
  const [step, setStep] = useState(0)
  const [practiceBoard, setPracticeBoard] = useState(null)
  const [practiceSolved, setPracticeSolved] = useState(false)
  const [practiceWrong, setPracticeWrong] = useState(false)
  const { playPlace, playCapture } = useGameSounds()

  const enterPractice = useCallback(() => {
    setPracticeBoard(vitalPointBoard())
    setPracticeSolved(false)
    setPracticeWrong(false)
  }, [])

  const advanceTo = useCallback((next) => {
    setStep(next)
    setPracticeBoard(null)
    setPracticeSolved(false)
    setPracticeWrong(false)
    if (next === 3) enterPractice()
  }, [enterPractice])

  const view = useMemo(() => {
    if (step === 0) {
      return { board: oneEyeBoard(), eyes: ONE_EYE_LOCATIONS, region: null, disabled: true, atari: [] }
    }
    if (step === 1) {
      return { board: twoEyesBoard(), eyes: TWO_EYE_LOCATIONS, region: null, disabled: true, atari: [] }
    }
    if (step === 2) {
      return { board: oneEyeBoard(), eyes: ONE_EYE_LOCATIONS, region: null, disabled: true, atari: [] }
    }
    if (step === 3) {
      const b = practiceBoard || vitalPointBoard()
      if (practiceSolved) {
        return { board: b, eyes: VITAL_SOLVED_EYES, region: null, disabled: true, atari: [] }
      }
      return {
        board: b,
        eyes: VITAL_INTERNAL_POINTS,
        region: VITAL_REGION,
        disabled: false,
        atari: [VITAL_POINT],
      }
    }
    return { board: createEmptyBoard(9), eyes: [], region: null, disabled: true, atari: [] }
  }, [step, practiceBoard, practiceSolved])

  const handleClick = useCallback((r, c) => {
    if (step !== 3 || practiceSolved) return
    const isVital = r === VITAL_POINT[0] && c === VITAL_POINT[1]
    if (!isVital) {
      setPracticeWrong(true)
      setTimeout(() => setPracticeWrong(false), 1100)
      return
    }
    const result = applyMove(view.board, r, c, BLACK, null)
    if (result.error) return
    setPracticeBoard(result.newBoard)
    setPracticeSolved(true)
    playPlace()
    if (result.captured.length > 0) setTimeout(() => playCapture(), 80)
  }, [step, practiceSolved, view.board, playPlace, playCapture])

  const steps = [
    {
      title: 'What is an eye?',
      body: 'An eye is an empty point fully enclosed by your stones. The black ring here contains one — the green ring marks it. The eye is a liberty that the opponent can\'t fill safely (filling it would be suicide unless it captures).',
      action: { label: 'Got it →', onClick: () => advanceTo(1) },
    },
    {
      title: 'Two eyes = alive',
      body: 'A group with two separate eyes is unconditionally alive. The opponent can\'t fill both eyes in one move, and either eye on its own is unfillable. This group lives forever.',
      action: { label: 'Got it →', onClick: () => advanceTo(2) },
    },
    {
      title: 'One eye dies',
      body: 'One eye isn\'t enough. The opponent fills the outside liberties one by one until your group is in atari with the eye as its only liberty. Then they play into the eye — capturing your group on the way in.',
      action: { label: 'Try the vital point →', onClick: () => advanceTo(3) },
    },
    practiceSolved ? {
      title: 'Two eyes — alive!',
      body: 'Playing the middle of three internal points splits the empty region into two single-point eyes. This group is now alive. The same shape played anywhere else stays as one eye — and dies.',
      action: { label: 'Continue', onClick: onAdvance },
    } : {
      title: 'Vital point puzzle',
      body: practiceWrong
        ? 'That move leaves the inside as one connected region — still only one eye. Try again. The vital point is the middle of the three.'
        : 'Black to play. Three empty points in a row inside the group. Find the move that splits them into two separate eyes.',
      progress: practiceWrong ? '0 / 1' : null,
    },
    {
      title: 'You\'ve got Survival',
      body: 'You can now spot eyes, recognize when a group is alive (two eyes) or dead (one), and find the vital point that decides. Onto territory.',
      action: { label: 'Continue', onClick: onAdvance },
    },
  ]

  // Steps 3 (puzzle) and 4 (done) share index — when solved, jump to 4.
  const renderedStep = step === 3 ? steps[3] : steps[step]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <div className="flex justify-center">
        <InteractiveBoard
          board={view.board}
          hoverColor={BLACK}
          onCellClick={handleClick}
          eyes={view.eyes}
          atariCells={view.atari}
          region={view.region}
          disabled={view.disabled}
        />
      </div>
      <div className="space-y-3">
        <StepCard {...renderedStep} />
        <div className="text-xs text-forest-500 leading-relaxed px-1">
          {step <= 1 && 'Green rings mark eyes — empty points enclosed by one color.'}
          {step === 2 && 'A group with one eye loses to outside-then-inside attack.'}
          {step === 3 && !practiceSolved && 'Red dot marks the vital point — click it.'}
          {step === 3 && practiceSolved && 'Two green rings: two eyes. Group alive.'}
        </div>
      </div>
    </div>
  )
}
