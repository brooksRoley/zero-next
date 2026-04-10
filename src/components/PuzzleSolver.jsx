import React, { useState, useCallback, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import PuzzleBoard from 'src/components/PuzzleBoard'
import MountainProgress from 'src/components/MountainProgress'
import { BLACK } from 'src/lib/pente/constants'
import { getZone } from 'src/lib/pente/elo'
import useGameSounds from 'src/hooks/useGameSounds'

export default function PuzzleSolver({
  puzzle,
  onBack,
  onNext,
  isSolved: alreadySolved,
  onSolve,
  onAttempt,
  elo,
  eloHistory,
  peakElo,
}) {
  const [solved, setSolved] = useState(alreadySolved)
  const [wrongMove, setWrongMove] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [showExplanation, setShowExplanation] = useState(alreadySolved)
  const [eloDelta, setEloDelta] = useState(null)
  const [newZone, setNewZone] = useState(null)
  const { playClimb, playStumble, playSummit } = useGameSounds()
  const solvedRef = useRef(solved)
  solvedRef.current = solved

  // Spacebar to advance to next puzzle
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && solvedRef.current && onNext) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onNext])

  const handleCellClick = useCallback((row, col, { triggerShake }) => {
    if (solved) return

    const isCorrect = puzzle.solutions.some(s => s.row === row && s.col === col)

    if (isCorrect) {
      setSolved(true)
      setShowExplanation(true)
      setWrongMove(null)

      // Get ELO result from parent
      const result = onSolve?.(puzzle.id, puzzle.rating, attempts, showHint)
      if (result) {
        setEloDelta(result.delta)
        // Check if we crossed into a new zone
        const oldZone = getZone(elo)
        if (result.zone.name !== oldZone.name) {
          setNewZone(result.zone)
          playSummit()
          // Big confetti for zone change
          confetti({
            particleCount: 200,
            spread: 120,
            origin: { y: 0.5 },
            colors: ['#ff69b4', '#40916c', '#fbbf24', '#6abf82', '#ff8cc2'],
          })
        } else {
          playClimb()
          confetti({
            particleCount: 60,
            spread: 50,
            origin: { y: 0.65 },
            gravity: 1.2,
            colors: ['#ff69b4', '#40916c', '#ffb8d9'],
          })
        }
      } else {
        playClimb()
      }
    } else {
      playStumble()
      triggerShake()
      setWrongMove({ row, col })
      setAttempts(prev => prev + 1)
      if (onAttempt) onAttempt(puzzle.id, puzzle.rating)
      setTimeout(() => setWrongMove(null), 600)
    }
  }, [solved, puzzle, onSolve, onAttempt, attempts, showHint, elo, playClimb, playStumble, playSummit])

  const difficultyStars = '★'.repeat(puzzle.difficulty) + '☆'.repeat(4 - puzzle.difficulty)
  const isBlackToMove = puzzle.playerToMove === BLACK

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm text-forest-400 hover:text-candy-400 transition-colors flex items-center gap-1"
        >
          <span>&larr;</span> Back to Puzzles
        </button>
        <div className="flex items-center gap-3">
          {/* Mini ELO display */}
          <MountainProgress elo={elo} peakElo={peakElo} eloHistory={eloHistory} compact />
          <span className="text-xs text-forest-500">
            {puzzle.category.replace(/_/g, ' ')} &middot; {difficultyStars}
          </span>
        </div>
      </div>

      {/* Puzzle rating vs player rating */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{puzzle.title}</h2>
          <p className="text-sm text-forest-300 mt-0.5">{puzzle.description}</p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <span className="text-[10px] text-forest-500 uppercase tracking-wider">Puzzle</span>
          <div className="text-sm font-mono text-forest-300">{puzzle.rating}</div>
        </div>
      </div>

      {/* Player to move indicator */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-4 h-4 rounded-full border-2 ${
            isBlackToMove
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-forest-300'
          }`}
        />
        <span className="text-sm font-medium text-forest-200">
          {isBlackToMove ? 'Black' : 'White'} to move
        </span>
        {puzzle.gameMode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border text-purple-400 border-purple-700/40">
            {puzzle.gameMode === 'team2v2' ? '2v2' : 'FFA'}
          </span>
        )}
        {(puzzle.blackCaptures > 0 || puzzle.whiteCaptures > 0) && (
          <span className="text-xs text-forest-500">
            Captures: B:{puzzle.blackCaptures} W:{puzzle.whiteCaptures}
          </span>
        )}
      </div>

      {/* Team context banner */}
      {puzzle.teamContext && (
        <div className="mb-4 rounded-lg bg-purple-900/20 border border-purple-700/30 px-4 py-2.5 text-xs text-purple-200">
          <strong className="text-purple-300">Team Mode:</strong> {puzzle.teamContext}
        </div>
      )}

      {/* Hint toast */}
      {showHint && !solved && (
        <div className="mb-4 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-4 py-3 text-sm flex items-start gap-3 animate-fadeIn">
          <span className="text-cyan-400 font-bold text-xs shrink-0 mt-0.5">Hint</span>
          <span className="text-cyan-200 flex-1">{puzzle.hint}</span>
          <button
            onClick={() => setShowHint(false)}
            className="ml-auto text-cyan-500 hover:text-cyan-300 text-xs shrink-0"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Wrong move feedback */}
      {wrongMove && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/40 px-4 py-2 text-sm text-red-300 animate-fadeIn">
          Not quite — try again! (Attempt {attempts})
        </div>
      )}

      {/* Board */}
      <div className="flex justify-center">
        <PuzzleBoard
          board={puzzle.board}
          onCellClick={handleCellClick}
          playerToMove={puzzle.playerToMove}
          hintCell={showHint && !solved ? puzzle.solutions[0] : null}
          highlightCells={solved ? puzzle.solutions : []}
          disabled={solved}
          wrongCell={wrongMove}
        />
      </div>

      {/* Post-solve area */}
      {solved && (
        <div className="mt-5 space-y-4 animate-fadeIn">
          {/* ELO change + next button */}
          <div className="flex items-center gap-4">
            {eloDelta !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                eloDelta >= 0
                  ? 'bg-green-900/30 border-green-700/40 text-green-300'
                  : 'bg-red-900/30 border-red-700/40 text-red-300'
              }`}>
                <span className="text-xs uppercase tracking-wider opacity-70">ELO</span>
                <span className="text-lg font-bold">{eloDelta >= 0 ? '+' : ''}{eloDelta}</span>
              </div>
            )}

            {/* Zone change banner */}
            {newZone && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-600/40">
                <span className="text-yellow-300 text-sm font-semibold">New zone: {newZone.name}</span>
              </div>
            )}

            <div className="ml-auto">
              {onNext && (
                <button
                  onClick={onNext}
                  className="text-sm px-5 py-2.5 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold hover:from-candy-400 hover:to-candy-500 transition-all shadow-lg shadow-candy-500/20 flex items-center gap-2"
                >
                  Continue Climbing
                  <span className="text-xs opacity-70">[space]</span>
                </button>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-xl bg-forest-900/80 border border-forest-700/40 p-4">
            <h3 className="text-sm font-semibold text-forest-100 mb-2">
              {!alreadySolved ? 'Correct!' : 'Solution'}
            </h3>
            <p className="text-sm text-forest-300">{puzzle.explanation}</p>
            {attempts > 0 && (
              <p className="text-xs text-forest-500 mt-2">
                Solved in {attempts + 1} attempt{attempts > 0 ? 's' : ''}
                {showHint ? ' (with hint)' : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Controls (before solve) */}
      {!solved && (
        <div className="flex items-center gap-3 mt-5">
          {!showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="text-xs px-3 py-1.5 rounded-md border text-cyan-400 border-cyan-700/40 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors"
            >
              Show Hint
            </button>
          )}
        </div>
      )}
    </div>
  )
}
