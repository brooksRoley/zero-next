import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import GameLobby from 'src/components/GameLobby';
import MultiplayerStatus from 'src/components/MultiplayerStatus';
import confetti from 'canvas-confetti';
import useGameSounds from 'src/hooks/useGameSounds';
import usePlayerId from 'src/hooks/usePlayerId';
import useMultiplayerGame from 'src/hooks/useMultiplayerGame';
import { EMPTY, BLACK, WHITE } from 'src/lib/pente/constants';
import { createEmptyBoard, checkForFiveInARow, computeCaptures } from 'src/lib/pente/gameLogic';
import { PenteBot } from 'src/components/PentePlayerbot';
import { PenteTutor } from 'src/components/PenteTutor';
import PreText from 'src/components/PreText';

const GameBoard = () => {
  const router = useRouter();
  const gameId = router.query.game;
  const [mode, setMode] = useState(gameId ? 'online' : 'local');

  // Player identity
  const { playerId, playerName, setPlayerName } = usePlayerId();

  // ── Local state ──
  const [localBoard, setLocalBoard] = useState(() => createEmptyBoard());
  const [localCurrentPlayer, setLocalCurrentPlayer] = useState(BLACK);
  const [localBlackScore, setLocalBlackScore] = useState(0);
  const [localWhiteScore, setLocalWhiteScore] = useState(0);
  const [localBlackCaptures, setLocalBlackCaptures] = useState(0);
  const [localWhiteCaptures, setLocalWhiteCaptures] = useState(0);
  const [, setGameCount] = useState(0);
  const [localLastMove, setLocalLastMove] = useState(null);
  const [localMoveCount, setLocalMoveCount] = useState(0);
  const [rippleCell, setRippleCell] = useState(null);

  // Capture-eject animation: Map<"row-col", BLACK|WHITE>
  const [capturedCells, setCapturedCells] = useState(() => new Map());

  // ── Bot state ──
  const [botEnabled, setBotEnabled] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [botColor] = useState(WHITE);
  const bot = useMemo(() => new PenteBot(botColor), [botColor]);
  const tutor = useMemo(() => new PenteTutor(), []);

  // ── Tutor state ──
  const [tutorEnabled, setTutorEnabled] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [hintCell, setHintCell] = useState(null);
  const [hintExplanation, setHintExplanation] = useState(null);

  // ── UI state ──
  const [showRules, setShowRules] = useState(false);

  // ── Move history (post-game analysis) ──
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameAnalysis, setGameAnalysis] = useState(null);
  const [analysisViewTurn, setAnalysisViewTurn] = useState(null);
  const [winner, setWinner] = useState(null);

  // ── Multiplayer state ──
  const mp = useMultiplayerGame(
    mode === 'online' ? gameId : null,
    playerId,
    playerName
  );

  // ── Derived state: pick source based on mode ──
  const isOnline = mode === 'online' && gameId;
  const board = isOnline ? mp.board : localBoard;
  const currentPlayer = isOnline ? mp.currentPlayer : localCurrentPlayer;
  const blackScore = isOnline ? mp.blackScore : localBlackScore;
  const whiteScore = isOnline ? mp.whiteScore : localWhiteScore;
  const blackCaptures = isOnline ? mp.blackCaptures : localBlackCaptures;
  const whiteCaptures = isOnline ? mp.whiteCaptures : localWhiteCaptures;
  const lastMove = isOnline ? mp.lastMove : localLastMove;
  const moveCount = isOnline ? mp.moveCount : localMoveCount;

  const boardRef = useRef(null);
  const { playPlace, playCapture, playWin } = useGameSounds();

  const triggerShake = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    el.classList.remove('board-shake');
    void el.offsetWidth;
    el.classList.add('board-shake');
  }, []);

  const triggerRipple = useCallback((row, col) => {
    setRippleCell(`${row}-${col}`);
    setTimeout(() => setRippleCell(null), 500);
  }, []);

  // ── Evaluation bar ──
  useEffect(() => {
    if (!isOnline && !gameOver) {
      const score = tutor.evaluateBoardState(localBoard, localWhiteCaptures, localBlackCaptures);
      setEvalScore(score);
    }
  }, [localBoard, localWhiteCaptures, localBlackCaptures, isOnline, gameOver, tutor]);

  // ── Auto-hint when tutor is enabled ──
  useEffect(() => {
    if (!tutorEnabled || gameOver || isOnline) return;
    if (botEnabled && localCurrentPlayer === botColor) return;
    const playerCaps = localCurrentPlayer === BLACK ? localBlackCaptures : localWhiteCaptures;
    const oppCaps    = localCurrentPlayer === BLACK ? localWhiteCaptures : localBlackCaptures;
    const hint = tutor.getHint(
      localBoard.map(r => [...r]),
      localCurrentPlayer,
      playerCaps,
      oppCaps
    );
    setHintCell(hint.suggestedMove);
    setHintExplanation(hint.explanation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorEnabled, localCurrentPlayer, localBoard, localBlackCaptures, localWhiteCaptures, gameOver, isOnline, botEnabled, botColor, tutor]);

  // ── Bot auto-play ──
  const botCaptures   = botColor === BLACK ? localBlackCaptures : localWhiteCaptures;
  const humanCaptures = botColor === BLACK ? localWhiteCaptures : localBlackCaptures;
  useEffect(() => {
    if (!botEnabled || isOnline || gameOver) return;
    if (localCurrentPlayer !== botColor) return;
    setBotThinking(true);
    const timer = setTimeout(() => {
      const move = bot.getBestMove(
        localBoard.map(r => [...r]),
        botCaptures,
        humanCaptures
      );
      if (move) handleLocalClick(move.row, move.col, true);
      setBotThinking(false);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCurrentPlayer, botEnabled, botColor, isOnline, gameOver]);

  // ── Record move history ──
  const recordMove = useCallback((boardState, wCaps, bCaps, mover, row, col) => {
    setMoveHistory(prev => [...prev, {
      board: boardState.map(r => [...r]),
      whiteCaptures: wCaps,
      blackCaptures: bCaps,
      moveMadeBy: mover,
      row, col,
    }]);
  }, []);

  // ── Local move handler ──
  const handleLocalClick = (row, col, isBotMove = false) => {
    if (localBoard[row][col] !== EMPTY) return;
    if (gameOver) return;
    if (botEnabled && localCurrentPlayer === botColor && !isBotMove) return;

    const newBoard = localBoard.map(r => [...r]);
    newBoard[row][col] = localCurrentPlayer;
    setLocalBoard(newBoard);
    setLocalLastMove([row, col]);
    setLocalMoveCount(prev => prev + 1);

    setHintCell(null);
    setHintExplanation(null);

    playPlace();
    triggerRipple(row, col);

    const { newBoard: boardAfterCaptures, capturedPairs, captured } = computeCaptures(
      newBoard, row, col, localCurrentPlayer
    );

    if (capturedPairs > 0) {
      // Animate ejected stones: board state updates immediately (EMPTY),
      // overlay span shows the stone disappearing over 420ms.
      const captureStoneColor = localCurrentPlayer === BLACK ? WHITE : BLACK;
      const caps = new Map();
      for (const [cr, cc] of captured) {
        caps.set(`${cr}-${cc}`, captureStoneColor);
      }
      setCapturedCells(caps);
      setTimeout(() => setCapturedCells(new Map()), 450);

      setLocalBoard(boardAfterCaptures);
      setTimeout(() => { playCapture(); triggerShake(); }, 80);
    }

    const newBlackCaps = localCurrentPlayer === BLACK
      ? localBlackCaptures + capturedPairs
      : localBlackCaptures;
    const newWhiteCaps = localCurrentPlayer === WHITE
      ? localWhiteCaptures + capturedPairs
      : localWhiteCaptures;
    if (localCurrentPlayer === BLACK) setLocalBlackCaptures(newBlackCaps);
    else setLocalWhiteCaptures(newWhiteCaps);

    const finalBoard = capturedPairs > 0 ? boardAfterCaptures : newBoard;
    recordMove(finalBoard, newWhiteCaps, newBlackCaps, localCurrentPlayer, row, col);

    if (newBlackCaps >= 5 || newWhiteCaps >= 5) {
      endLocalGame(localCurrentPlayer);
      return;
    }
    if (checkForFiveInARow(finalBoard, row, col, localCurrentPlayer)) {
      endLocalGame(localCurrentPlayer);
      return;
    }

    setLocalCurrentPlayer(localCurrentPlayer === BLACK ? WHITE : BLACK);
  };

  // ── Online move handler ──
  const handleOnlineClick = async (row, col) => {
    if (!mp.isMyTurn || board[row][col] !== EMPTY) return;
    playPlace();
    triggerRipple(row, col);
    const result = await mp.makeMove(row, col);
    if (result.winner) {
      playWin();
      confetti({
        particleCount: 150, spread: 90, origin: { y: 0.6 },
        colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
      });
    }
  };

  const handleClick = (row, col) => {
    if (isOnline) handleOnlineClick(row, col);
    else handleLocalClick(row, col);
  };

  const endLocalGame = (winningPlayer) => {
    playWin();
    confetti({
      particleCount: 150, spread: 90, origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
    });
    setGameOver(true);
    setWinner(winningPlayer);
    if (winningPlayer === BLACK) setLocalBlackScore(prev => prev + 1);
    else setLocalWhiteScore(prev => prev + 1);
    setGameCount(prev => prev + 1);
  };

  const resetLocalBoard = () => {
    setLocalBoard(createEmptyBoard());
    setLocalCurrentPlayer(BLACK);
    setLocalBlackCaptures(0);
    setLocalWhiteCaptures(0);
    setLocalLastMove(null);
    setLocalMoveCount(0);
    setRippleCell(null);
    setCapturedCells(new Map());
    setTutorEnabled(false);
    setHintCell(null);
    setHintExplanation(null);
    setEvalScore(0);
    setMoveHistory([]);
    setGameOver(false);
    setGameAnalysis(null);
    setAnalysisViewTurn(null);
    setWinner(null);
    setShowRules(false);
  };

  const handleAnalyze = () => {
    const humanColor = botEnabled ? (botColor === BLACK ? WHITE : BLACK) : BLACK;
    setGameAnalysis(tutor.analyzeGameHistory(moveHistory, humanColor));
  };

  const handleToggleTutor = () => {
    const next = !tutorEnabled;
    setTutorEnabled(next);
    if (!next) { setHintCell(null); setHintExplanation(null); }
  };

  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c;
  const isHintCell = (r, c) => hintCell && hintCell.row === r && hintCell.col === c;
  const isBlackTurn = currentPlayer === BLACK;

  const showLobby   = mode === 'online' && !gameId;
  const boardDisabled = isOnline && !mp.isMyTurn;

  const evalClamped = Math.max(-20000, Math.min(20000, evalScore));
  const evalPercent = ((evalClamped + 20000) / 40000) * 100;

  const displayBoard = analysisViewTurn !== null && moveHistory[analysisViewTurn]
    ? moveHistory[analysisViewTurn].board
    : board;

  // ─────────────────────────────────────────────────────────────────────────
  // Header button style helpers
  const modeBtn = (active) =>
    `px-3 py-2 text-xs transition-colors ${
      active
        ? 'bg-forest-700/70 text-white'
        : 'bg-forest-900/60 text-forest-400 hover:text-forest-200'
    }`;

  const actionBtn = (active = false) =>
    `text-xs px-3 py-2 rounded-lg border transition-colors min-h-[36px] ${
      active
        ? 'bg-cyan-900/50 text-cyan-300 border-cyan-600/50'
        : 'bg-forest-900/60 text-forest-400 hover:text-forest-200 border-forest-700/40 hover:border-forest-500'
    }`;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-forest-950 overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <Head>
        <title>Pente | Brooks Roley</title>
        <meta name="description" content="Play Pente — a classic 2-player strategy board game with captures and five-in-a-row." />
        <meta property="og:title" content="Pente | Brooks Roley" />
        <meta property="og:description" content="Play Pente — a classic 2-player strategy board game with captures and five-in-a-row." />
        <meta property="og:image" content="/marathon.png" />
      </Head>

      {/* ══════════════════════════════════════════════════════════════
          COMPACT HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header className="flex-shrink-0 border-b border-forest-800/60 bg-forest-950">

        {/* Row 1 — Mode tabs + action buttons */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-forest-700/40 shrink-0">
            <button
              className={modeBtn(mode === 'local' && !botEnabled)}
              onClick={() => {
                setMode('local');
                setBotEnabled(false);
                resetLocalBoard();
                if (gameId) router.push('/posts/pente', undefined, { shallow: true });
              }}
            >
              Local
            </button>
            <button
              className={`${modeBtn(mode === 'local' && botEnabled)} border-l border-forest-700/40`}
              onClick={() => { setMode('local'); setBotEnabled(true); resetLocalBoard(); }}
            >
              vs Bot
            </button>
            <button
              className={`${modeBtn(mode === 'online')} border-l border-forest-700/40`}
              onClick={() => setMode('online')}
            >
              Online
            </button>
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            {!isOnline && !gameOver && (
              <button
                className={actionBtn(tutorEnabled)}
                onClick={handleToggleTutor}
                disabled={botEnabled && localCurrentPlayer === botColor}
                title={tutorEnabled ? 'Tutor active' : 'Get move hints'}
              >
                {tutorEnabled ? 'Tutor ✦' : 'Tutor'}
              </button>
            )}
            {!isOnline && (
              <button className={actionBtn()} onClick={resetLocalBoard} title="New game">
                New
              </button>
            )}
            <button
              className={actionBtn(showRules)}
              onClick={() => setShowRules(r => !r)}
              title="Rules"
            >
              ?
            </button>
          </div>
        </div>

        {/* Row 2 — Turn indicator + score + captures */}
        {!showLobby && mp.gameStatus !== 'error' && (
          <div className="flex items-center px-3 pb-2 gap-2">
            <div
              className={`turn-dot w-4 h-4 rounded-full border-2 shrink-0 transition-colors duration-300 ${
                isBlackTurn
                  ? 'bg-gray-900 border-gray-500'
                  : 'bg-white border-forest-300'
              }`}
            />
            <span className="text-white text-xs font-semibold leading-none">
              {isBlackTurn ? 'Black' : 'White'}
              {botEnabled && currentPlayer === botColor ? ' (Bot)' : ''}
              {botThinking ? '\u2026' : "\u2019s turn"}
            </span>
            {moveCount > 0 && (
              <span className="text-forest-600 text-xs font-mono">#{moveCount}</span>
            )}

            {/* Score + captures — right-aligned */}
            <div className="ml-auto flex items-center gap-2 text-xs font-mono">
              <span>
                <span className="text-gray-300">{blackScore}</span>
                <span className="text-forest-600 mx-0.5">–</span>
                <span className="text-white">{whiteScore}</span>
              </span>
              <span className="text-forest-700">·</span>
              <span>
                <span className="text-gray-400">⬤{blackCaptures}</span>
                <span className="text-forest-600">/5 </span>
                <span className="text-gray-200">○{whiteCaptures}</span>
                <span className="text-forest-600">/5</span>
              </span>
            </div>
          </div>
        )}

        {/* Multiplayer status */}
        {isOnline && mp.gameStatus !== 'loading' && mp.gameStatus !== 'error' && (
          <div className="px-3 pb-2">
            <MultiplayerStatus
              gameStatus={mp.gameStatus}
              myColor={mp.myColor}
              isMyTurn={mp.isMyTurn}
              winner={mp.winner}
              winReason={mp.winReason}
              playerBlack={mp.playerBlack}
              playerWhite={mp.playerWhite}
              opponentConnected={mp.opponentConnected}
              opponentJustJoined={mp.opponentJustJoined}
              rematch={mp.rematch}
              gameId={gameId}
            />
          </div>
        )}

        {/* Error state */}
        {isOnline && mp.gameStatus === 'error' && (
          <div className="px-3 pb-2 text-red-300 text-xs">
            {mp.error || 'Failed to load game'}
          </div>
        )}

        {/* Hint toast (inline in header, no layout jump) */}
        {hintExplanation && !showLobby && (
          <div className="mx-3 mb-2 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-3 py-2 text-xs flex items-center gap-2">
            <PreText
              text="✦"
              mode="pulse"
              color="#22d3ee"
              fontSize="0.7rem"
              fontWeight="700"
              className="shrink-0"
            />
            <span className="text-cyan-200 flex-1 leading-snug">{hintExplanation}</span>
            <button
              onClick={() => { setHintCell(null); setHintExplanation(null); }}
              className="text-cyan-600 hover:text-cyan-300 ml-1 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Thin eval strip — mobile only */}
        {!isOnline && !showLobby && (
          <div className="md:hidden mx-3 mb-2 h-1.5 rounded-full bg-gray-900 border border-forest-800/40 overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-gray-800 to-gray-500 transition-all duration-500"
              style={{ width: `${100 - evalPercent}%` }}
            />
            <div
              className="bg-gradient-to-l from-white to-gray-300 transition-all duration-500"
              style={{ width: `${evalPercent}%` }}
            />
          </div>
        )}

        {/* Collapsible rules */}
        {showRules && (
          <div className="mx-3 mb-2 rounded-xl bg-forest-900/80 border border-forest-700/40 px-4 py-3">
            <p className="text-xs text-forest-300 mb-2 leading-relaxed">
              19×19 board. First to <strong className="text-forest-100">five-in-a-row</strong> or{' '}
              <strong className="text-forest-100">five captured pairs</strong> wins.
            </p>
            <ul className="text-xs text-forest-400 space-y-1.5">
              <li>
                <strong className="text-forest-200">Capture:</strong>{' '}
                Bracket exactly two opponent stones with yours in a straight line.
              </li>
              <li>
                <strong className="text-forest-200">Five in a row:</strong>{' '}
                Any direction — horizontal, vertical, or diagonal.
              </li>
              <li>
                <strong className="text-forest-200">Pro rule:</strong>{' '}
                First player&rsquo;s second stone must be ≥3 intersections from center.
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════
          BOARD / CONTENT AREA — fills remaining viewport
      ══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-2 sm:p-3">

        {/* Lobby */}
        {showLobby && (
          <div className="w-full max-w-sm px-2">
            <GameLobby
              playerId={playerId}
              playerName={playerName}
              setPlayerName={setPlayerName}
            />
          </div>
        )}

        {/* Game board */}
        {!showLobby && mp.gameStatus !== 'error' && (
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Eval bar — desktop sidebar */}
            {!isOnline && (
              <div className="hidden md:flex flex-col items-center gap-1 shrink-0">
                <span className="text-[10px] text-forest-500 uppercase tracking-wider">Eval</span>
                <div className="w-4 h-52 rounded-full bg-gray-900 border border-forest-700/40 overflow-hidden relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white to-gray-300 transition-all duration-500"
                    style={{ height: `${evalPercent}%` }}
                  />
                  <div
                    className="absolute top-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-700 transition-all duration-500"
                    style={{ height: `${100 - evalPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-forest-500 font-mono">
                  {evalClamped > 0 ? '+' : ''}{(evalClamped / 1000).toFixed(1)}k
                </span>
              </div>
            )}

            {/* The board */}
            <div
              ref={boardRef}
              className={`game-board rounded-xl ${
                isBlackTurn ? 'board-hover-black' : 'board-hover-white'
              } ${boardDisabled ? 'opacity-90' : ''}`}
              style={boardDisabled ? { pointerEvents: 'none' } : undefined}
            >
              {displayBoard.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => {
                    const cellKey = `${rowIndex}-${colIndex}`;
                    const captureColor = capturedCells.get(cellKey);
                    return (
                      <button
                        key={colIndex}
                        className={[
                          'board-cell',
                          cell === BLACK ? 'black' : cell === WHITE ? 'white' : '',
                          isLastMove(rowIndex, colIndex) ? 'last-move' : '',
                          rippleCell === cellKey ? 'ripple' : '',
                          isHintCell(rowIndex, colIndex) ? 'hint-glow' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => handleClick(rowIndex, colIndex)}
                      >
                        {/* Physics eject animation for captured stones */}
                        {captureColor !== undefined && cell === EMPTY && (
                          <span
                            className={`stone-capture ${
                              captureColor === BLACK ? 'capture-black' : 'capture-white'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          GAME-OVER DRAWER — slides up from bottom
      ══════════════════════════════════════════════════════════════ */}
      {gameOver && !isOnline && (
        <div className="flex-shrink-0 border-t border-forest-700/40 bg-forest-900/90 px-4 py-3 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-white">
              {winner === BLACK ? 'Black' : 'White'} Wins!
            </h2>
            <div className="flex gap-2">
              <button
                onClick={resetLocalBoard}
                className="text-xs px-3 py-1.5 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
              >
                Play Again
              </button>
              {moveHistory.length > 0 && !gameAnalysis && (
                <button
                  onClick={handleAnalyze}
                  className="text-xs px-3 py-1.5 rounded-lg bg-cyan-800/40 text-cyan-200 border border-cyan-700/40 hover:bg-cyan-700/40 transition-colors"
                >
                  Analyze
                </button>
              )}
            </div>
          </div>

          {gameAnalysis && (
            <div className="space-y-1">
              {gameAnalysis.map((entry, idx) => {
                const isBlunder = entry.annotation.includes('Blunder');
                const isMistake = entry.annotation.includes('Mistake');
                const isViewing = analysisViewTurn === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setAnalysisViewTurn(isViewing ? null : idx)}
                    className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      isViewing
                        ? 'bg-forest-700/60 border border-forest-500'
                        : isBlunder
                          ? 'bg-red-900/30 border border-red-700/30 hover:bg-red-900/50'
                          : isMistake
                            ? 'bg-yellow-900/20 border border-yellow-700/30 hover:bg-yellow-900/40'
                            : 'bg-forest-900/40 border border-forest-700/20 hover:bg-forest-800/40'
                    }`}
                  >
                    <span className="font-mono text-forest-400 mr-2">#{idx + 1}</span>
                    <span className={`mr-2 ${
                      moveHistory[idx]?.moveMadeBy === BLACK ? 'text-gray-300' : 'text-white'
                    }`}>
                      {moveHistory[idx]?.moveMadeBy === BLACK ? 'Black' : 'White'}
                    </span>
                    <span className={
                      isBlunder ? 'text-red-400 font-semibold' :
                      isMistake ? 'text-yellow-400' :
                      'text-forest-400'
                    }>
                      {entry.annotation}
                    </span>
                    <span className="float-right text-forest-600 font-mono">
                      {(entry.evaluation / 1000).toFixed(1)}k
                    </span>
                  </button>
                );
              })}
              {analysisViewTurn !== null && (
                <p className="text-xs text-forest-500 pt-1">
                  Viewing move #{analysisViewTurn + 1}.{' '}
                  <button
                    onClick={() => setAnalysisViewTurn(null)}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Back to final
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameBoard;
