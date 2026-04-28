import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import confetti from 'canvas-confetti'
import useGameSounds from 'src/hooks/useGameSounds'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import useCoach from 'src/hooks/useCoach'
import { getAdaptiveBotConfig } from 'src/lib/go/adaptiveBot'
import GoRules from 'src/components/go/GoRules'
import {
  EMPTY,
  BLACK,
  WHITE,
  BOARD_SIZES,
  DEFAULT_BOARD_SIZE,
  HANDICAP_COUNTS,
  createEmptyBoard,
  applyMove,
  findGroup,
  getHandicapStones,
} from 'src/lib/go/gameLogic'
import { computeAreaScore, computeAreaScoreWithDead, computeTerritoryScore } from 'src/lib/go/scoring'
import { GoBotWorkerManager } from 'src/lib/go/botWorker'
import { eloUpdateGame, rankLabel, eloDelta } from 'src/lib/go/elo'

const KOMI_OPTIONS = [0, 6.5, 7.5]
const SCORING_RULES = [
  { key: 'chinese', label: 'Chinese', defaultKomi: 7.5 },
  { key: 'japanese', label: 'Japanese', defaultKomi: 6.5 },
]

function cellClass(cell) {
  if (cell === BLACK) return 'black'
  if (cell === WHITE) return 'white'
  return ''
}

const HOSHI = {
  9: [
    [2, 2], [2, 6], [4, 4], [6, 2], [6, 6],
  ],
  13: [
    [3, 3], [3, 9], [6, 6], [9, 3], [9, 9],
  ],
  19: [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ],
}

function isHoshi(size, r, c) {
  const points = HOSHI[size] || []
  return points.some(([hr, hc]) => hr === r && hc === c)
}

// Build a starting board for the given size + handicap. Returns
// { board, firstPlayer } — White moves first whenever handicap is present.
function buildInitialBoard(size, handicap) {
  const board = createEmptyBoard(size)
  const stones = getHandicapStones(size, handicap)
  for (const [r, c] of stones) board[r][c] = BLACK
  return { board, firstPlayer: stones.length > 0 ? WHITE : BLACK }
}

export default function GoPage() {
  const router = useRouter()
  const practiceStage = router.query.practice || null

  const profile = useGoPlayerProfile()
  const coach = useCoach()

  const [boardSize, setBoardSize] = useState(practiceStage ? 9 : DEFAULT_BOARD_SIZE)
  const [scoringRule, setScoringRule] = useState('chinese')
  const [komi, setKomi] = useState(7.5)
  const [handicap, setHandicap] = useState(0)

  const initial = useMemo(() => buildInitialBoard(practiceStage ? 9 : DEFAULT_BOARD_SIZE, 0), [practiceStage])
  const [board, setBoard] = useState(initial.board)
  const [currentPlayer, setCurrentPlayer] = useState(initial.firstPlayer)
  const [koPoint, setKoPoint] = useState(null)
  const [captures, setCaptures] = useState({ [BLACK]: 0, [WHITE]: 0 })
  const [lastMove, setLastMove] = useState(null)
  const [moveCount, setMoveCount] = useState(0)
  const [passCount, setPassCount] = useState(0)

  // 'playing' → make moves; 'marking' → click groups to mark dead; 'finished' → game over
  const [phase, setPhase] = useState('playing')
  const [deadStones, setDeadStones] = useState(() => new Set())
  const [acceptedBy, setAcceptedBy] = useState(() => new Set())
  const [resignedBy, setResignedBy] = useState(null)

  const [errorToast, setErrorToast] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(true)
  const [capturedCells, setCapturedCells] = useState(() => new Map())

  // vs Bot mode
  const [vsBot, setVsBot] = useState(true)
  const [playerColor, setPlayerColor] = useState(BLACK)
  const [botThinking, setBotThinking] = useState(false)
  const [eloChange, setEloChange] = useState(null)

  const boardRef = useRef(null)
  const botRef = useRef(null)
  const { playPlace, playCapture, playWin } = useGameSounds()

  // Map practice stage to teaching focus
  const teachingFocus = useMemo(() => {
    if (!practiceStage) return null
    const map = { capture: 'capture', eyes: 'eyes', territory: 'territory' }
    return map[practiceStage] || null
  }, [practiceStage])

  // Adaptive bot config
  const botConfig = useMemo(() => {
    return getAdaptiveBotConfig(profile.goElo, profile.gamesPlayed, teachingFocus)
  }, [profile.goElo, profile.gamesPlayed, teachingFocus])

  const gameOver = phase === 'finished'
  const botColor = vsBot ? (playerColor === BLACK ? WHITE : BLACK) : null

  // Bot worker lifecycle
  useEffect(() => {
    botRef.current = new GoBotWorkerManager()
    return () => botRef.current?.terminate()
  }, [])

  const score = useMemo(() => {
    if (scoringRule === 'japanese') {
      return computeTerritoryScore(board, captures, deadStones, komi)
    }
    return phase === 'playing'
      ? computeAreaScore(board, komi)
      : computeAreaScoreWithDead(board, deadStones, komi)
  }, [board, captures, deadStones, komi, phase, scoringRule])

  const startNewGame = useCallback((size, hcap) => {
    const { board: nextBoard, firstPlayer } = buildInitialBoard(size, hcap)
    setBoard(nextBoard)
    setCurrentPlayer(firstPlayer)
    setKoPoint(null)
    setCaptures({ [BLACK]: 0, [WHITE]: 0 })
    setLastMove(null)
    setMoveCount(0)
    setPassCount(0)
    setPhase('playing')
    setDeadStones(new Set())
    setAcceptedBy(new Set())
    setResignedBy(null)
    setErrorToast(null)
    setCapturedCells(new Map())
    setEloChange(null)
    setBotThinking(false)
  }, [])

  const handleSizeChange = useCallback((size) => {
    setBoardSize(size)
    // If current handicap exceeds what this size supports, drop it.
    const supported = getHandicapStones(size, handicap).length
    const nextHandicap = supported === handicap ? handicap : 0
    if (nextHandicap !== handicap) setHandicap(nextHandicap)
    startNewGame(size, nextHandicap)
  }, [handicap, startNewGame])

  const handleHandicapChange = useCallback((hcap) => {
    setHandicap(hcap)
    startNewGame(boardSize, hcap)
  }, [boardSize, startNewGame])

  const handleScoringRuleChange = useCallback((nextRule) => {
    if (nextRule === scoringRule) return
    setScoringRule(nextRule)
    const cfg = SCORING_RULES.find(r => r.key === nextRule)
    if (cfg) setKomi(cfg.defaultKomi)
  }, [scoringRule])

  const triggerShake = useCallback(() => {
    const el = boardRef.current
    if (!el) return
    el.classList.remove('board-shake')
    void el.offsetWidth
    el.classList.add('board-shake')
  }, [])

  const showError = useCallback((msg) => {
    setErrorToast(msg)
    triggerShake()
    setTimeout(() => setErrorToast(null), 1500)
  }, [triggerShake])

  const placeStone = useCallback((row, col) => {
    const result = applyMove(board, row, col, currentPlayer, koPoint)
    if (result.error) {
      if (result.error === 'occupied') return
      const labels = { ko: 'Ko — try elsewhere first', suicide: 'Suicide is illegal' }
      showError(labels[result.error] || 'Illegal move')
      return
    }

    setBoard(result.newBoard)
    setKoPoint(result.nextKoPoint)
    setLastMove([row, col])
    setMoveCount(prev => prev + 1)
    setPassCount(0)
    playPlace()

    if (result.captured.length > 0) {
      const captureColor = currentPlayer === BLACK ? WHITE : BLACK
      const caps = new Map()
      for (const [cr, cc] of result.captured) {
        caps.set(`${cr}-${cc}`, captureColor)
      }
      setCapturedCells(caps)
      setTimeout(() => setCapturedCells(new Map()), 450)

      setCaptures(prev => ({
        ...prev,
        [currentPlayer]: (prev[currentPlayer] || 0) + result.captured.length,
      }))
      setTimeout(() => { playCapture(); triggerShake() }, 80)
    }

    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK)
  }, [board, currentPlayer, koPoint, playPlace, playCapture, triggerShake, showError])

  const toggleDead = useCallback((row, col) => {
    if (board[row][col] === EMPTY) return
    const group = findGroup(board, row, col)
    setDeadStones(prev => {
      const next = new Set(prev)
      const someAlreadyDead = group.stones.some(([r, c]) => next.has(`${r},${c}`))
      for (const [r, c] of group.stones) {
        const key = `${r},${c}`
        if (someAlreadyDead) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }, [board])

  const handleCellClick = useCallback((row, col) => {
    if (vsBot && currentPlayer === botColor) return
    if (phase === 'playing') placeStone(row, col)
    else if (phase === 'marking') toggleDead(row, col)
  }, [phase, placeStone, toggleDead, vsBot, currentPlayer, botColor])

  const handlePass = useCallback(() => {
    if (phase !== 'playing') return
    const newPassCount = passCount + 1
    setPassCount(newPassCount)
    setKoPoint(null)
    setLastMove(null)
    setMoveCount(prev => prev + 1)

    if (newPassCount >= 2) {
      if (vsBot) {
        // Skip marking ceremony vs bot — end immediately with area scoring
        setPhase('finished')
        setTimeout(() => {
          const s = computeAreaScore(board, komi)
          playWin()
          if (s.winner) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
        }, 100)
        return
      }
      setPhase('marking')
      setDeadStones(new Set())
      setAcceptedBy(new Set())
      setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK)
      return
    }
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK)
  }, [currentPlayer, phase, passCount, vsBot, board, komi, playWin])

  const handleResign = useCallback(() => {
    if (phase !== 'playing') return
    setResignedBy(currentPlayer)
    setPhase('finished')
    setTimeout(() => playWin(), 100)
  }, [currentPlayer, phase, playWin])

  const handleAcceptMarking = useCallback(() => {
    if (phase !== 'marking') return
    if (acceptedBy.has(currentPlayer)) return // already accepted

    const next = new Set(acceptedBy)
    next.add(currentPlayer)
    setAcceptedBy(next)

    if (next.has(BLACK) && next.has(WHITE)) {
      setPhase('finished')
      const finalScore = scoringRule === 'japanese'
        ? computeTerritoryScore(board, captures, deadStones, komi)
        : computeAreaScoreWithDead(board, deadStones, komi)
      setTimeout(() => {
        playWin()
        if (finalScore.winner) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
        }
      }, 100)
      return
    }

    // Hand off to the other player to confirm
    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK)
  }, [acceptedBy, currentPlayer, board, captures, deadStones, komi, phase, scoringRule, playWin])

  const handleResume = useCallback(() => {
    if (phase !== 'marking') return
    setPhase('playing')
    setPassCount(0)
    setDeadStones(new Set())
    setAcceptedBy(new Set())
  }, [phase])

  const winner = gameOver
    ? (resignedBy ? (resignedBy === BLACK ? WHITE : BLACK) : score.winner)
    : null

  // Keyboard shortcut: P to pass
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (phase === 'playing') handlePass()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handlePass])

  // Bot move trigger: fires when it becomes the bot's turn
  useEffect(() => {
    if (!vsBot || phase !== 'playing') return
    if (currentPlayer !== botColor) return
    if (botThinking) return

    setBotThinking(true)
    const manager = botRef.current
    if (!manager) { setBotThinking(false); return }

    manager.findResponse(board, botColor, null, koPoint, botConfig.timeBudget, botConfig).then(({ move }) => {
      setBotThinking(false)
      if (move) placeStone(move[0], move[1])
      else handlePass()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsBot, phase, currentPlayer, botColor, board, koPoint, botThinking, botConfig])

  // ELO update when a bot game ends
  useEffect(() => {
    if (!vsBot || phase !== 'finished' || eloChange !== null) return
    const playerWon = resignedBy !== null
      ? resignedBy === botColor
      : winner === playerColor
    let outcome = 0.0
    if (resignedBy !== null) {
      outcome = resignedBy === botColor ? 1.0 : 0.0
    } else if (winner === playerColor) {
      outcome = 1.0
    } else if (winner === null) {
      outcome = 0.5
    }
    const before = profile.goElo
    const nextElo = eloUpdateGame(before, botConfig.botElo, outcome)
    setEloChange({ before, after: nextElo, delta: nextElo - before })
    profile.recordGameEnd({ won: playerWon, newElo: nextElo })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsBot, phase, winner, botColor, playerColor, resignedBy, eloChange])

  // Coach: check for tips after each human move
  useEffect(() => {
    if (!vsBot || !profile.coachEnabled || phase !== 'playing') return
    if (currentPlayer === botColor) return // only check after human moves
    if (moveCount === 0) return
    coach.checkForTip(board, playerColor, koPoint, profile.lessonProgress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount])

  // Reset coach counts on new game
  useEffect(() => {
    coach.resetCounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize, handicap])

  const boardClass = [
    'game-board go-board rounded-xl',
    currentPlayer === BLACK ? 'hover-black' : 'hover-white',
    phase === 'marking' ? 'marking' : '',
  ].filter(Boolean).join(' ')

  const totalCaptures = (color) => (
    captures[color] +
    (phase !== 'playing' ? (color === BLACK ? score.blackCapturesDead || 0 : score.whiteCapturesDead || 0) : 0)
  )

  return (
    <div
      className="flex flex-col bg-forest-950 text-white overflow-hidden"
      style={{ ['--go-size']: boardSize, height: '100dvh' }}
    >
      <Head>
        <title>Go | Brooks Roley</title>
        <meta name="description" content="Learn and play the ancient game of Go. 9×9, 13×13, or 19×19 boards. Chinese rules with komi, handicap, and dead-stone marking." />
      </Head>

      <nav className="flex-shrink-0 sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-1">
          <Link
            href="/"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 mr-1 border-r border-forest-800/60"
            aria-label="Back to home"
          >
            &larr;
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide mr-3">Go</span>
          <div className="flex gap-0.5">
            <span className="text-xs px-3 py-1.5 rounded-md bg-candy-500/15 text-candy-300 ring-1 ring-candy-400/30">
              Play
            </span>
            <Link
              href="/posts/go/learn"
              className="text-xs px-3 py-1.5 rounded-md text-forest-400 hover:text-candy-300 hover:bg-forest-800/40 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/posts/go/puzzles"
              className="text-xs px-3 py-1.5 rounded-md text-forest-400 hover:text-candy-300 hover:bg-forest-800/40 transition-colors"
            >
              Puzzles
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 grid gap-4 lg:grid-cols-[1fr_320px] content-start">

        <div className="flex flex-col items-center">

          {/* Status row */}
          <div className="w-full flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full ring-2 ring-forest-700"
                style={{ backgroundColor: currentPlayer === BLACK ? '#1a1a1a' : '#f5f5f5' }}
              />
              <span className="font-semibold">
                {phase === 'finished'
                  ? (winner === BLACK ? 'Black wins' : winner === WHITE ? 'White wins' : 'Draw')
                  : phase === 'marking'
                    ? `Mark dead stones — ${currentPlayer === BLACK ? 'Black' : 'White'} to confirm`
                    : vsBot && currentPlayer === botColor
                      ? `Bot thinking…`
                      : `${currentPlayer === BLACK ? 'Black' : 'White'} to play`}
              </span>
              {botThinking && (
                <span className="inline-block w-3 h-3 rounded-full bg-candy-400 animate-pulse" />
              )}
              {phase === 'playing' && passCount === 1 && (
                <span className="text-xs text-amber-400 ml-1">(opponent passed — pass again to end)</span>
              )}
              {phase === 'playing' && handicap > 0 && moveCount === 0 && (
                <span className="text-xs text-forest-500 ml-1">({handicap}-stone handicap)</span>
              )}
              {phase === 'marking' && acceptedBy.size > 0 && (
                <span className="text-xs text-green-400 ml-1">
                  {acceptedBy.has(BLACK) && 'Black ✓'}
                  {acceptedBy.has(BLACK) && acceptedBy.has(WHITE) && ' '}
                  {acceptedBy.has(WHITE) && 'White ✓'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-forest-300">
              {vsBot && (
                <span className="text-candy-400/80 font-mono">{rankLabel(profile.goElo)}</span>
              )}
              <span>Move {moveCount}</span>
              <span className="text-forest-600">|</span>
              <span title="captures by Black">B caps {totalCaptures(BLACK)}</span>
              <span title="captures by White">W caps {totalCaptures(WHITE)}</span>
            </div>
          </div>

          {errorToast && (
            <div className="mb-2 rounded-lg bg-red-900/30 border border-red-700/40 px-3 py-1.5 text-xs text-red-200">
              {errorToast}
            </div>
          )}

          {coach.tip && profile.coachEnabled && (
            <div className="go-coach-tip mb-2">
              <span>{coach.tip.message}</span>
              <button className="go-coach-dismiss" onClick={coach.dismissTip} aria-label="Dismiss tip">&times;</button>
            </div>
          )}

          {/* Practice mode header */}
          {practiceStage && (
            <div className="mb-2 rounded-lg bg-candy-500/10 border border-candy-400/30 px-3 py-1.5 text-xs text-candy-200">
              Practice mode: <strong>{practiceStage}</strong> focus — coach tips are on, 9×9 board
            </div>
          )}

          {/* The board */}
          <div
            ref={boardRef}
            className={boardClass}
            style={vsBot && currentPlayer === botColor ? { opacity: 0.85, pointerEvents: 'none' } : {}}
          >
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex go-row">
                {row.map((cell, colIndex) => {
                  const cellKey = `${rowIndex}-${colIndex}`
                  const captureColor = capturedCells.get(cellKey)
                  const isLast = lastMove && lastMove[0] === rowIndex && lastMove[1] === colIndex
                  const hoshi = isHoshi(boardSize, rowIndex, colIndex)
                  const isDead = deadStones.has(`${rowIndex},${colIndex}`)
                  return (
                    <button
                      key={colIndex}
                      data-row={rowIndex}
                      data-col={colIndex}
                      className={[
                        'board-cell',
                        cellClass(cell),
                        isLast && phase === 'playing' ? 'last-move' : '',
                        hoshi ? 'go-hoshi' : '',
                        isDead ? 'go-dead' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      disabled={phase === 'finished'}
                      aria-label={`${String.fromCharCode(65 + colIndex)}${boardSize - rowIndex}`}
                    >
                      {hoshi && cell === EMPTY && <span className="go-hoshi-dot" />}
                      {cell === EMPTY && phase === 'playing' && <span className="go-preview" />}
                      {isDead && <span className="go-dead-mark" />}
                      {captureColor !== undefined && cell === EMPTY && (
                        <span className={`stone-capture ${captureColor === BLACK ? 'capture-black' : 'capture-white'}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Action row — depends on phase */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {phase === 'playing' && (
              <>
                <button
                  onClick={handlePass}
                  disabled={vsBot && currentPlayer === botColor}
                  className="px-4 py-2 rounded-lg bg-forest-800/70 border border-forest-600/60 text-sm hover:bg-forest-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="P"
                >
                  Pass
                </button>
                <button
                  onClick={handleResign}
                  disabled={vsBot && currentPlayer === botColor}
                  className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/40 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Resign
                </button>
              </>
            )}
            {phase === 'marking' && (
              <>
                <button
                  onClick={handleAcceptMarking}
                  disabled={acceptedBy.has(currentPlayer)}
                  className="px-4 py-2 rounded-lg bg-candy-500/30 border border-candy-400/50 text-sm text-candy-100 hover:bg-candy-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {acceptedBy.has(currentPlayer)
                    ? `${currentPlayer === BLACK ? 'Black' : 'White'} accepted ✓`
                    : `Accept (${currentPlayer === BLACK ? 'Black' : 'White'})`}
                </button>
                <button
                  onClick={handleResume}
                  className="px-4 py-2 rounded-lg bg-forest-800/70 border border-forest-600/60 text-sm hover:bg-forest-700/70 transition"
                >
                  Resume — keep playing
                </button>
              </>
            )}
            <button
              onClick={() => startNewGame(boardSize, handicap)}
              className="px-4 py-2 rounded-lg bg-candy-500/20 border border-candy-400/40 text-sm text-candy-200 hover:bg-candy-500/30 transition"
            >
              New game
            </button>
          </div>

          {/* Settings row: rule, board size, komi, handicap */}
          <div className="mt-4 w-full max-w-md space-y-2">
            <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
              <span className="w-16 text-right">Rule:</span>
              {SCORING_RULES.map(r => {
                const ruleLocked = moveCount > 0
                const isActive = r.key === scoringRule
                return (
                  <button
                    key={r.key}
                    onClick={() => handleScoringRuleChange(r.key)}
                    disabled={ruleLocked && !isActive}
                    title={ruleLocked && !isActive ? 'Start a new game to switch rule' : undefined}
                    className={`px-2.5 py-1 rounded-md border transition ${
                      isActive
                        ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                        : ruleLocked
                          ? 'bg-forest-900/40 text-forest-600 border-forest-800/40 cursor-not-allowed opacity-50'
                          : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                    }`}
                  >
                    {r.label}
                  </button>
                )
              })}
              {moveCount > 0 && (
                <span className="text-forest-600 ml-1">(locked during play)</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
              <span className="w-16 text-right">Board:</span>
              {BOARD_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  className={`px-2.5 py-1 rounded-md border transition ${
                    size === boardSize
                      ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                      : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
              <span className="w-16 text-right">Komi:</span>
              {KOMI_OPTIONS.map(k => (
                <button
                  key={k}
                  onClick={() => setKomi(k)}
                  className={`px-2.5 py-1 rounded-md border transition ${
                    k === komi
                      ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                      : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
              <span className="w-16 text-right">Handicap:</span>
              {HANDICAP_COUNTS.map(h => (
                <button
                  key={h}
                  onClick={() => handleHandicapChange(h)}
                  className={`px-2.5 py-1 rounded-md border transition ${
                    h === handicap
                      ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                      : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* vs Bot toggle */}
            <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
              <span className="w-16 text-right">Mode:</span>
              <button
                onClick={() => { setVsBot(false); startNewGame(boardSize, handicap) }}
                className={`px-2.5 py-1 rounded-md border transition ${
                  !vsBot
                    ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                    : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                }`}
              >
                2 Player
              </button>
              <button
                onClick={() => { setVsBot(true); startNewGame(boardSize, handicap) }}
                className={`px-2.5 py-1 rounded-md border transition ${
                  vsBot
                    ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                    : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                }`}
              >
                vs Bot
              </button>
            </div>

            {vsBot && (
              <>
                <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
                  <span className="w-16 text-right">You play:</span>
                  {[{ label: 'Black ●', color: BLACK }, { label: 'White ○', color: WHITE }].map(({ label, color }) => (
                    <button
                      key={color}
                      onClick={() => { setPlayerColor(color); startNewGame(boardSize, handicap) }}
                      className={`px-2.5 py-1 rounded-md border transition ${
                        playerColor === color
                          ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                          : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
                  <span className="w-16 text-right">Bot:</span>
                  <span className="text-forest-300 font-mono text-[11px]">
                    ~{botConfig.botElo} ELO (adapts to you)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
                  <span className="w-16 text-right">Coach:</span>
                  <button
                    onClick={() => profile.setCoachEnabled(!profile.coachEnabled)}
                    className={`px-2.5 py-1 rounded-md border transition ${
                      profile.coachEnabled
                        ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
                        : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
                    }`}
                  >
                    {profile.coachEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <GoRules
            open={rulesOpen}
            onToggle={() => setRulesOpen(o => !o)}
            boardSize={boardSize}
          />

          <div className="rounded-xl border border-forest-700/50 bg-forest-900/70 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">
                {phase === 'finished' ? 'Final score' : phase === 'marking' ? 'Score (marking)' : 'Live score'}
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-forest-500">
                {scoringRule === 'japanese' ? 'Territory' : 'Area'}
              </span>
            </div>
            {vsBot && (
              <div className="flex items-center justify-between text-xs mb-3 pb-2 border-b border-forest-800/60">
                <span className="text-forest-400">Your ELO</span>
                <span className="font-mono text-candy-300">{profile.goElo} · {rankLabel(profile.goElo)}</span>
              </div>
            )}
            {gameOver && winner && (
              <div className="text-xs text-candy-300 font-mono mb-2">
                margin +{score.margin}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-black/40 border border-forest-800/60 px-3 py-2">
                <div className="text-forest-400 mb-1">Black</div>
                <div className="text-2xl font-bold text-white">{score.black}</div>
                <div className="text-forest-500 mt-1">
                  {scoringRule === 'japanese'
                    ? `${score.blackTerritory} territory + ${score.blackPrisoners} caps`
                    : `${score.blackStones} stones + ${score.blackTerritory} territory`}
                </div>
                {scoringRule === 'chinese' && score.blackCapturesDead > 0 && (
                  <div className="text-red-300/80 mt-0.5">
                    +{score.blackCapturesDead} dead
                  </div>
                )}
              </div>
              <div className="rounded-md bg-white/5 border border-forest-800/60 px-3 py-2">
                <div className="text-forest-400 mb-1">White</div>
                <div className="text-2xl font-bold text-white">{score.white}</div>
                <div className="text-forest-500 mt-1">
                  {scoringRule === 'japanese'
                    ? `${score.whiteTerritory} territory + ${score.whitePrisoners} caps`
                    : `${score.whiteStones} stones + ${score.whiteTerritory} territory`}
                </div>
                {komi > 0 && (
                  <div className="text-candy-300/80 mt-0.5">+ {komi} komi</div>
                )}
                {scoringRule === 'chinese' && score.whiteCapturesDead > 0 && (
                  <div className="text-red-300/80 mt-0.5">
                    +{score.whiteCapturesDead} dead
                  </div>
                )}
              </div>
            </div>
            {score.dame > 0 && (
              <div className="text-[10px] text-forest-500 mt-2">
                {score.dame} neutral point{score.dame === 1 ? '' : 's'} (dame)
                {scoringRule === 'japanese' && ' — must be played out in real Japanese rules'}
              </div>
            )}
          </div>

          {gameOver && (
            <div className="rounded-xl border border-candy-400/40 bg-candy-500/10 px-4 py-3 text-sm">
              {resignedBy ? (
                <p>
                  <strong>{resignedBy === BLACK ? 'Black' : 'White'}</strong> resigned.{' '}
                  <strong>{winner === BLACK ? 'Black' : 'White'}</strong> wins.
                </p>
              ) : score.winner ? (
                <p>
                  <strong>{winner === BLACK ? 'Black' : 'White'}</strong> wins by{' '}
                  <strong>{score.margin}</strong> point{score.margin === 1 ? '' : 's'}.
                </p>
              ) : (
                <p>Draw — both players scored {score.black}.</p>
              )}
              {vsBot && eloChange && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-forest-400">Your ELO:</span>
                  <span className="font-mono text-white">{eloChange.before}</span>
                  <span className="text-forest-500">→</span>
                  <span className="font-mono text-white">{eloChange.after}</span>
                  <span className={`font-mono font-semibold ${eloChange.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {eloDelta(eloChange.before, eloChange.after)}
                  </span>
                  <span className="text-forest-500">({rankLabel(eloChange.after)})</span>
                </div>
              )}
              <button
                onClick={() => startNewGame(boardSize, handicap)}
                className="mt-2 px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-xs text-candy-100 hover:bg-candy-500/30 transition"
              >
                Play again
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
