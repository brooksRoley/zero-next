import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { BLACK, applyMove } from 'src/lib/go/gameLogic'
import { isPuzzleSolvedOnBoard } from 'src/lib/go/puzzles'
import { GoBotWorkerManager } from 'src/lib/go/botWorker'
import InteractiveBoard from 'src/components/go/lessons/InteractiveBoard'

const STATUS = {
  IDLE: 'idle',
  THINKING: 'thinking',
  SOLVED: 'solved',
  HINTED: 'hinted',
  FAILED: 'failed',
  WRONG: 'wrong',
}

// How many off-mainline turn pairs we let the user attempt before giving up.
const OFF_MAINLINE_BUDGET = 5

/**
 * Plays a single tsumego. Two paths:
 *
 *  1. **Main line** — user's move matches the SGF's expected next move.
 *     Step advances; mainline opponent moves auto-play. Mainline complete →
 *     solved.
 *
 *  2. **Off line** — user plays a legal but non-mainline move. The Web Worker
 *     engine plays a defensive response (extends the target group / captures
 *     attackers). User can keep trying — if the target eventually dies,
 *     puzzle counts as solved (alternative line). If the budget runs out,
 *     puzzle fails.
 */
export default function PuzzleBoard({ puzzle, onAttempt }) {
  const [board, setBoard] = useState(puzzle.initialBoard)
  const [step, setStep] = useState(0)
  const [koPoint, setKoPoint] = useState(null)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [offMainline, setOffMainline] = useState(false)
  const [offMainlineTurns, setOffMainlineTurns] = useState(0)
  const [engineNote, setEngineNote] = useState(null)

  const boardWrapRef = useRef(null)
  const workerRef = useRef(null)
  const { playPlace, playCapture } = useGameSounds()

  useEffect(() => {
    workerRef.current = new GoBotWorkerManager()
    return () => { workerRef.current?.terminate() }
  }, [])

  // Reset whenever we navigate to a different puzzle
  useEffect(() => {
    setBoard(puzzle.initialBoard)
    setStep(0)
    setKoPoint(null)
    setStatus(STATUS.IDLE)
    setOffMainline(false)
    setOffMainlineTurns(0)
    setEngineNote(null)
  }, [puzzle.id, puzzle.initialBoard])

  const userColor = puzzle.toMove
  const oppColor = userColor === BLACK ? 2 : 1
  const expectedNext = puzzle.mainline[step] || null
  const awaitingUser = (status === STATUS.IDLE || status === STATUS.WRONG) &&
    (offMainline || (expectedNext && expectedNext.color === userColor))

  const triggerShake = useCallback(() => {
    const el = boardWrapRef.current?.querySelector('.go-board')
    if (!el) return
    el.classList.remove('board-shake')
    void el.offsetWidth
    el.classList.add('board-shake')
  }, [])

  // Apply mainline forward from a given board/step until we either reach
  // the user's turn again or run out of moves. Returns the resulting state.
  const advanceMainline = useCallback((startBoard, startKo, startStep) => {
    let b = startBoard
    let ko = startKo
    let s = startStep
    let captured = 0
    while (s < puzzle.mainline.length) {
      const m = puzzle.mainline[s]
      if (m.move === 'pass') { s++; continue }
      const r = applyMove(b, m.move[0], m.move[1], m.color, ko)
      if (r.error) break
      b = r.newBoard
      ko = r.nextKoPoint
      captured += r.captured.length
      s++
      if (m.color !== userColor) continue
      break
    }
    return { board: b, koPoint: ko, step: s, captured }
  }, [puzzle.mainline, userColor])

  const handleClick = useCallback(async (row, col) => {
    if (!awaitingUser) return

    // Mainline path: only valid when we still have a mainline expectation
    if (!offMainline && expectedNext && expectedNext.move !== 'pass') {
      const [er, ec] = expectedNext.move
      if (row === er && col === ec) {
        const userResult = applyMove(board, row, col, userColor, koPoint)
        if (userResult.error) {
          setStatus(STATUS.WRONG)
          triggerShake()
          setTimeout(() => setStatus(STATUS.IDLE), 800)
          return
        }
        playPlace()
        if (userResult.captured.length > 0) setTimeout(() => playCapture(), 60)

        const after = advanceMainline(userResult.newBoard, userResult.nextKoPoint, step + 1)
        setBoard(after.board)
        setKoPoint(after.koPoint)
        setStep(after.step)
        if (after.captured > 0) setTimeout(() => playCapture(), 120)
        if (after.step >= puzzle.mainline.length) {
          setStatus(STATUS.SOLVED)
          if (onAttempt) onAttempt({ solved: true, usedHint: false, viaMainline: true })
        }
        return
      }
    }

    // Off-mainline (or no remaining mainline): legal-move engine exchange.
    const userResult = applyMove(board, row, col, userColor, koPoint)
    if (userResult.error) {
      setStatus(STATUS.WRONG)
      triggerShake()
      setTimeout(() => setStatus(STATUS.IDLE), 800)
      return
    }

    playPlace()
    if (userResult.captured.length > 0) setTimeout(() => playCapture(), 60)

    setOffMainline(true)

    if (isPuzzleSolvedOnBoard(userResult.newBoard, puzzle.targetStones)) {
      setBoard(userResult.newBoard)
      setKoPoint(userResult.nextKoPoint)
      setStatus(STATUS.SOLVED)
      setEngineNote('Different from the main line, but it works.')
      if (onAttempt) onAttempt({ solved: true, usedHint: false, viaMainline: false })
      return
    }

    // Engine response
    setBoard(userResult.newBoard)
    setKoPoint(userResult.nextKoPoint)
    setStatus(STATUS.THINKING)

    const resp = await workerRef.current.findResponse(
      userResult.newBoard,
      oppColor,
      { targetStones: puzzle.targetStones },
      userResult.nextKoPoint,
    )

    let nextBoard = userResult.newBoard
    let nextKo = userResult.nextKoPoint
    if (resp && resp.move) {
      const eng = applyMove(userResult.newBoard, resp.move[0], resp.move[1], oppColor, userResult.nextKoPoint)
      if (!eng.error) {
        nextBoard = eng.newBoard
        nextKo = eng.nextKoPoint
        setTimeout(() => playPlace(), 80)
        if (eng.captured.length > 0) setTimeout(() => playCapture(), 140)
      }
    }
    setBoard(nextBoard)
    setKoPoint(nextKo)

    const turnsAfter = offMainlineTurns + 1
    setOffMainlineTurns(turnsAfter)

    if (isPuzzleSolvedOnBoard(nextBoard, puzzle.targetStones)) {
      setStatus(STATUS.SOLVED)
      setEngineNote('You captured off the main line.')
      if (onAttempt) onAttempt({ solved: true, usedHint: false, viaMainline: false })
      return
    }

    if (turnsAfter >= OFF_MAINLINE_BUDGET) {
      setStatus(STATUS.FAILED)
      setEngineNote(`Out of attempts (${OFF_MAINLINE_BUDGET}). Reset and try the main line, or peek at the solution.`)
      if (onAttempt) onAttempt({ solved: false, usedHint: false, viaMainline: false })
      return
    }

    setStatus(STATUS.IDLE)
    setEngineNote(`Off the main line — engine ${resp?.reason === 'extend' ? 'extended its group' : resp?.reason === 'capture' ? 'captured a stone' : 'responded'}. ${OFF_MAINLINE_BUDGET - turnsAfter} attempts left.`)
  }, [
    awaitingUser, offMainline, expectedNext, board, koPoint, userColor, oppColor,
    step, advanceMainline, puzzle.mainline.length, puzzle.targetStones,
    onAttempt, playPlace, playCapture, triggerShake, offMainlineTurns,
  ])

  const handleReset = useCallback(() => {
    setBoard(puzzle.initialBoard)
    setStep(0)
    setKoPoint(null)
    setStatus(STATUS.IDLE)
    setOffMainline(false)
    setOffMainlineTurns(0)
    setEngineNote(null)
  }, [puzzle.initialBoard])

  const handleShowSolution = useCallback(() => {
    if (status === STATUS.SOLVED || status === STATUS.HINTED) return
    const after = advanceMainline(puzzle.initialBoard, null, 0)
    setBoard(after.board)
    setKoPoint(after.koPoint)
    setStep(after.step)
    setStatus(STATUS.HINTED)
    setOffMainline(false)
    setOffMainlineTurns(0)
    setEngineNote(null)
    playPlace()
    if (after.captured > 0) setTimeout(() => playCapture(), 80)
    if (onAttempt) onAttempt({ solved: true, usedHint: true, viaMainline: true })
  }, [puzzle.initialBoard, advanceMainline, status, playPlace, playCapture, onAttempt])

  const banner = useMemo(() => {
    if (status === STATUS.SOLVED)   return { tone: 'success', text: 'Solved.' }
    if (status === STATUS.HINTED)   return { tone: 'neutral', text: 'Solution shown — try the next one fresh.' }
    if (status === STATUS.FAILED)   return { tone: 'error',   text: 'Couldn’t capture in time.' }
    if (status === STATUS.WRONG)    return { tone: 'error',   text: 'Illegal move.' }
    if (status === STATUS.THINKING) return { tone: 'neutral', text: 'Engine thinking…' }
    return null
  }, [status])

  return (
    <div ref={boardWrapRef} className="flex flex-col items-center gap-3">
      {banner && (
        <div className={`w-full max-w-md text-center text-sm rounded-md px-3 py-1.5 border ${
          banner.tone === 'success' ? 'bg-green-900/30 border-green-500/40 text-green-200'
          : banner.tone === 'error' ? 'bg-red-900/30 border-red-500/40 text-red-200'
          : 'bg-forest-800/60 border-forest-600/50 text-forest-200'
        }`}>
          {banner.text}
        </div>
      )}
      {engineNote && status !== STATUS.THINKING && (
        <div className="w-full max-w-md text-center text-xs text-forest-400">
          {engineNote}
        </div>
      )}

      <InteractiveBoard
        board={board}
        hoverColor={awaitingUser ? userColor : BLACK}
        onCellClick={handleClick}
        region={awaitingUser && !offMainline ? puzzle.region : null}
        disabled={!awaitingUser}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded-md bg-forest-800/70 border border-forest-600/60 text-sm hover:bg-forest-700/70 transition"
        >
          Reset
        </button>
        <button
          onClick={handleShowSolution}
          disabled={status === STATUS.SOLVED}
          className="px-3 py-1.5 rounded-md bg-forest-800/70 border border-forest-600/60 text-sm hover:bg-forest-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Show solution
        </button>
      </div>
    </div>
  )
}
