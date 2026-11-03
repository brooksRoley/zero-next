import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Head from 'next/head';
import useGameTracking from 'src/hooks/useGameTracking';

import { useRouter } from 'next/router';
import GameLobby from 'src/components/GameLobby';
import MultiplayerStatus from 'src/components/MultiplayerStatus';
import confetti from 'canvas-confetti';
import useGameSounds from 'src/hooks/useGameSounds';
import SoundToggle from 'src/components/SoundToggle';
import usePlayerProfile from 'src/hooks/usePlayerProfile';
import useMultiplayerGame from 'src/hooks/useMultiplayerGame';
import { EMPTY, BLACK, WHITE, RED, BLUE, GAME_MODES, PLAYER_COLORS } from 'src/lib/pente/constants';
import { createEmptyBoard, checkForFiveInARow, computeCaptures, getWinningLine } from 'src/lib/pente/gameLogic';
import { PenteBot, BOT_LEVELS } from 'src/components/PentePlayerbot';
import { BotWorkerManager } from 'src/lib/pente/botWorker';
import { getAdaptiveBotConfig } from 'src/lib/pente/adaptiveBot';
import { PenteTutor } from 'src/components/PenteTutor';
import PenteTopNav from 'src/components/pente/PenteTopNav';
import StillField from 'src/components/pente/StillField';
import InterventionCard from 'src/components/pente/InterventionCard';
import UpdatesCard from 'src/components/UpdatesCard';
import EndlessPuzzle from 'src/components/EndlessPuzzle';
import { analyzeLoss } from 'src/lib/pente/blunderAnalyzer';
import { logGameResult } from 'src/lib/pente/gameResults';
import useMatchmaking from 'src/hooks/useMatchmaking';
import QueueBanner from 'src/components/pente/QueueBanner';
import MatchConfirmModal from 'src/components/pente/MatchConfirmModal';
import useBoardTheme from 'src/hooks/useBoardTheme';
import BoardCustomizer from 'src/components/pente/BoardCustomizer';
import TurnStatusBar from 'src/components/pente/TurnStatusBar';
import RulesPanel from 'src/components/pente/RulesPanel';
import GameOverDrawer from 'src/components/pente/GameOverDrawer';
import {
  cellClass,
  captureClass,
  hoverClass,
  MODE_PRESETS,
  modeBtnClass,
  actionBtnClass,
} from 'src/lib/pente/boardDisplay';

const GameBoard = () => {
  const router = useRouter();
  const gameId = router.query.game;

  // Player identity + shared ELO
  const { playerId, playerName, setPlayerName, puzzleElo, puzzlePeakElo, gameElo, eloHistory, gamesPlayed, markSolved, recordAttempt, recordGameResult } = usePlayerProfile();

  // ── Core mode state ──
  const [modePreset, setModePreset] = useState(gameId ? 'online' : 'bot1v1');
  const isOnlinePreset = modePreset === 'online';
  const mode = isOnlinePreset ? 'online' : 'local';

  // ── Local game state ──
  const [localBoard, setLocalBoard] = useState(() => createEmptyBoard());
  const [localCurrentPlayer, setLocalCurrentPlayer] = useState(BLACK);
  const [scores, setScores] = useState({});    // { [player]: gamesWon }
  const [captures, setCaptures] = useState({}); // { [player]: pairsCount } or { teamN: count }
  const [, setGameCount] = useState(0);
  const [localLastMove, setLocalLastMove] = useState(null);
  const [localMoveCount, setLocalMoveCount] = useState(0);
  const [rippleCell, setRippleCell] = useState(null);

  // Capture-eject animation: Map<"row-col", playerColor>
  const [capturedCells, setCapturedCells] = useState(() => new Map());
  // Touch-preview: cell key currently under finger, e.g. "9-9"
  const [touchPreviewCell, setTouchPreviewCell] = useState(null);

  // ── Game mode + Bot state ──
  const defaultBotMode = !gameId;
  const [gameMode, setGameMode] = useState(() => defaultBotMode ? GAME_MODES.classic : null);
  const [botInstances, setBotInstances] = useState(() =>
    defaultBotMode ? [new PenteBot(WHITE, 'expert', GAME_MODES.classic)] : []
  );
  const [botThinking, setBotThinking] = useState(false);
  const [humanColor] = useState(BLACK); // human is always Black
  const [lastBotStats, setLastBotStats] = useState(null); // { depth, nodes } from last engine move
  const [botEffectiveElo, setBotEffectiveElo] = useState(null);

  const botEnabled = botInstances.length > 0;

  // ── Web Worker engine (minimax) ──
  const workerRef = useRef(null);
  useEffect(() => {
    workerRef.current = new BotWorkerManager();
    return () => { workerRef.current?.terminate(); };
  }, []);

  // ── Tutor state ──
  const tutor = useMemo(() => new PenteTutor(), []);
  const [tutorEnabled, setTutorEnabled] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [hintCell, setHintCell] = useState(null);
  const [hintExplanation, setHintExplanation] = useState(null);

  // ── UI state ──
  const [showRules, setShowRules] = useState(false);

  // ── Board customization (per-device skin / stones / motion) ──
  const { prefs: boardPrefs, updatePrefs: updateBoardPrefs } = useBoardTheme();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [themeWarp, setThemeWarp] = useState(false);
  const warpTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(warpTimerRef.current), []);

  const handleBoardPrefsChange = useCallback((patch) => {
    if (patch.theme) {
      // Brief perspective warp so the skin swap feels like a transition, not a repaint
      setThemeWarp(false);
      clearTimeout(warpTimerRef.current);
      requestAnimationFrame(() => {
        setThemeWarp(true);
        warpTimerRef.current = setTimeout(() => setThemeWarp(false), 600);
      });
    }
    updateBoardPrefs(patch);
  }, [updateBoardPrefs]);

  // Winning five-in-a-row cells, for the win-line animation
  const [winningLine, setWinningLine] = useState(null);
  const winningCells = useMemo(() => {
    const m = new Map();
    if (winningLine) winningLine.forEach(([r, c], i) => m.set(`${r}-${c}`, i));
    return m;
  }, [winningLine]);

  // ── Move history (post-game analysis) ──
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameAnalysis, setGameAnalysis] = useState(null);
  const [analysisViewTurn, setAnalysisViewTurn] = useState(null);
  const [winner, setWinner] = useState(null);
  // Bumped when a game finishes to arm the one-shot post-win tip banner.
  const [winSignal, setWinSignal] = useState(0);
  const [consultingCtaDismissed, setConsultingCtaDismissed] = useState(false);
  const [intervention, setIntervention] = useState(null); // { blunderIndex, blunderCell, tactic, tacticLabel, narrative, puzzleCategory }
  const [trainingActive, setTrainingActive] = useState(false);

  // ── Multiplayer state ──
  const mp = useMultiplayerGame(
    mode === 'online' ? gameId : null,
    playerId,
    playerName
  );

  // ── Matchmaking state ──
  const mm = useMatchmaking(playerId, playerName, gameElo);
  const isQueuing = mm.queueStatus === 'queuing' || mm.queueStatus === 'confirming';

  // ── Derived state ──
  const isOnline = mode === 'online' && gameId;
  const board = isOnline ? mp.board : localBoard;
  const currentPlayer = isOnline ? mp.currentPlayer : localCurrentPlayer;
  const lastMove = isOnline ? mp.lastMove : localLastMove;
  const moveCount = isOnline ? mp.moveCount : localMoveCount;

  useGameTracking('pente', {
    moveCount,
    finished: gameOver,
    getStartMeta: () => ({
      mode: gameMode?.key ?? 'classic',
      opponent: isOnline ? 'online' : botEnabled ? 'bot' : 'local',
    }),
    getEndMeta: () => ({
      mode: gameMode?.key ?? 'classic',
      opponent: isOnline ? 'online' : botEnabled ? 'bot' : 'local',
      result: !botEnabled || isOnline ? 'n/a' : winner === humanColor ? 'win' : 'loss',
    }),
  });

  // Backward-compat derived captures for online + classic display
  const blackCaptures = isOnline ? mp.blackCaptures : (captures[BLACK] || 0);
  const whiteCaptures = isOnline ? mp.whiteCaptures : (captures[WHITE] || 0);
  const blackScore = isOnline ? mp.blackScore : (scores[BLACK] || 0);
  const whiteScore = isOnline ? mp.whiteScore : (scores[WHITE] || 0);

  // Active players list
  const activePlayers = gameMode ? gameMode.turnOrder : [BLACK, WHITE];

  const boardRef = useRef(null);
  const handleClickRef = useRef(null);
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

  // Haptic feedback — a single short pulse when a stone snaps into place
  const vibrate = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  // ── Touch handling for mobile drag-to-preview ──
  // Find which board-cell button is under a touch point
  const cellFromTouch = useCallback((touch) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el || !el.classList.contains('board-cell')) return null;
    // Read row/col from data attributes
    const row = el.dataset.row;
    const col = el.dataset.col;
    if (row == null || col == null) return null;
    return { row: parseInt(row, 10), col: parseInt(col, 10) };
  }, []);

  const handleTouchStart = useCallback((e) => {
    const cell = cellFromTouch(e.touches[0]);
    if (!cell) return;
    const b = isOnline ? mp.board : localBoard;
    if (b[cell.row][cell.col] === EMPTY) {
      setTouchPreviewCell(`${cell.row}-${cell.col}`);
    }
  }, [cellFromTouch, isOnline, mp.board, localBoard]);

  const handleTouchMove = useCallback((e) => {
    const cell = cellFromTouch(e.touches[0]);
    if (!cell) { setTouchPreviewCell(null); return; }
    const b = isOnline ? mp.board : localBoard;
    const key = `${cell.row}-${cell.col}`;
    if (b[cell.row][cell.col] === EMPTY) {
      setTouchPreviewCell(prev => prev !== key ? key : prev);
    } else {
      setTouchPreviewCell(null);
    }
  }, [cellFromTouch, isOnline, mp.board, localBoard]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchPreviewCell) return;
    const [row, col] = touchPreviewCell.split('-').map(Number);
    setTouchPreviewCell(null);
    // Use ref to avoid forward-reference issue with handleClick (defined later)
    if (handleClickRef.current) handleClickRef.current(row, col);
    vibrate();
    e.preventDefault();
  }, [touchPreviewCell, vibrate]);

  // ── Evaluation bar (classic only) ──
  useEffect(() => {
    if (!isOnline && !gameOver && (!gameMode || gameMode.key === 'classic')) {
      const score = tutor.evaluateBoardState(localBoard, whiteCaptures, blackCaptures);
      setEvalScore(score);
    }
  }, [localBoard, whiteCaptures, blackCaptures, isOnline, gameOver, gameMode, tutor]);

  // ── Auto-hint when tutor is enabled (classic only) ──
  useEffect(() => {
    if (!tutorEnabled || gameOver || isOnline) return;
    if (gameMode && gameMode.key !== 'classic') return; // tutor only in classic
    if (botEnabled && localCurrentPlayer !== humanColor) return;
    const playerCaps = localCurrentPlayer === BLACK ? blackCaptures : whiteCaptures;
    const oppCaps    = localCurrentPlayer === BLACK ? whiteCaptures : blackCaptures;
    const hint = tutor.getHint(
      localBoard.map(r => [...r]),
      localCurrentPlayer,
      playerCaps,
      oppCaps
    );
    setHintCell(hint.suggestedMove);
    setHintExplanation(hint.explanation);
     
  }, [tutorEnabled, localCurrentPlayer, localBoard, blackCaptures, whiteCaptures, gameOver, isOnline, botEnabled, humanColor, gameMode, tutor]);

  // ── Bot auto-play (Web Worker minimax engine) ──
  useEffect(() => {
    if (!botEnabled || isOnline || gameOver) return;
    if (localCurrentPlayer === humanColor) return; // human's turn
    if (!workerRef.current) return;

    const currentBot = botInstances.find(b => b.botColor === localCurrentPlayer);
    if (!currentBot) return;

    let cancelled = false;
    setBotThinking(true);

    // Small delay before thinking starts so the UI feels natural
    const delay = 200 + Math.random() * 150;
    const timer = setTimeout(async () => {
      const adaptiveConfig = getAdaptiveBotConfig(gameElo, gamesPlayed);
      setBotEffectiveElo(adaptiveConfig.effectiveElo);
      const engineConfig = {
        searchDepth: adaptiveConfig.searchDepth,
        timeBudgetMs: adaptiveConfig.timeBudgetMs,
        blunderRate: adaptiveConfig.blunderRate,
      };

      const move = await workerRef.current.findMove(
        localBoard.map(r => [...r]),
        localCurrentPlayer,
        { ...captures },
        engineConfig,
        gameMode,
        adaptiveConfig.timeBudgetMs + 2000, // hard timeout = budget + 2s grace
      );

      if (cancelled) return;

      if (move) {
        setLastBotStats({ depth: move.depth, nodes: move.nodes });
        handleLocalClick(move.row, move.col, true);
      }
      setBotThinking(false);
    }, delay);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCurrentPlayer, botEnabled, isOnline, gameOver, botInstances, localBoard, captures, gameElo, gamesPlayed, gameMode]);

  // ── Record move history ──
  const recordMove = useCallback((boardState, capturesState, mover, row, col) => {
    setMoveHistory(prev => [...prev, {
      board: boardState.map(r => [...r]),
      captures: { ...capturesState },
      whiteCaptures: capturesState[WHITE] || 0,
      blackCaptures: capturesState[BLACK] || 0,
      moveMadeBy: mover,
      row, col,
    }]);
  }, []);

  // ── Local move handler ──
  const handleLocalClick = useCallback((row, col, isBotMove = false) => {
    if (localBoard[row][col] !== EMPTY) return;
    if (gameOver) return;
    if (botEnabled && localCurrentPlayer === humanColor && isBotMove) return; // bot shouldn't make human's move
    if (botEnabled && localCurrentPlayer !== humanColor && !isBotMove) return; // human shouldn't make bot's move

    const currentMode = gameMode;

    const newBoard = localBoard.map(r => [...r]);
    newBoard[row][col] = localCurrentPlayer;
    setLocalBoard(newBoard);
    setLocalLastMove([row, col]);
    setLocalMoveCount(prev => prev + 1);

    setHintCell(null);
    setHintExplanation(null);

    playPlace();
    vibrate();
    triggerRipple(row, col);

    const { newBoard: boardAfterCaptures, capturedPairs, captured } = computeCaptures(
      newBoard, row, col, localCurrentPlayer, currentMode
    );

    if (capturedPairs > 0) {
      // Determine the color of captured stones (they're all same color per the capture rule)
      const captureStoneColor = captured.length > 0 ? newBoard[captured[0][0]][captured[0][1]] : BLACK;
      const caps = new Map();
      for (const [cr, cc] of captured) {
        caps.set(`${cr}-${cc}`, captureStoneColor);
      }
      setCapturedCells(caps);
      setTimeout(() => setCapturedCells(new Map()), 450);

      setLocalBoard(boardAfterCaptures);
      setTimeout(() => { playCapture(); triggerShake(); }, 80);
    }

    // Update captures
    const newCaptures = { ...captures };
    if (currentMode?.teams) {
      const teamIdx = currentMode.teams.findIndex(t => t.includes(localCurrentPlayer));
      const key = `team${teamIdx}`;
      newCaptures[key] = (newCaptures[key] || 0) + capturedPairs;
    } else {
      newCaptures[localCurrentPlayer] = (newCaptures[localCurrentPlayer] || 0) + capturedPairs;
    }
    setCaptures(newCaptures);

    const finalBoard = capturedPairs > 0 ? boardAfterCaptures : newBoard;
    recordMove(finalBoard, newCaptures, localCurrentPlayer, row, col);

    // Check win by captures
    const threshold = currentMode?.captureThreshold || 5;
    let won = false;
    if (currentMode?.teams) {
      const teamIdx = currentMode.teams.findIndex(t => t.includes(localCurrentPlayer));
      if ((newCaptures[`team${teamIdx}`] || 0) >= threshold) won = true;
    } else {
      if ((newCaptures[localCurrentPlayer] || 0) >= threshold) won = true;
    }

    if (won) {
      endLocalGame(localCurrentPlayer);
      return;
    }
    if (checkForFiveInARow(finalBoard, row, col, localCurrentPlayer)) {
      setWinningLine(getWinningLine(finalBoard, row, col, localCurrentPlayer));
      endLocalGame(localCurrentPlayer);
      return;
    }

    // Next player
    const turnOrder = currentMode ? currentMode.turnOrder : [BLACK, WHITE];
    const idx = turnOrder.indexOf(localCurrentPlayer);
    const next = turnOrder[(idx + 1) % turnOrder.length];
    setLocalCurrentPlayer(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBoard, localCurrentPlayer, gameOver, botEnabled, humanColor, gameMode, captures, playPlace, playCapture, vibrate, triggerRipple, triggerShake, recordMove]);

  // ── Online move handler ──
  const handleOnlineClick = async (row, col) => {
    if (!mp.isMyTurn || board[row][col] !== EMPTY) return;
    playPlace();
    vibrate();
    triggerRipple(row, col);
    const result = await mp.makeMove(row, col);
    if (result.winner) {
      playWin();
      setWinSignal(s => s + 1);
      confetti({
        particleCount: 150, spread: 90, origin: { y: 0.6 },
        colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
      });
    }
  };

  const handleClick = useCallback((row, col) => {
    if (isOnline) handleOnlineClick(row, col);
    else handleLocalClick(row, col);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, handleLocalClick]);
  handleClickRef.current = handleClick;

  const endLocalGame = (winningPlayer) => {
    playWin();
    confetti({
      particleCount: 150, spread: 90, origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
    });
    setGameOver(true);
    setWinner(winningPlayer);
    setWinSignal(s => s + 1);
    setScores(prev => ({ ...prev, [winningPlayer]: (prev[winningPlayer] || 0) + 1 }));
    setGameCount(prev => prev + 1);

    // Record ELO change for bot games
    let humanWon = true;
    if (botEnabled && recordGameResult) {
      humanWon = winningPlayer === humanColor;
      // Bot strength for the ELO update. Never fall back to the player's own
      // rating — that made every game a coin-flip delta regardless of bot
      // difficulty. Prefer the adaptive engine's effective ELO from this game;
      // if the bot never got to compute one, recompute it, and as a last
      // resort use the bot instance's fixed BOT_LEVELS rating.
      const adaptiveElo = botEffectiveElo ?? getAdaptiveBotConfig(gameElo, gamesPlayed).effectiveElo;
      const botElo = Number.isFinite(adaptiveElo)
        ? adaptiveElo
        : (botInstances[0]?.level?.elo ?? BOT_LEVELS.expert.elo);
      const eloResult = recordGameResult(botElo, humanWon);

      // Persist the completed game for history/replay (best-effort; no-ops until
      // migration 0004 adds game_results). See src/lib/pente/gameResults.js.
      logGameResult({
        player_id: playerId,
        opponent_type: 'bot',
        bot_level: botInstances[0]?.level?.label || null,
        game_mode: gameMode?.key || 'classic',
        winner: humanWon ? 'player' : 'opponent',
        elo_before: eloResult?.eloBefore ?? null,
        elo_after: eloResult?.eloAfter ?? null,
        moves: moveHistory,
      });
    }

    // Post-mortem intervention: if the human lost a bot game in classic mode,
    // run the blunder analyzer and open the tactical card.
    if (botEnabled && !humanWon && (!gameMode || gameMode.key === 'classic')) {
      try {
        const analysis = tutor.analyzeGameHistory(moveHistory, humanColor);
        const diagnosis = analyzeLoss({
          moveHistory,
          gameAnalysis: analysis,
          humanColor,
          winner: winningPlayer,
        });
        if (diagnosis) {
          setGameAnalysis(analysis); // surface the annotated per-move list in the drawer too
          setIntervention(diagnosis);
        }
      } catch (_) { /* analyzer is best-effort */ }
    }
  };

  const resetLocalBoard = () => {
    setLocalBoard(createEmptyBoard());
    setLocalCurrentPlayer(BLACK);
    setCaptures({});
    setLocalLastMove(null);
    setLocalMoveCount(0);
    setRippleCell(null);
    setCapturedCells(new Map());
    setTouchPreviewCell(null);
    setLastBotStats(null);
    setTutorEnabled(false);
    setHintCell(null);
    setHintExplanation(null);
    setEvalScore(0);
    setWinningLine(null);
    setMoveHistory([]);
    setGameOver(false);
    setGameAnalysis(null);
    setAnalysisViewTurn(null);
    setWinner(null);
    setIntervention(null);
    setTrainingActive(false);
    setShowRules(false);
  };

  // Switch game mode preset
  const switchPreset = (presetKey) => {
    const preset = MODE_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;

    setModePreset(presetKey);

    if (presetKey === 'online') {
      // Start adaptive bot game while queuing
      setGameMode(null);
      const bots = [new PenteBot(WHITE, 'expert', null)];
      setBotInstances(bots);
      resetLocalBoard();
      // Enter matchmaking queue
      mm.enterQueue();
      if (gameId) router.push('/posts/pente', undefined, { shallow: true });
      return;
    }

    if (presetKey === 'local') {
      setGameMode(null);
      setBotInstances([]);
      resetLocalBoard();
      if (gameId) router.push('/posts/pente', undefined, { shallow: true });
      return;
    }

    // Bot modes
    const newMode = preset.modeKey ? GAME_MODES[preset.modeKey] : null;
    setGameMode(newMode);

    // Create bot instances for non-human players
    const turnOrder = newMode ? newMode.turnOrder : [BLACK, WHITE];
    const bots = turnOrder
      .filter(c => c !== humanColor)
      .map(c => new PenteBot(c, 'expert', newMode));
    setBotInstances(bots);

    resetLocalBoard();
  };

  // When a match is accepted and we have a game ID, navigate to it
  useEffect(() => {
    if (mm.queueStatus === 'idle' && mm.matchedGameId) {
      // Match was accepted — switch to online game
      setBotInstances([]);
      setBotThinking(false);
      setModePreset('online');
      router.push(`/posts/pente?game=${mm.matchedGameId}`, undefined, { shallow: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.queueStatus, mm.matchedGameId]);

  const handleLeaveQueue = useCallback(() => {
    mm.leaveQueue();
    setBotInstances([]);
    setBotThinking(false);
    resetLocalBoard();
    setModePreset('local');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.leaveQueue]);

  const handleAnalyze = () => {
    const hColor = botEnabled ? humanColor : BLACK;
    setGameAnalysis(tutor.analyzeGameHistory(moveHistory, hColor));
  };

  const handleToggleTutor = () => {
    const next = !tutorEnabled;
    setTutorEnabled(next);
    if (!next) { setHintCell(null); setHintExplanation(null); }
  };

  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c;
  const isHintCell = (r, c) => hintCell && hintCell.row === r && hintCell.col === c;

  const showLobby = mode === 'online' && !gameId && !isQueuing;
  const boardDisabled = isOnline && !mp.isMyTurn;

  const evalClamped = Math.max(-20000, Math.min(20000, evalScore));
  const evalPercent = ((evalClamped + 20000) / 40000) * 100;

  const displayBoard = analysisViewTurn !== null && moveHistory[analysisViewTurn]
    ? moveHistory[analysisViewTurn].board
    : board;

  const playerName_ = PLAYER_COLORS[currentPlayer]?.name || 'Unknown';
  const showEval = !isOnline && !showLobby && (!gameMode || gameMode.key === 'classic');

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="pente-zen terrain-page-bg flex flex-col overflow-hidden relative"
      style={{ height: '100dvh' }}
    >
      <Head>
        <title>Pente | Brooks Roley</title>
        <meta name="description" content="Play Pente — a classic strategy board game with captures and five-in-a-row. 1v1, vs bots, FFA, and 2v2 team modes." />
        <meta property="og:title" content="Pente | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Play Pente — a classic strategy board game with captures and five-in-a-row." key="og:description" />
        <meta property="og:image" content="/marathon.png" key="og:image" />
      </Head>

      <div aria-hidden className="absolute inset-0 pointer-events-none z-0">
        <StillField boardRef={boardRef} rippleCell={rippleCell} />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
      <PenteTopNav active="game" heading tagline="Five in a row, or capture five pairs, wins." />

      <BoardCustomizer
        open={showCustomizer}
        prefs={boardPrefs}
        onChange={handleBoardPrefsChange}
        onClose={() => setShowCustomizer(false)}
      />

      {/* ══════════════════════════════════════════════════════════════
          COMPACT HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header className="flex-shrink-0 mx-auto w-full max-w-5xl">

        {/* Row 1 — Mode tabs + action buttons. Wraps on phones so New and
            Rules stay on screen; the tabs scroll sideways if they run out of room. */}
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-1.5">
          {/* Mode tabs */}
          <div
            className="flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-full bg-[#E9E3D6]/[0.05] p-0.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {MODE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                className={modeBtnClass(modePreset === preset.key)}
                aria-pressed={modePreset === preset.key}
                onClick={() => switchPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {!isOnline && !gameOver && (!gameMode || gameMode.key === 'classic') && (
              <button
                className={actionBtnClass(tutorEnabled)}
                onClick={handleToggleTutor}
                aria-pressed={tutorEnabled}
                disabled={botEnabled && localCurrentPlayer !== humanColor}
                title={tutorEnabled ? 'Tutor active' : 'Get move hints'}
              >
                Tutor
              </button>
            )}
            {!isOnline && (
              <button className={actionBtnClass()} onClick={resetLocalBoard} title="New game">
                New
              </button>
            )}
            <SoundToggle className={actionBtnClass()} />
            <button
              className={actionBtnClass(showCustomizer)}
              onClick={() => setShowCustomizer(s => !s)}
              aria-pressed={showCustomizer}
              aria-label="Board style"
              title="Board style"
            >
              Style
            </button>
            <button
              className={actionBtnClass(showRules)}
              onClick={() => setShowRules(r => !r)}
              aria-pressed={showRules}
              title="Rules"
            >
              Rules
            </button>
          </div>
        </div>

        {/* Adaptive bot ELO display (bot modes only) */}
        {botEnabled && !gameOver && (
          <p className="flex flex-wrap items-baseline gap-x-2 px-3 pb-1 font-mono text-xs text-ink-400">
            <span className="uppercase tracking-[0.2em]">Bot</span>
            <span className="text-ink-300">~{botEffectiveElo ?? getAdaptiveBotConfig(gameElo, gamesPlayed).effectiveElo}</span>
            {gamesPlayed < 5 && (
              <span>calibrating, {5 - gamesPlayed} games to go</span>
            )}
          </p>
        )}

        {/* Queue banner — shown while matchmaking */}
        {isQueuing && (
          <QueueBanner onLeave={handleLeaveQueue} />
        )}

        {/* Row 2 — Turn indicator + score + captures */}
        <TurnStatusBar
          showLobby={showLobby}
          gameStatus={mp.gameStatus}
          currentPlayer={currentPlayer}
          playerName={playerName_}
          botEnabled={botEnabled}
          humanColor={humanColor}
          botThinking={botThinking}
          moveCount={moveCount}
          lastBotStats={lastBotStats}
          showEngineStats={tutorEnabled}
          activePlayers={activePlayers}
          gameMode={gameMode}
          captures={captures}
        />

        {/* First move: one instruction, on every screen size. The nav's goal
            line is hidden below md, so a phone player otherwise sees only
            "Black's turn" over an empty board. */}
        {moveCount === 0 && !gameOver && !isOnline && !showLobby && (
          <p data-testid="pente-first-move" className="px-3 pb-2 text-xs text-[#E9E3D6]/80">
            Place a stone on any point. Five in a row, or five captured pairs, wins.
          </p>
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

        {/* Hint toast */}
        {hintExplanation && !showLobby && (
          <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-[#E9E3D6]/[0.06] px-4 py-2 text-xs">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass-400" aria-hidden />
            <span className="flex-1 leading-snug text-[#E9E3D6]/85">{hintExplanation}</span>
            <button
              onClick={() => { setHintCell(null); setHintExplanation(null); }}
              aria-label="Dismiss hint"
              className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:text-[#E9E3D6]"
            >
              &times;
            </button>
          </div>
        )}

        {/* Thin eval strip — mobile only (classic mode) */}
        {showEval && (
          <div className="md:hidden mx-3 mb-2 flex h-0.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-[#E9E3D6]/[0.12] transition-all duration-500" style={{ width: `${100 - evalPercent}%` }} />
            <div className="bg-[#E9E3D6]/55 transition-all duration-500" style={{ width: `${evalPercent}%` }} />
          </div>
        )}

        {/* Collapsible rules */}
        {showRules && <RulesPanel gameMode={gameMode} />}
      </header>

      {/* ══════════════════════════════════════════════════════════════
          BOARD / CONTENT AREA
      ══════════════════════════════════════════════════════════════ */}
      {/* Top-aligned: centred, a 19×19 board that is as wide as the screen
          floated mid-height on phones, and on desktop the page sits under the
          site nav (100dvh plus the nav), so "centre" fell below the fold. */}
      <main className="flex-1 min-h-0 flex items-start justify-center overflow-hidden p-2 sm:p-3 md:pt-5">

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
          <div className="flex items-center gap-5 sm:gap-8">

            {/* Eval bar — desktop sidebar (classic only) */}
            {showEval && (
              <div className="hidden md:flex flex-col items-center gap-2 shrink-0" title="Engine evaluation: White up, Black down">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">Eval</span>
                <div className="relative h-52 w-px overflow-hidden rounded-full bg-[#E9E3D6]/20">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#E9E3D6]/70 transition-all duration-500"
                    style={{ height: `${evalPercent}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-ink-400">
                  {evalClamped > 0 ? '+' : ''}{(evalClamped / 1000).toFixed(1)}k
                </span>
              </div>
            )}

            {/* The board */}
            <div className="relative">
            <div
              ref={boardRef}
              data-theme={boardPrefs.theme}
              data-stones={boardPrefs.stones}
              data-effects={boardPrefs.effects}
              className={`game-board rounded-2xl ${hoverClass(currentPlayer)} ${boardDisabled ? 'opacity-90' : ''} ${intervention && !trainingActive ? 'shattered' : ''} ${themeWarp ? 'theme-warp' : ''}`}
              style={boardDisabled || (intervention && !trainingActive) ? { pointerEvents: 'none' } : undefined}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {displayBoard.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  {row.map((cell, colIndex) => {
                    const cellKey = `${rowIndex}-${colIndex}`;
                    const captureColor = capturedCells.get(cellKey);
                    const isBlunder = intervention && !trainingActive
                      && intervention.blunderCell?.row === rowIndex
                      && intervention.blunderCell?.col === colIndex;
                    // Win-line sweep only applies to the live final board, not history views
                    const winIdx = analysisViewTurn === null ? winningCells.get(cellKey) : undefined;
                    return (
                      <button
                        key={colIndex}
                        data-row={rowIndex}
                        data-col={colIndex}
                        className={[
                          'board-cell',
                          cellClass(cell),
                          isLastMove(rowIndex, colIndex) ? 'last-move' : '',
                          rippleCell === cellKey ? 'ripple' : '',
                          isHintCell(rowIndex, colIndex) ? 'hint-glow' : '',
                          touchPreviewCell === cellKey ? 'touch-preview' : '',
                          isBlunder ? 'blunder-glow' : '',
                          winIdx !== undefined ? 'win-stone' : '',
                        ].filter(Boolean).join(' ')}
                        style={winIdx !== undefined ? { '--win-delay': `${winIdx * 90}ms` } : undefined}
                        onClick={() => handleClick(rowIndex, colIndex)}
                      >
                        {/* Physics eject animation for captured stones */}
                        {captureColor !== undefined && cell === EMPTY && (
                          <span className={`stone-capture ${captureClass(captureColor)}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Tactical intervention: dim board + slide in post-mortem card */}
            <InterventionCard
              visible={!!intervention && !trainingActive}
              tacticLabel={intervention?.tacticLabel}
              narrative={intervention?.narrative}
              trainingElo={puzzleElo}
              onTrain={() => setTrainingActive(true)}
              onDismiss={() => setIntervention(null)}
              onPlayAgain={() => { setIntervention(null); resetLocalBoard(); }}
            />

            {/* In-page training puzzle mount — no reload, same surface */}
            {trainingActive && intervention && (
              <div className="absolute inset-0 z-40 rounded-2xl overflow-auto bg-[#141F30]/95 backdrop-blur-sm p-4 sm:p-5">
                <EndlessPuzzle
                  playerId={playerId}
                  elo={puzzleElo}
                  peakElo={puzzlePeakElo}
                  eloHistory={eloHistory}
                  onSolve={markSolved}
                  onAttempt={recordAttempt}
                  onBack={() => {
                    setTrainingActive(false);
                    setIntervention(null);
                  }}
                  initialCategory={intervention.puzzleCategory}
                  introTacticLabel={intervention.tacticLabel}
                />
              </div>
            )}
            {/* Match confirm overlay */}
            {mm.queueStatus === 'confirming' && (
              <MatchConfirmModal
                opponent={mm.opponent}
                confirmTimer={mm.confirmTimer}
                onAccept={mm.acceptMatch}
                onDecline={mm.declineMatch}
              />
            )}
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          GAME-OVER DRAWER
      ══════════════════════════════════════════════════════════════ */}
      <GameOverDrawer
        gameOver={gameOver}
        isOnline={isOnline}
        winner={winner}
        gameMode={gameMode}
        resetLocalBoard={resetLocalBoard}
        moveHistory={moveHistory}
        gameAnalysis={gameAnalysis}
        handleAnalyze={handleAnalyze}
        analysisViewTurn={analysisViewTurn}
        setAnalysisViewTurn={setAnalysisViewTurn}
        consultingCtaDismissed={consultingCtaDismissed}
        setConsultingCtaDismissed={setConsultingCtaDismissed}
        botEnabled={botEnabled}
        humanColor={humanColor}
      />
      {/* Post-multiplayer game result */}
      {isOnline && mp.gameStatus === 'finished' && (
        <div className="flex-shrink-0 bg-[#141F30]/80 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E9E3D6] flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: mp.winner === 1 ? '#1a1a1a' : '#fff' }}
              />
              {mp.winner === mp.myColor ? 'You Win!' : 'You Lost'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Re-queue: go back to bot-while-waiting
                  router.push('/posts/pente', undefined, { shallow: true });
                  setModePreset('online');
                  const bots = [new PenteBot(WHITE, 'expert', null)];
                  setBotInstances(bots);
                  resetLocalBoard();
                  mm.enterQueue();
                }}
                className="text-xs px-4 py-2 rounded-full bg-[#966F2F]/80 text-white font-semibold hover:bg-[#966F2F] transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  router.push('/posts/pente', undefined, { shallow: true });
                  setModePreset('local');
                  setGameMode(null);
                  setBotInstances([]);
                  resetLocalBoard();
                }}
                className="text-xs px-4 py-2 rounded-full bg-[#E9E3D6]/[0.08] text-[#E9E3D6] hover:bg-[#E9E3D6]/[0.14] transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <UpdatesCard trigger={winSignal} page="/posts/pente" />
    </div>
  );
};

export default GameBoard;
