import React, { useCallback, useMemo, useState } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { BLACK, WHITE, EMPTY, createEmptyBoard, applyMove } from 'src/lib/go/gameLogic'
import { findEyeRegions } from 'src/lib/go/lifeAndDeath'
import InteractiveBoard from './InteractiveBoard'
import { StepCard } from './LessonShell'

function place(board, stones) {
  const next = board.map(r => [...r])
  for (const [r, c, color] of stones) next[r][c] = color
  return next
}

// Demo boards include a small white "boundary" presence so the algorithm
// (Tromp-Taylor) doesn't mark the entire open board as black territory —
// white stones make the open region neutral, leaving only the enclosed
// shape as black-only territory.

function cornerDemoBoard() {
  return place(createEmptyBoard(9), [
    // Black L framing the top-left corner: 7 stones
    [0, 3, BLACK], [1, 3, BLACK], [2, 3, BLACK],
    [3, 0, BLACK], [3, 1, BLACK], [3, 2, BLACK], [3, 3, BLACK],
    // White presence elsewhere → open area is neutral, not "black territory"
    [6, 6, WHITE], [7, 5, WHITE],
  ])
}

function centerDemoBoard() {
  return place(createEmptyBoard(9), [
    // Black box in the center: 8 stones, encloses 1 point at (4,5)
    [3, 4, BLACK], [3, 5, BLACK], [3, 6, BLACK],
    [4, 4, BLACK],                [4, 6, BLACK],
    [5, 4, BLACK], [5, 5, BLACK], [5, 6, BLACK],
    // White stones bound the surrounding open area
    [7, 1, WHITE], [7, 7, WHITE],
  ])
}

// Practice board starts with a single white stone in the bottom-right,
// neutralizing the open area so user-placed corner enclosures actually
// register as territory.
function practiceStartBoard() {
  return place(createEmptyBoard(9), [
    [7, 7, WHITE],
  ])
}

function territoryFor(board, color) {
  const regions = findEyeRegions(board, color)
  return regions.flatMap(r => r.cells)
}

function countEmpty(board) {
  let n = 0
  for (const row of board) for (const v of row) if (v === EMPTY) n++
  return n
}

const PRACTICE_REGION = { rMin: 0, rMax: 4, cMin: 0, cMax: 4 }

export default function StageExpansion({ onAdvance }) {
  const [step, setStep] = useState(0)
  const [practiceBoard, setPracticeBoard] = useState(() => practiceStartBoard())
  const { playPlace } = useGameSounds()

  const enterPractice = useCallback(() => {
    setPracticeBoard(practiceStartBoard())
  }, [])

  const advanceTo = useCallback((next) => {
    setStep(next)
    if (next === 3) enterPractice()
  }, [enterPractice])

  const view = useMemo(() => {
    if (step === 0) {
      const b = cornerDemoBoard()
      const terr = territoryFor(b, BLACK)
      return { board: b, blackTerr: terr, region: null, disabled: true, terrCount: terr.length, stoneCount: 7 }
    }
    if (step === 1) {
      const b = centerDemoBoard()
      const terr = territoryFor(b, BLACK)
      return { board: b, blackTerr: terr, region: null, disabled: true, terrCount: terr.length, stoneCount: 8 }
    }
    if (step === 2) {
      const b = practiceBoard
      const terr = territoryFor(b, BLACK)
      const stoneCount = b.flat().filter(v => v === BLACK).length
      return { board: b, blackTerr: terr, region: PRACTICE_REGION, disabled: false, terrCount: terr.length, stoneCount }
    }
    return { board: createEmptyBoard(9), blackTerr: [], region: null, disabled: true, terrCount: 0, stoneCount: 0 }
  }, [step, practiceBoard])

  const handleClick = useCallback((r, c) => {
    if (step !== 2) return
    if (view.board[r][c] !== EMPTY) return
    const result = applyMove(view.board, r, c, BLACK, null)
    if (result.error) return
    setPracticeBoard(result.newBoard)
    playPlace()
  }, [step, view.board, playPlace])

  const reset = () => setPracticeBoard(practiceStartBoard())

  const steps = [
    {
      title: 'Territory in the corner',
      body: `Empty points fully surrounded by your color are your territory. The 7 black stones along the top-right edge of this corner enclose ${view.terrCount} territory points — that's why corners are the fastest place to make territory.`,
      action: { label: 'Now look at the center →', onClick: () => advanceTo(1) },
    },
    {
      title: 'Same kind of shape, far less territory',
      body: `In the open center, even ${view.stoneCount} stones (one more than the corner used) enclose only ${view.terrCount} point${view.terrCount === 1 ? '' : 's'}. The center has no edges to lean on — territory built there is expensive. Hence the proverb: corners → sides → center.`,
      action: { label: 'Try it yourself →', onClick: () => advanceTo(2) },
    },
    {
      title: 'Build your own corner',
      body: `Place black stones in the top-left corner. The dark dots show your territory in real-time. Try to make a tight enclosure — every interior empty point counts.`,
      progress: `${view.stoneCount} stones · ${view.terrCount} territory`,
      action: view.terrCount > 0
        ? { label: 'Continue', onClick: () => advanceTo(3) }
        : null,
      secondary: view.stoneCount > 0
        ? { label: 'Reset', onClick: reset }
        : null,
    },
    {
      title: 'You\'ve got Expansion',
      body: 'You now know why every game starts in the corners. Real games balance corner moves, side extensions, and influence into the center — but corners come first. Onto Combat next (when it ships).',
      action: { label: 'Back to lessons', onClick: onAdvance },
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
      <div className="flex justify-center">
        <InteractiveBoard
          board={view.board}
          hoverColor={BLACK}
          onCellClick={handleClick}
          blackTerritory={view.blackTerr}
          region={view.region}
          disabled={view.disabled}
        />
      </div>
      <div className="space-y-3">
        <StepCard {...steps[step]} />
        <div className="text-xs text-forest-500 leading-relaxed px-1">
          {step === 0 && `Dark dots = enclosed empty points = your territory. ${view.terrCount} points × 7 stones in the corner.`}
          {step === 1 && `${view.stoneCount} stones in the center yield only ${view.terrCount} territory point${view.terrCount === 1 ? '' : 's'}.`}
          {step === 2 && view.stoneCount === 0 && 'Click anywhere in the dimmed corner area to place a black stone.'}
          {step === 2 && view.stoneCount > 0 && view.terrCount === 0 && 'Keep placing — territory only counts once an empty region is fully enclosed.'}
          {step === 2 && view.terrCount > 0 && `Nice — ${view.terrCount} territory point${view.terrCount === 1 ? '' : 's'} enclosed.`}
        </div>
      </div>
    </div>
  )
}
