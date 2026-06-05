import React, { useState, useCallback, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import PuzzleBoard from 'src/components/PuzzleBoard'
import PuzzleTransition from 'src/components/PuzzleTransition'
import MountainProgress from 'src/components/MountainProgress'
import WaxSeal from 'src/components/WaxSeal'
import { BotWorkerManager } from 'src/lib/pente/botWorker'
import { BLACK, EMPTY } from 'src/lib/pente/constants'
import { getZone } from 'src/lib/pente/elo'
import useTactileFeedback from 'src/hooks/useTactileFeedback'

/**
 * Endless Puzzle Mode — infinitely generated puzzles calibrated to player ELO.
 * Features physics canvas transitions between puzzles and adaptive difficulty.
 */
export default function EndlessPuzzle({
  playerId,
  elo,
  peakElo,
  eloHistory,
  onSolve,
  onAttempt,
  onBack,
  initialCategory = null,    // when set, the first puzzle is biased to this tactic (e.g. 'defense')
  introTacticLabel = null,   // e.g. "4-3 Fork" — shown above the first puzzle as framing
}) {
  const [puzzle, setPuzzle] = useState(null)
  const [nextPuzzle, setNextPuzzle] = useState(null) // pre-fetched
  const [loading, setLoading] = useState(true)
  const [solved, setSolved] = useState(false)
  const [wrongMove, setWrongMove] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [eloDelta, setEloDelta] = useState(null)
  const [newZone, setNewZone] = useState(null)
  const [transitionPhase, setTransitionPhase] = useState('idle') // idle | scatter | dropIn
  const [showBoard, setShowBoard] = useState(false)
  const [sessionStats, setSessionStats] = useState({ solved: 0, total: 0, streak: 0 })
  const [currentElo, setCurrentElo] = useState(elo)

  const boardContainerRef = useRef(null)
  const workerRef = useRef(null)
  const puzzleStartRef = useRef(Date.now())
  const feedback = useTactileFeedback()

  // Worker lifecycle
  useEffect(() => {
    workerRef.current = new BotWorkerManager()
    return () => workerRef.current?.terminate()
  }, [])

  // Generate a puzzle + persist it to the bank (fire-and-forget).
  // The returned puzzle gains a bankId used to correlate attempts server-side.
  const generateNext = useCallback(async (targetElo, category = null) => {
    if (!workerRef.current) return null
    const p = await workerRef.current.generatePuzzle(targetElo, category ? { preferredCategory: category } : {})
    if (!p) return null

    // Persist to puzzle_bank in the background; attach bankId when it returns
    const persisted = { ...p }
    fetch('/api/pente/puzzle-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: p.board,
        solutions: p.solutions,
        player_to_move: p.playerToMove,
        category: p.category,
        difficulty: p.difficulty,
        rating: p.rating,
        title: p.title,
        description: p.description,
        hint: p.hint,
        explanation: p.explanation,
        generated_by: 'worker',
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) persisted.bankId = data.id })
      .catch(() => { /* offline — puzzle still playable */ })

    return persisted
  }, [])

  // Initial load + prefetch
  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      // First puzzle honors the intervention category; subsequent puzzles go general.
      const p = await generateNext(currentElo, initialCategory)
      if (cancelled) return
      if (p) {
        setPuzzle(p)
        setShowBoard(true)
        setLoading(false)
        const next = await generateNext(currentElo)
        if (!cancelled) setNextPuzzle(next)
      } else {
        setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle correct/wrong click
  const handleCellClick = useCallback((row, col, { triggerShake }) => {
    if (solved || !puzzle) return

    const isCorrect = puzzle.solutions.some(s => s.row === row && s.col === col)

    if (isCorrect) {
      setSolved(true)
      setWrongMove(null)

      const solveTimeMs = Date.now() - puzzleStartRef.current
      const eloBefore = currentElo
      const result = onSolve?.(puzzle.id, puzzle.rating, attempts, showHint, solveTimeMs)

      // Persist the attempt server-side (fire-and-forget)
      if (playerId) {
        fetch('/api/pente/puzzle-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: playerId,
            puzzle_id: puzzle.bankId || null,
            puzzle_external_id: puzzle.id,
            rating: puzzle.rating,
            solved: true,
            attempts: attempts + 1,
            used_hint: showHint,
            elo_before: eloBefore,
            elo_after: result?.newElo ?? eloBefore,
            solve_time_ms: solveTimeMs,
          }),
        }).catch(() => {})
      }
      if (result) {
        setEloDelta(result.delta)
        setCurrentElo(result.newElo)
        const oldZone = getZone(currentElo)
        if (result.zone.name !== oldZone.name) {
          setNewZone(result.zone)
          feedback.onLevelUp()
          confetti({
            particleCount: 200, spread: 120, origin: { y: 0.5 },
            colors: ['#ff69b4', '#40916c', '#fbbf24', '#6abf82', '#ff8cc2'],
          })
        } else {
          feedback.onCorrect()
          confetti({
            particleCount: 60, spread: 50, origin: { y: 0.65 }, gravity: 1.2,
            colors: ['#ff69b4', '#40916c', '#ffb8d9'],
          })
        }
      } else {
        playClimb()
      }

      setSessionStats(prev => ({
        solved: prev.solved + 1,
        total: prev.total + 1,
        streak: prev.streak + 1,
      }))

      // Auto-advance after brief pause — start scatter
      setTimeout(() => {
        setTransitionPhase('scatter')
      }, 1200)
    } else {
      feedback.onWrong()
      triggerShake()
      setWrongMove({ row, col })
      setAttempts(prev => prev + 1)
      if (onAttempt && puzzle) onAttempt(puzzle.id, puzzle.rating)
      setSessionStats(prev => ({ ...prev, total: prev.total + 1 }))
      setTimeout(() => setWrongMove(null), 600)
    }
  }, [solved, puzzle, onSolve, onAttempt, attempts, showHint, currentElo, feedback, playerId])

  // Transition complete handlers
  const handleScatterComplete = useCallback(async () => {
    // Scatter done — load next puzzle, then drop in
    let next = nextPuzzle
    if (!next) {
      next = await generateNext(currentElo)
    }
    if (next) {
      setPuzzle(next)
      puzzleStartRef.current = Date.now()
      setSolved(false)
      setAttempts(0)
      setShowHint(false)
      setEloDelta(null)
      setNewZone(null)
      setWrongMove(null)
      setShowBoard(true)
      setTransitionPhase('dropIn')

      // Prefetch the one after this
      generateNext(currentElo).then(p => setNextPuzzle(p))
    } else {
      setTransitionPhase('idle')
      setShowBoard(true)
    }
  }, [nextPuzzle, currentElo, generateNext])

  const handleDropInComplete = useCallback(() => {
    setTransitionPhase('idle')
  }, [])

  const handleTransitionComplete = useCallback(() => {
    if (transitionPhase === 'scatter') handleScatterComplete()
    else if (transitionPhase === 'dropIn') handleDropInComplete()
  }, [transitionPhase, handleScatterComplete, handleDropInComplete])

  // Spacebar to skip forward if solved
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && solved && transitionPhase === 'idle') {
        e.preventDefault()
        setTransitionPhase('scatter')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [solved, transitionPhase])

  const zone = getZone(currentElo)
  const isBlackToMove = puzzle?.playerToMove === BLACK

  if (loading && !puzzle) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-2 border-candy-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-forest-400">Generating puzzle at your level...</p>
      </div>
    )
  }

  if (!puzzle) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-forest-400 mb-4">Could not generate a puzzle. Try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-4 py-2 rounded-lg border border-forest-700/40 text-forest-300 hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm text-forest-400 hover:text-candy-400 transition-colors flex items-center gap-1"
        >
          <span>&larr;</span> Back
        </button>
        <div className="flex items-center gap-4">
          {/* Session stats */}
          <div className="flex items-center gap-3 text-xs text-forest-500">
            <span>Solved: <strong className="text-candy-400">{sessionStats.solved}</strong></span>
            <span>Streak: <strong className="text-green-400">{sessionStats.streak}</strong></span>
          </div>
          <MountainProgress elo={currentElo} peakElo={peakElo} eloHistory={eloHistory} compact />
        </div>
      </div>

      {/* Training framing (from intervention) */}
      {introTacticLabel && sessionStats.solved === 0 && (
        <div className="mb-4 rounded-lg bg-gradient-to-r from-red-900/30 to-forest-900/30 border border-red-700/30 px-4 py-2.5 text-sm flex items-center gap-3">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-red-300 px-2 py-0.5 rounded bg-red-500/10 border border-red-400/20">
            Training
          </span>
          <span className="text-forest-200">
            Drilling <strong className="text-white">{introTacticLabel}</strong> defense — solve this and the next one locks in the pattern.
          </span>
        </div>
      )}

      {/* Puzzle info */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">{puzzle.title}</h2>
          <p className="text-sm text-forest-300 mt-0.5">{puzzle.description}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-forest-500 uppercase tracking-wider">Rating</span>
          <div className="text-sm font-mono text-forest-300">{puzzle.rating}</div>
        </div>
      </div>

      {/* Player to move */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-4 h-4 rounded-full border-2 ${
          isBlackToMove ? 'bg-gray-900 border-gray-600' : 'bg-white border-forest-300'
        }`} />
        <span className="text-sm font-medium text-forest-200">
          {isBlackToMove ? 'Black' : 'White'} to move
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          puzzle.category === 'capture' ? 'text-red-400 border-red-700/40' :
          puzzle.category === 'five_in_a_row' ? 'text-green-400 border-green-700/40' :
          puzzle.category === 'defense' ? 'text-blue-400 border-blue-700/40' :
          puzzle.category === 'mixed' ? 'text-purple-400 border-purple-700/40' :
          'text-yellow-400 border-yellow-700/40'
        }`}>
          {puzzle.category.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] text-forest-500">
          {'★'.repeat(puzzle.difficulty)}{'☆'.repeat(4 - puzzle.difficulty)}
        </span>
      </div>

      {/* Hint */}
      {showHint && !solved && (
        <div className="mb-4 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-4 py-3 text-sm flex items-start gap-3 animate-fadeIn">
          <span className="text-cyan-400 font-bold text-xs shrink-0 mt-0.5">Hint</span>
          <span className="text-cyan-200 flex-1">{puzzle.hint}</span>
        </div>
      )}

      {/* Wrong move feedback */}
      {wrongMove && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-2 text-sm text-red-300 animate-fadeIn">
          Not quite — try again! (Attempt {attempts})
        </div>
      )}

      {/* Board with canvas overlay */}
      <div className="flex justify-center">
        <div ref={boardContainerRef} className="relative">
          <div style={{ opacity: transitionPhase !== 'idle' ? 0 : 1, transition: 'opacity 0.15s' }}>
            <PuzzleBoard
              board={puzzle.board}
              onCellClick={handleCellClick}
              playerToMove={puzzle.playerToMove}
              hintCell={showHint && !solved ? puzzle.solutions[0] : null}
              highlightCells={solved ? puzzle.solutions : []}
              disabled={solved || transitionPhase !== 'idle'}
              wrongCell={wrongMove}
            />
          </div>
          <PuzzleTransition
            boardRef={boardContainerRef}
            phase={transitionPhase}
            board={puzzle.board}
            onComplete={handleTransitionComplete}
            eloZone={zone}
          />
        </div>
      </div>

      {/* Post-solve strip */}
      {solved && transitionPhase === 'idle' && (
        <div className="mt-4 flex items-center gap-3 animate-fadeIn">
          {eloDelta !== null && (
            <WaxSeal
              delta={eloDelta}
              zoneColor={eloDelta >= 0 ? zone.color : '#7f1d1d'}
              onMount={feedback.onStamp}
            />
          )}
          {newZone && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-900/30 border border-yellow-600/40">
              <span className="text-yellow-300 text-sm font-semibold">New zone: {newZone.name}</span>
            </div>
          )}
          <button
            onClick={() => setTransitionPhase('scatter')}
            className="ml-auto text-sm px-5 py-2 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold hover:from-candy-400 hover:to-candy-500 transition-all shadow-lg shadow-candy-500/20 flex items-center gap-2"
          >
            Next Puzzle
            <span className="text-xs opacity-70">[space]</span>
          </button>
        </div>
      )}

      {/* Explanation */}
      {solved && transitionPhase === 'idle' && (
        <div className="mt-3 rounded-xl bg-forest-900/80 border border-forest-700/40 p-4 animate-fadeIn">
          <p className="text-sm text-forest-300">{puzzle.explanation}</p>
          {attempts > 0 && (
            <p className="text-xs text-forest-500 mt-2">
              Solved in {attempts + 1} attempt{attempts > 0 ? 's' : ''}
              {showHint ? ' (with hint)' : ''}
            </p>
          )}
        </div>
      )}

      {/* Pre-solve controls */}
      {!solved && transitionPhase === 'idle' && (
        <div className="flex items-center gap-3 mt-4">
          {!showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="text-xs px-3 py-1.5 rounded-md border text-cyan-400 border-cyan-700/40 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors"
            >
              Show Hint
            </button>
          )}
          <button
            onClick={() => setTransitionPhase('scatter')}
            className="text-xs px-3 py-1.5 rounded-md border text-forest-500 border-forest-700/40 hover:text-forest-300 transition-colors"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}
