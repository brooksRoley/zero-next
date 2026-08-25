import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { track } from 'src/lib/analytics';

import { useRouter } from 'next/router';
import GameLobby from 'src/components/GameLobby';
import MultiplayerStatus from 'src/components/MultiplayerStatus';
import confetti from 'canvas-confetti';
import useGameSounds from 'src/hooks/useGameSounds';
import usePlayerProfile from 'src/hooks/usePlayerProfile';
import useMultiplayerGame from 'src/hooks/useMultiplayerGame';
import { EMPTY, BLACK, WHITE, RED, BLUE, GAME_MODES, PLAYER_COLORS } from 'src/lib/pente/constants';
import { createEmptyBoard, checkForFiveInARow, computeCaptures, getWinningLine } from 'src/lib/pente/gameLogic';
import { PenteBot, BOT_LEVELS } from 'src/components/PentePlayerbot';
import { BotWorkerManager } from 'src/lib/pente/botWorker';
import { getAdaptiveBotConfig } from 'src/lib/pente/adaptiveBot';
import { PenteTutor } from 'src/components/PenteTutor';
import PreText from 'src/components/PreText';
import PenteTopNav from 'src/components/pente/PenteTopNav';
import SolarField from 'src/components/pente/SolarField';
import InterventionCard from 'src/components/pente/InterventionCard';
import PostSolveTip from 'src/components/pente/PostSolveTip';
import EndlessPuzzle from 'src/components/EndlessPuzzle';
import { analyzeLoss } from 'src/lib/pente/blunderAnalyzer';
import { logGameResult } from 'src/lib/pente/gameResults';
import { getZone } from 'src/lib/pente/elo';
import useMatchmaking from 'src/hooks/useMatchmaking';
import QueueBanner from 'src/components/pente/QueueBanner';
import MatchConfirmModal from 'src/components/pente/MatchConfirmModal';
import useBoardTheme from 'src/hooks/useBoardTheme';
import BoardCustomizer from 'src/components/pente/BoardCustomizer';

// Map cell value to CSS class
function cellClass(cell) {
  switch (cell) {
    case BLACK: return 'black';
    case WHITE: return 'white';
    case RED:   return 'red';
    case BLUE:  return 'blue';
    default:    return '';
  }
}

// Map cell value to capture-eject CSS class
function captureClass(color) {
  switch (color) {
    case BLACK: return 'capture-black';
    case WHITE: return 'capture-white';
    case RED:   return 'capture-red';
    case BLUE:  return 'capture-blue';
    default:    return 'capture-black';
  }
}

// Get hover class for current player
function hoverClass(player) {
  return `board-hover-${PLAYER_COLORS[player]?.css || 'black'}`;
}

// Game mode presets for the mode selector
const MODE_PRESETS = [
  { key: 'local', label: 'Local', modeKey: null, bots: false },
  { key: 'bot1v1', label: 'vs Bot', modeKey: 'classic', bots: true },
  { key: 'bot4ffa', label: 'vs 3 Bots', modeKey: 'ffa4', bots: true },
  { key: 'bot2v2', label: '2v2 Bots', modeKey: 'team2v2', bots: true },
  { key: 'online', label: 'Online', modeKey: null, bots: false },
];

// Rules text per game mode
const MODE_RULES = {
  classic: {
    title: 'Classic Pente',
    captures: 'Bracket exactly two opponent stones with yours in a straight line to capture them.',
  },
  ffa4: {
    title: 'Free-for-All (4 Players)',
    captures: 'You can capture any opponent\'s pair. All three other players are opponents. Pairs must be the same color \u2014 you can\'t capture a mixed pair.',
  },
  team2v2: {
    title: '2v2 Team Pente',
    captures: 'You and your teammate share a capture count. Your teammate\'s stones count as brackets for captures \u2014 their stone at one end and yours at the other can capture an opponent pair between you. Five-in-a-row must be your stones only.',
  },
};

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
  // Style helpers
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

  const penteZone = getZone(gameElo);

  return (
    <div
      className="flex flex-col bg-forest-950 overflow-hidden relative"
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
        <SolarField intensity={0.55} accentHex={penteZone?.color} />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
      <PenteTopNav active="game" />

      <BoardCustomizer
        open={showCustomizer}
        prefs={boardPrefs}
        onChange={handleBoardPrefsChange}
        onClose={() => setShowCustomizer(false)}
      />

      {/* ══════════════════════════════════════════════════════════════
          COMPACT HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header className="flex-shrink-0 border-b border-forest-800/60 bg-forest-950/70 backdrop-blur">

        {/* Row 1 — Mode tabs + action buttons */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-forest-700/40 shrink-0">
            {MODE_PRESETS.map((preset, i) => (
              <button
                key={preset.key}
                className={`${modeBtn(modePreset === preset.key)} ${i > 0 ? 'border-l border-forest-700/40' : ''}`}
                onClick={() => switchPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            {!isOnline && !gameOver && (!gameMode || gameMode.key === 'classic') && (
              <button
                className={actionBtn(tutorEnabled)}
                onClick={handleToggleTutor}
                disabled={botEnabled && localCurrentPlayer !== humanColor}
                title={tutorEnabled ? 'Tutor active' : 'Get move hints'}
              >
                {tutorEnabled ? 'Tutor \u2726' : 'Tutor'}
              </button>
            )}
            {!isOnline && (
              <button className={actionBtn()} onClick={resetLocalBoard} title="New game">
                New
              </button>
            )}
            <button
              className={actionBtn(showCustomizer)}
              onClick={() => setShowCustomizer(s => !s)}
              title="Board style"
              aria-label="Customize board style"
            >
              🎨
            </button>
            <button
              className={actionBtn(showRules)}
              onClick={() => setShowRules(r => !r)}
              title="Rules"
            >
              ?
            </button>
          </div>
        </div>

        {/* Adaptive bot ELO display (bot modes only) */}
        {botEnabled && !gameOver && (
          <div className="flex items-center gap-2 px-3 pb-1.5">
            <span className="text-[10px] text-forest-500 uppercase tracking-wider">Adaptive Bot</span>
            <span className="text-[10px] text-forest-400 font-mono">
              ~{botEffectiveElo ?? getAdaptiveBotConfig(gameElo, gamesPlayed).effectiveElo} ELO
            </span>
            {gamesPlayed < 5 && (
              <span className="text-[10px] text-candy-pink/60 italic">
                calibrating ({5 - gamesPlayed} games left)
              </span>
            )}
          </div>
        )}

        {/* Queue banner — shown while matchmaking */}
        {isQueuing && (
          <QueueBanner onLeave={handleLeaveQueue} />
        )}

        {/* Row 2 — Turn indicator + score + captures */}
        {!showLobby && mp.gameStatus !== 'error' && (
          <div className="flex items-center px-3 pb-2 gap-2">
            {/* Turn dot */}
            <div
              className="turn-dot w-4 h-4 rounded-full border-2 shrink-0 transition-colors duration-300"
              style={{
                backgroundColor: PLAYER_COLORS[currentPlayer]?.hex || '#1a1a1a',
                borderColor: currentPlayer === WHITE ? '#9ca3af' : 'rgba(255,255,255,0.3)',
              }}
            />
            <span className="text-white text-xs font-semibold leading-none">
              {playerName_}
              {botEnabled && currentPlayer !== humanColor ? ' (Bot)' : ''}
              {botThinking ? '\u2026' : '\u2019s turn'}
            </span>
            {moveCount > 0 && (
              <span className="text-forest-600 text-xs font-mono">#{moveCount}</span>
            )}
            {lastBotStats && botEnabled && !botThinking && (
              <span className="text-forest-700 text-[10px] font-mono opacity-60" title="Engine search depth / nodes evaluated">
                d{lastBotStats.depth} {lastBotStats.nodes > 1000 ? `${(lastBotStats.nodes / 1000).toFixed(1)}k` : lastBotStats.nodes}n
              </span>
            )}

            {/* Score + captures — right-aligned */}
            <div className="ml-auto flex items-center gap-2 text-xs font-mono">
              {/* Compact score display for all active players */}
              {activePlayers.map((p, i) => (
                <span key={p} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-forest-700 mx-0.5">{i === 1 ? '\u2013' : ':'}</span>}
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: PLAYER_COLORS[p]?.hex }}
                  />
                  <span style={{ color: currentPlayer === p ? '#fff' : '#9ca3af' }}>
                    {gameMode?.teams
                      ? (captures[`team${gameMode.teams.findIndex(t => t.includes(p))}`] || 0)
                      : (captures[p] || 0)
                    }
                  </span>
                  <span className="text-forest-600">/{gameMode?.captureThreshold || 5}</span>
                </span>
              ))}
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

        {/* Hint toast */}
        {hintExplanation && !showLobby && (
          <div className="mx-3 mb-2 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-3 py-2 text-xs flex items-center gap-2">
            <PreText
              text="\u2726"
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
              \u2715
            </button>
          </div>
        )}

        {/* Thin eval strip — mobile only (classic mode) */}
        {showEval && (
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
              {gameMode && MODE_RULES[gameMode.key]
                ? <strong className="text-forest-100">{MODE_RULES[gameMode.key].title}</strong>
                : <>19\u00d719 board. First to <strong className="text-forest-100">five-in-a-row</strong> or{' '}
                  <strong className="text-forest-100">five captured pairs</strong> wins.</>
              }
            </p>
            <ul className="text-xs text-forest-400 space-y-1.5">
              <li>
                <strong className="text-forest-200">Capture:</strong>{' '}
                {gameMode && MODE_RULES[gameMode.key]
                  ? MODE_RULES[gameMode.key].captures
                  : 'Bracket exactly two opponent stones with yours in a straight line.'
                }
              </li>
              <li>
                <strong className="text-forest-200">Five in a row:</strong>{' '}
                Any direction — horizontal, vertical, or diagonal.
                {gameMode?.teams && (
                  <span className="text-forest-500"> (Your stones only — teammate stones don&rsquo;t count.)</span>
                )}
              </li>
              {(!gameMode || gameMode.key === 'classic') && (
                <li>
                  <strong className="text-forest-200">Pro rule:</strong>{' '}
                  First player&rsquo;s second stone must be \u22653 intersections from center.
                </li>
              )}
              {gameMode?.teams && (
                <li>
                  <strong className="text-forest-200">Teams:</strong>{' '}
                  {PLAYER_COLORS[gameMode.teams[0][0]]?.name} + {PLAYER_COLORS[gameMode.teams[0][1]]?.name} vs{' '}
                  {PLAYER_COLORS[gameMode.teams[1][0]]?.name} + {PLAYER_COLORS[gameMode.teams[1][1]]?.name}.
                  Captures are shared within your team.
                </li>
              )}
            </ul>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════
          BOARD / CONTENT AREA
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

            {/* Eval bar — desktop sidebar (classic only) */}
            {showEval && (
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
            <div className="relative">
            <div
              ref={boardRef}
              data-theme={boardPrefs.theme}
              data-stones={boardPrefs.stones}
              data-effects={boardPrefs.effects}
              className={`game-board rounded-xl ${hoverClass(currentPlayer)} ${boardDisabled ? 'opacity-90' : ''} ${intervention && !trainingActive ? 'shattered' : ''} ${themeWarp ? 'theme-warp' : ''}`}
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
              <div className="absolute inset-0 z-40 rounded-xl overflow-auto bg-forest-950/95 backdrop-blur-sm border border-forest-700/40 p-4 sm:p-5">
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
      {gameOver && !isOnline && (
        <div className="flex-shrink-0 border-t border-forest-700/40 bg-forest-900/90 px-4 py-3 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: PLAYER_COLORS[winner]?.hex }}
              />
              {PLAYER_COLORS[winner]?.name || 'Unknown'} Wins!
              {gameMode?.teams && (
                <span className="text-xs text-forest-400 font-normal ml-1">
                  (Team {gameMode.teams.findIndex(t => t.includes(winner)) + 1})
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={resetLocalBoard}
                className="text-xs px-3 py-1.5 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
              >
                Play Again
              </button>
              {moveHistory.length > 0 && !gameAnalysis && (!gameMode || gameMode.key === 'classic') && (
                <button
                  onClick={handleAnalyze}
                  className="text-xs px-3 py-1.5 rounded-lg bg-cyan-800/40 text-cyan-200 border border-cyan-700/40 hover:bg-cyan-700/40 transition-colors"
                >
                  Analyze
                </button>
              )}
            </div>
          </div>
          <Link
            href="/funding"
            onClick={() =>
              track('cta_click', {
                page: '/posts/pente',
                metadata: { location: 'pente_ingame_tip' },
                beacon: true,
              })
            }
            className="block mb-2.5 text-sm text-candy-500 hover:text-candy-400 transition-colors"
          >
            Enjoying Pente? Support development →
          </Link>

          {gameAnalysis && (
            <div className="space-y-1">
              {gameAnalysis.map((entry, idx) => {
                const isBlunder = entry.annotation.includes('Blunder');
                const isMistake = entry.annotation.includes('Mistake');
                const isViewing = analysisViewTurn === idx;
                const mover = moveHistory[idx]?.moveMadeBy;
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
                    <span style={{ color: PLAYER_COLORS[mover]?.hex || '#fff' }}>
                      {PLAYER_COLORS[mover]?.name || '?'}
                    </span>
                    <span className={`ml-2 ${
                      isBlunder ? 'text-red-400 font-semibold' :
                      isMistake ? 'text-yellow-400' :
                      'text-forest-400'
                    }`}>
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

          {!consultingCtaDismissed && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-candy-500/30 bg-forest-900/60 px-3 py-2.5">
              <p className="flex-1 text-xs text-forest-200 leading-snug">
                Enjoying the game? I build stuff like this professionally.{' '}
                <Link
                  href="/consulting"
                  onClick={() => {
                    const result = botEnabled
                      ? (winner === humanColor ? 'win' : 'loss')
                      : 'win';
                    track('consulting_from_game', {
                      page: '/posts/pente',
                      metadata: { game: 'pente', result },
                      beacon: true,
                    });
                  }}
                  className="font-semibold text-candy-300 hover:text-candy-200 transition-colors whitespace-nowrap"
                >
                  Work with me →
                </Link>
              </p>
              <button
                onClick={() => setConsultingCtaDismissed(true)}
                aria-label="Dismiss"
                className="flex-shrink-0 text-forest-500 hover:text-forest-300 transition-colors text-sm leading-none"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      {/* Post-multiplayer game result */}
      {isOnline && mp.gameStatus === 'finished' && (
        <div className="flex-shrink-0 border-t border-forest-700/40 bg-forest-900/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
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
                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold hover:from-candy-400 hover:to-candy-500 transition-all"
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
                className="text-xs px-3 py-1.5 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
          <Link
            href="/funding"
            onClick={() =>
              track('cta_click', {
                page: '/posts/pente',
                metadata: { location: 'pente_game_result_tip' },
                beacon: true,
              })
            }
            className="block mt-2.5 text-sm text-candy-500 hover:text-candy-400 transition-colors"
          >
            Enjoying Pente? Support development →
          </Link>
        </div>
      )}
      </div>

      <PostSolveTip
        trigger={winSignal}
        page="/posts/pente"
        location="pente_post_win_tip"
        label="Enjoying Pente? Keep it free →"
      />
    </div>
  );
};

export default GameBoard;
