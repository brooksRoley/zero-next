/**
 * penteWorker.js — Web Worker for Pente AI engine.
 *
 * Receives board state + config, runs minimax with alpha-beta pruning,
 * posts back the best move. Runs off the main thread so UI stays responsive.
 *
 * Message protocol:
 *   IN:  { type: 'findMove', board, player, captures, config, gameMode }
 *   OUT: { type: 'move', result: { row, col, score, depth, nodes } }
 *   OUT: { type: 'error', message }
 */

// ── Constants ──
const BOARD_SIZE = 19
const EMPTY = 0
const BLACK = 1
const WHITE = 2

// ── Zobrist hashing ──
const NUM_COLORS = 4
const TABLE_HI = new Uint32Array(BOARD_SIZE * BOARD_SIZE * NUM_COLORS)
const TABLE_LO = new Uint32Array(BOARD_SIZE * BOARD_SIZE * NUM_COLORS)

function xorshift32(state) {
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return state >>> 0
}

let _seed = 0x50656E74
for (let i = 0; i < TABLE_HI.length; i++) {
  _seed = xorshift32(_seed)
  TABLE_HI[i] = _seed
  _seed = xorshift32(_seed)
  TABLE_LO[i] = _seed
}

function zobristIdx(row, col, color) {
  return (row * BOARD_SIZE + col) * NUM_COLORS + (color - 1)
}

function hashBoardFull(board) {
  let hi = 0, lo = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c]
      if (cell === 0) continue
      const i = zobristIdx(r, c, cell)
      hi ^= TABLE_HI[i]
      lo ^= TABLE_LO[i]
    }
  }
  return hi * 0x100000000 + lo
}

// ── Board helpers ──
function isValid(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

function isOpp(player, target, gameMode) {
  if (target === EMPTY) return false
  if (!gameMode || !gameMode.teams) return target !== player
  const pTeam = gameMode.teams.findIndex(function(t) { return t.includes(player) })
  const tTeam = gameMode.teams.findIndex(function(t) { return t.includes(target) })
  return pTeam !== tTeam
}

function getOpponents(player, gameMode) {
  if (!gameMode || gameMode.key === 'classic') {
    return [player === BLACK ? WHITE : BLACK]
  }
  return gameMode.turnOrder.filter(function(c) { return c !== player && isOpp(player, c, gameMode) })
}

function getPlayerCaptures(player, captures, gameMode) {
  if (gameMode && gameMode.teams) {
    var teamIdx = gameMode.teams.findIndex(function(t) { return t.includes(player) })
    return captures['team' + teamIdx] || 0
  }
  return captures[player] || 0
}

// ── Directions ──
var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

// ── Win detection ──
function checkFive(board, row, col, player) {
  for (var d = 0; d < DIRS.length; d++) {
    var dx = DIRS[d][0], dy = DIRS[d][1]
    var count = 1
    for (var i = 1; i < 5; i++) {
      var r = row + i * dx, c = col + i * dy
      if (!isValid(r, c) || board[r][c] !== player) break
      count++
    }
    for (var i = 1; i < 5; i++) {
      var r = row - i * dx, c = col - i * dy
      if (!isValid(r, c) || board[r][c] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

// ── Capture logic ──
function countCaptures(board, row, col, player, gameMode) {
  var pairs = 0
  var captured = []
  for (var d = 0; d < DIRS.length; d++) {
    var dx = DIRS[d][0], dy = DIRS[d][1]
    for (var s = 0; s < 2; s++) {
      var sign = s === 0 ? 1 : -1
      var sdx = dx * sign, sdy = dy * sign
      var r1 = row + sdx, c1 = col + sdy
      var r2 = row + 2 * sdx, c2 = col + 2 * sdy
      var r3 = row + 3 * sdx, c3 = col + 3 * sdy
      if (!isValid(r1, c1) || !isValid(r2, c2) || !isValid(r3, c3)) continue
      var mid1 = board[r1][c1], mid2 = board[r2][c2], far = board[r3][c3]
      if (mid1 === EMPTY || mid2 === EMPTY || mid1 !== mid2) continue

      var isCapture = false
      if (!gameMode || gameMode.key === 'classic') {
        var opp = player === BLACK ? WHITE : BLACK
        isCapture = mid1 === opp && far === player
      } else if (gameMode.teams) {
        isCapture = isOpp(player, mid1, gameMode) && !isOpp(player, far, gameMode) && far !== EMPTY
      } else {
        isCapture = mid1 !== player && far === player
      }
      if (isCapture) {
        pairs++
        captured.push(r1, c1, r2, c2)
      }
    }
  }
  return { pairs: pairs, captured: captured }
}

// ── Candidate generation ──
function getCandidates(board, radius) {
  var seen = new Uint8Array(BOARD_SIZE * BOARD_SIZE)
  var hasStones = false

  for (var r = 0; r < BOARD_SIZE; r++) {
    for (var c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        hasStones = true
        for (var dr = -radius; dr <= radius; dr++) {
          for (var dc = -radius; dc <= radius; dc++) {
            var nr = r + dr, nc = c + dc
            if (isValid(nr, nc) && board[nr][nc] === EMPTY) {
              seen[nr * BOARD_SIZE + nc] = 1
            }
          }
        }
      }
    }
  }

  if (!hasStones) {
    var center = Math.floor(BOARD_SIZE / 2)
    return [{ row: center, col: center }]
  }

  var candidates = []
  for (var i = 0; i < seen.length; i++) {
    if (seen[i]) candidates.push({ row: Math.floor(i / BOARD_SIZE), col: i % BOARD_SIZE })
  }
  return candidates
}

// ── Static evaluation ──
function evaluate(board, player, captures, gameMode) {
  var opponents = getOpponents(player, gameMode)
  var score = 0
  var threshold = (gameMode && gameMode.captureThreshold) || 5

  var myCaps = getPlayerCaptures(player, captures, gameMode)
  var maxOppCaps = 0
  for (var o = 0; o < opponents.length; o++) {
    var oc = getPlayerCaptures(opponents[o], captures, gameMode)
    if (oc > maxOppCaps) maxOppCaps = oc
  }
  score += (myCaps - maxOppCaps) * 8000
  if (myCaps >= threshold - 1) score += 30000
  if (maxOppCaps >= threshold - 1) score -= 25000

  var center = Math.floor(BOARD_SIZE / 2)
  for (var r = 0; r < BOARD_SIZE; r++) {
    for (var c = 0; c < BOARD_SIZE; c++) {
      var cell = board[r][c]
      if (cell === EMPTY) continue

      for (var d = 0; d < 4; d++) {
        var dr = d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 1 : 1
        var dc = d === 0 ? 1 : d === 1 ? 0 : d === 2 ? 1 : -1
        var ls = scoreLine(board, r, c, dr, dc, cell)
        if (cell === player) score += ls
        else {
          for (var oi = 0; oi < opponents.length; oi++) {
            if (cell === opponents[oi]) { score -= ls; break }
          }
        }
      }

      var dist = Math.abs(r - center) + Math.abs(c - center)
      var cb = 18 - dist
      if (cb > 0) {
        if (cell === player) score += cb
        else {
          for (var oi = 0; oi < opponents.length; oi++) {
            if (cell === opponents[oi]) { score -= cb; break }
          }
        }
      }
    }
  }
  return score
}

function scoreLine(board, r, c, dr, dc, color) {
  var count = 0, gaps = 0, blocked = 0
  for (var i = 0; i < 5; i++) {
    var nr = r + i * dr, nc = c + i * dc
    if (!isValid(nr, nc)) { blocked++; break }
    if (board[nr][nc] === color) count++
    else if (board[nr][nc] === EMPTY) gaps++
    else { blocked++; break }
  }
  var br = r - dr, bc = c - dc
  if (!isValid(br, bc) || (board[br][bc] !== EMPTY && board[br][bc] !== color)) blocked++
  if (count < 2) return 0
  if (count >= 5) return 500000
  if (count === 4) { return blocked === 0 ? 50000 : blocked === 1 ? 5000 : 0 }
  if (count === 3) { return blocked === 0 && gaps <= 1 ? 3000 : blocked === 1 && gaps <= 1 ? 300 : 0 }
  if (count === 2) { return blocked === 0 ? 100 : 0 }
  return 0
}

// ── Transposition table ──
var TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2
var ttMap = new Map()
var TT_MAX = 500000

function ttGet(hash) { return ttMap.get(hash) }
function ttSet(hash, entry) {
  if (ttMap.size >= TT_MAX) {
    var toDelete = TT_MAX >>> 2
    var count = 0
    for (var key of ttMap.keys()) {
      if (count++ >= toDelete) break
      ttMap.delete(key)
    }
  }
  ttMap.set(hash, entry)
}

// ── Engine state ──
var engineMaxDepth, engineTimeBudget, engineBlunderRate, engineGameMode
var nodesSearched, startTime, aborted

function doMove(board, row, col, player, captures) {
  board[row][col] = player
  var result = countCaptures(board, row, col, player, engineGameMode)
  var removedStones = []
  for (var i = 0; i < result.captured.length; i += 2) {
    var cr = result.captured[i], cc = result.captured[i + 1]
    removedStones.push({ row: cr, col: cc, color: board[cr][cc] })
    board[cr][cc] = EMPTY
  }
  var newCaptures = {}
  for (var k in captures) newCaptures[k] = captures[k]
  if (engineGameMode && engineGameMode.teams) {
    var teamIdx = engineGameMode.teams.findIndex(function(t) { return t.includes(player) })
    var key = 'team' + teamIdx
    newCaptures[key] = (newCaptures[key] || 0) + result.pairs
  } else {
    newCaptures[player] = (newCaptures[player] || 0) + result.pairs
  }
  return { removedStones: removedStones, newCaptures: newCaptures }
}

function undoMove(board, row, col, saved) {
  board[row][col] = EMPTY
  for (var i = 0; i < saved.removedStones.length; i++) {
    var s = saved.removedStones[i]
    board[s.row][s.col] = s.color
  }
}

function isTimeUp() { return Date.now() - startTime > engineTimeBudget }

function quickLineScore(board, row, col, dRow, dCol, color, isBlocking) {
  var count = 1, openEnds = 0
  var i = 1
  while (i < 5) {
    var r = row + i * dRow, c = col + i * dCol
    if (!isValid(r, c) || board[r][c] !== color) break
    count++; i++
  }
  var fR = row + i * dRow, fC = col + i * dCol
  if (isValid(fR, fC) && board[fR][fC] === EMPTY) openEnds++
  i = 1
  while (i < 5) {
    var r = row - i * dRow, c = col - i * dCol
    if (!isValid(r, c) || board[r][c] !== color) break
    count++; i++
  }
  var bR = row - i * dRow, bC = col - i * dCol
  if (isValid(bR, bC) && board[bR][bC] === EMPTY) openEnds++
  if (count >= 4 && openEnds >= 1) return isBlocking ? 4500 : 5000
  if (count === 3 && openEnds === 2) return isBlocking ? 900 : 1000
  if (count === 3 && openEnds === 1) return (isBlocking ? 900 : 1000) * 0.5
  return 0
}

function quickScore(board, row, col, player, captures) {
  var score = 0
  var opponents = getOpponents(player, engineGameMode)
  var threshold = (engineGameMode && engineGameMode.captureThreshold) || 5
  board[row][col] = player
  if (checkFive(board, row, col, player)) { board[row][col] = EMPTY; return 1000000 }
  var capResult = countCaptures(board, row, col, player, engineGameMode)
  if (getPlayerCaptures(player, captures, engineGameMode) + capResult.pairs >= threshold) {
    board[row][col] = EMPTY; return 1000000
  }
  score += capResult.pairs * 10000
  for (var o = 0; o < opponents.length; o++) {
    board[row][col] = opponents[o]
    if (checkFive(board, row, col, opponents[o])) score += 500000
    var oppCap = countCaptures(board, row, col, opponents[o], engineGameMode)
    if (getPlayerCaptures(opponents[o], captures, engineGameMode) + oppCap.pairs >= threshold) score += 500000
  }
  board[row][col] = player
  for (var d = 0; d < DIRS.length; d++) {
    score += quickLineScore(board, row, col, DIRS[d][0], DIRS[d][1], player, false)
    for (var o = 0; o < opponents.length; o++) {
      score += quickLineScore(board, row, col, DIRS[d][0], DIRS[d][1], opponents[o], true)
    }
  }
  for (var dr = -2; dr <= 2; dr++) {
    for (var dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue
      var nr = row + dr, nc = col + dc
      if (isValid(nr, nc) && board[nr][nc] !== EMPTY) score += 10 / Math.max(Math.abs(dr), Math.abs(dc))
    }
  }
  var center = Math.floor(BOARD_SIZE / 2)
  score += Math.max(0, 18 - Math.abs(row - center) - Math.abs(col - center)) * 0.5
  board[row][col] = EMPTY
  return score
}

function orderMoves(board, candidates, player, captures, ttBestMove) {
  var scored = []
  for (var i = 0; i < candidates.length; i++) {
    var m = candidates[i]
    scored.push({
      row: m.row, col: m.col,
      heuristic: quickScore(board, m.row, m.col, player, captures),
      isTTBest: ttBestMove && m.row === ttBestMove.row && m.col === ttBestMove.col
    })
  }
  scored.sort(function(a, b) {
    if (a.isTTBest) return -1
    if (b.isTTBest) return 1
    return b.heuristic - a.heuristic
  })
  return scored
}

function alphaBeta(board, currentPlayer, captures, depth, alpha, beta) {
  nodesSearched++
  if ((nodesSearched & 0xFFF) === 0 && isTimeUp()) { aborted = true; return 0 }

  var hash = hashBoardFull(board)
  var ttEntry = ttGet(hash)
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === TT_EXACT) return ttEntry.score
    if (ttEntry.flag === TT_LOWER && ttEntry.score >= beta) return ttEntry.score
    if (ttEntry.flag === TT_UPPER && ttEntry.score <= alpha) return ttEntry.score
  }

  if (depth <= 0) return evaluate(board, currentPlayer, captures, engineGameMode)

  var candidates = getCandidates(board, 2)
  if (candidates.length === 0) return evaluate(board, currentPlayer, captures, engineGameMode)

  var ordered = orderMoves(board, candidates, currentPlayer, captures, ttEntry ? ttEntry.bestMove : null)
  var maxBranch = depth >= 3 ? 20 : depth >= 2 ? 25 : 30
  var movesToSearch = ordered.slice(0, maxBranch)

  var turnOrder = engineGameMode ? engineGameMode.turnOrder : [BLACK, WHITE]
  var currentIdx = turnOrder.indexOf(currentPlayer)
  var nextPlayer = turnOrder[(currentIdx + 1) % turnOrder.length]
  var threshold = (engineGameMode && engineGameMode.captureThreshold) || 5

  var bestScore = -Infinity
  var bestMove = null
  var flag = TT_UPPER

  for (var i = 0; i < movesToSearch.length; i++) {
    if (aborted) return 0
    var move = movesToSearch[i]
    var saved = doMove(board, move.row, move.col, currentPlayer, captures)

    var score
    if (checkFive(board, move.row, move.col, currentPlayer)) {
      score = 1000000 - (engineMaxDepth - depth)
    } else if (getPlayerCaptures(currentPlayer, saved.newCaptures, engineGameMode) >= threshold) {
      score = 1000000 - (engineMaxDepth - depth)
    } else {
      score = -alphaBeta(board, nextPlayer, saved.newCaptures, depth - 1, -beta, -alpha)
    }

    undoMove(board, move.row, move.col, saved)

    if (score > bestScore) { bestScore = score; bestMove = move }
    if (score > alpha) { alpha = score; flag = TT_EXACT }
    if (alpha >= beta) { flag = TT_LOWER; break }
  }

  if (!aborted && bestMove) {
    ttSet(hash, { depth: depth, score: bestScore, flag: flag, bestMove: { row: bestMove.row, col: bestMove.col } })
  }
  return bestScore
}

function searchRoot(board, player, captures, moves, depth) {
  var bestScore = -Infinity
  var bestMove = moves[0]
  var alpha = -Infinity
  var beta = Infinity
  var turnOrder = engineGameMode ? engineGameMode.turnOrder : [BLACK, WHITE]
  var currentIdx = turnOrder.indexOf(player)
  var nextPlayer = turnOrder[(currentIdx + 1) % turnOrder.length]
  var threshold = (engineGameMode && engineGameMode.captureThreshold) || 5

  for (var i = 0; i < moves.length; i++) {
    if (isTimeUp()) { aborted = true; break }
    var move = moves[i]
    var saved = doMove(board, move.row, move.col, player, captures)

    var score
    if (checkFive(board, move.row, move.col, player)) {
      score = 1000000 - depth
    } else if (getPlayerCaptures(player, saved.newCaptures, engineGameMode) >= threshold) {
      score = 1000000 - depth
    } else {
      score = -alphaBeta(board, nextPlayer, saved.newCaptures, depth - 1, -beta, -alpha)
    }

    undoMove(board, move.row, move.col, saved)

    if (score > bestScore) { bestScore = score; bestMove = move }
    if (score > alpha) alpha = score
  }
  return { move: bestMove, score: bestScore }
}

function findBestMove(board, player, captures, config, gameMode) {
  engineMaxDepth = config.searchDepth || 4
  engineTimeBudget = config.timeBudgetMs || 3000
  engineBlunderRate = config.blunderRate || 0
  engineGameMode = gameMode || null
  nodesSearched = 0
  startTime = Date.now()
  aborted = false
  ttMap.clear()

  var candidates = getCandidates(board, 2)

  // Empty board — center
  var allEmpty = true
  for (var r = 0; r < BOARD_SIZE && allEmpty; r++) {
    for (var c = 0; c < BOARD_SIZE && allEmpty; c++) {
      if (board[r][c] !== EMPTY) allEmpty = false
    }
  }
  if (allEmpty) {
    var center = Math.floor(BOARD_SIZE / 2)
    return { row: center, col: center, score: 0, depth: 0, nodes: 0 }
  }

  if (candidates.length === 0) {
    var center = Math.floor(BOARD_SIZE / 2)
    return { row: center, col: center, score: 0, depth: 0, nodes: 0 }
  }

  // Quick heuristic for move ordering
  var scored = []
  for (var i = 0; i < candidates.length; i++) {
    scored.push({
      row: candidates[i].row,
      col: candidates[i].col,
      heuristic: quickScore(board, candidates[i].row, candidates[i].col, player, captures)
    })
  }
  scored.sort(function(a, b) { return b.heuristic - a.heuristic })
  var topMoves = scored.slice(0, Math.min(scored.length, 40))

  var bestMove = topMoves[0]
  var bestScore = -Infinity
  var completedDepth = 0

  // Iterative deepening
  for (var depth = 1; depth <= engineMaxDepth; depth++) {
    if (isTimeUp()) break
    var depthResult = searchRoot(board, player, captures, topMoves, depth)
    if (aborted) break
    bestMove = depthResult.move
    bestScore = depthResult.score
    completedDepth = depth
    if (bestScore >= 900000) break
  }

  // Blunder injection
  if (engineBlunderRate > 0 && Math.random() < engineBlunderRate && topMoves.length > 1) {
    var poolSize = Math.max(2, Math.ceil(topMoves.length * 0.6))
    var blunder = topMoves[Math.floor(Math.random() * poolSize)]
    return { row: blunder.row, col: blunder.col, score: blunder.heuristic, depth: completedDepth, nodes: nodesSearched, blundered: true }
  }

  return { row: bestMove.row, col: bestMove.col, score: bestScore, depth: completedDepth, nodes: nodesSearched }
}

// ── Puzzle generation ──
// Simulates a bot-vs-bot game, finds positions where best move clearly dominates.

var CATEGORY_NAMES = ['five_in_a_row', 'defense', 'capture', 'mixed', 'opening']
var CATEGORY_HINTS = {
  five_in_a_row: 'Look for a line you can complete.',
  defense: 'Your opponent is about to win. Find the block.',
  capture: 'Find the pair you can flank.',
  mixed: 'Think about both captures and lines.',
  opening: 'Find the strongest positional move.',
}

function classifyByScore(score) {
  if (score >= 1000000) return 'five_in_a_row'
  if (score >= 500000) return 'defense'
  if (score >= 10000) return 'capture'
  if (score >= 5000) return 'mixed'
  return 'opening'
}

function difficultyFromGap(gap) {
  if (gap > 500000) return 1
  if (gap > 50000) return 2
  if (gap > 10000) return 3
  return 4
}

function eloRatingFromDifficulty(d) {
  return [0, 850, 1050, 1300, 1600][d] || 1000
}

function createEmptyBoard() {
  var b = []
  for (var r = 0; r < BOARD_SIZE; r++) {
    var row = []
    for (var c = 0; c < BOARD_SIZE; c++) row.push(EMPTY)
    b.push(row)
  }
  return b
}

function copyBoard(board) {
  return board.map(function(r) { return r.slice() })
}

function applyMoveSimple(board, row, col, player, captures) {
  board[row][col] = player
  var capResult = countCaptures(board, row, col, player, null)
  for (var i = 0; i < capResult.captured.length; i += 2) {
    board[capResult.captured[i]][capResult.captured[i + 1]] = EMPTY
  }
  var newCaps = {}
  for (var k in captures) newCaps[k] = captures[k]
  newCaps[player] = (newCaps[player] || 0) + capResult.pairs
  var winner = null
  if (checkFive(board, row, col, player)) winner = player
  else if ((newCaps[player] || 0) >= 5) winner = player
  var next = player === BLACK ? WHITE : BLACK
  return { board: board, captures: newCaps, winner: winner, next: next }
}

function generatePuzzle(targetElo) {
  // Map targetElo to approximate move range for interesting positions
  var targetDiff = targetElo < 900 ? 1 : targetElo < 1100 ? 2 : targetElo < 1400 ? 3 : 4
  var searchConfig = { searchDepth: 2, timeBudgetMs: 500 }
  var maxAttempts = 8 // games to try
  var bestCandidate = null
  var bestFit = Infinity

  for (var g = 0; g < maxAttempts; g++) {
    var board = createEmptyBoard()
    var captures = {}
    captures[BLACK] = 0
    captures[WHITE] = 0
    var currentPlayer = BLACK

    // Play 6-30 moves to build up a position
    var minMoves = 6 + Math.floor(Math.random() * 4)
    var maxMoves = 20 + Math.floor(Math.random() * 15)

    for (var moveNum = 0; moveNum < maxMoves; moveNum++) {
      // Use engine with some randomness for variety
      var moveConfig = { searchDepth: 1, timeBudgetMs: 100, blunderRate: 0.3 }
      engineGameMode = null
      engineMaxDepth = moveConfig.searchDepth
      engineTimeBudget = moveConfig.timeBudgetMs
      engineBlunderRate = moveConfig.blunderRate
      nodesSearched = 0
      startTime = Date.now()
      aborted = false
      ttMap.clear()

      var cands = getCandidates(board, 2)
      if (cands.length === 0) break

      // Check for empty board
      var empty = true
      for (var r = 0; r < BOARD_SIZE && empty; r++) {
        for (var c = 0; c < BOARD_SIZE && empty; c++) {
          if (board[r][c] !== EMPTY) empty = false
        }
      }
      if (empty) {
        var center = Math.floor(BOARD_SIZE / 2)
        board[center][center] = currentPlayer
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK
        continue
      }

      // Get scored moves
      var scoredMoves = []
      for (var i = 0; i < Math.min(cands.length, 30); i++) {
        scoredMoves.push({
          row: cands[i].row, col: cands[i].col,
          score: quickScore(board, cands[i].row, cands[i].col, currentPlayer, captures)
        })
      }
      scoredMoves.sort(function(a, b) { return b.score - a.score })

      // After minMoves, check if this is a puzzle-worthy position
      if (moveNum >= minMoves && scoredMoves.length >= 2) {
        var best = scoredMoves[0]
        var second = scoredMoves[1]
        var gap = best.score - second.score

        // Need a clear best move
        if (gap >= 5000 && best.score >= 5000) {
          var difficulty = difficultyFromGap(gap)
          var cat = classifyByScore(best.score)
          var rating = eloRatingFromDifficulty(difficulty)
          var fit = Math.abs(rating - targetElo) + Math.abs(difficulty - targetDiff) * 200

          if (fit < bestFit) {
            bestFit = fit
            bestCandidate = {
              board: copyBoard(board),
              playerToMove: currentPlayer,
              solutions: [{ row: best.row, col: best.col }],
              category: cat,
              difficulty: difficulty,
              rating: rating,
              bestScore: best.score,
              secondScore: second.score,
              gap: gap,
              blackCaptures: captures[BLACK] || 0,
              whiteCaptures: captures[WHITE] || 0,
            }
          }

          // Good enough? Don't over-search
          if (fit < 150) break
        }
      }

      // Apply a move (with some randomness for game diversity)
      var moveIdx = 0
      if (Math.random() < 0.3 && scoredMoves.length > 1) {
        moveIdx = Math.floor(Math.random() * Math.min(3, scoredMoves.length))
      }
      var chosen = scoredMoves[moveIdx]
      var result = applyMoveSimple(copyBoard(board), chosen.row, chosen.col, currentPlayer, captures)
      board = result.board
      captures = result.captures
      if (result.winner) break
      currentPlayer = result.next
    }

    if (bestCandidate && bestFit < 150) break
  }

  if (!bestCandidate) return null

  // Generate descriptive text
  var colorName = bestCandidate.playerToMove === BLACK ? 'Black' : 'White'
  var cat = bestCandidate.category
  var titles = {
    five_in_a_row: ['Complete the Line', 'Find the Win', 'Winning Sequence', 'Five to Victory', 'Line It Up'],
    defense: ['Block the Threat', 'Critical Defense', 'Stop the Attack', 'Hold the Line', 'Prevent Disaster'],
    capture: ['Capture Play', 'Flanking Maneuver', 'Snare the Pair', 'Tactical Capture', 'Spring the Trap'],
    mixed: ['Multi-Threat', 'Dual Purpose', 'Fork and Win', 'Combined Tactics', 'The Key Move'],
    opening: ['Strong Position', 'Central Control', 'Build Influence', 'Positional Play', 'Strategic Placement'],
  }
  var catTitles = titles[cat] || titles.mixed
  var title = catTitles[Math.floor(Math.random() * catTitles.length)]
  var descs = {
    five_in_a_row: colorName + ' to move. Complete five in a row.',
    defense: colorName + ' to move. Block the opponent\'s winning threat.',
    capture: colorName + ' to move. Find the capture.',
    mixed: colorName + ' to move. Find the strongest tactical play.',
    opening: colorName + ' to move. Find the best position.',
  }

  return {
    id: 'gen-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
    title: title,
    description: descs[cat],
    category: cat,
    difficulty: bestCandidate.difficulty,
    rating: bestCandidate.rating,
    board: bestCandidate.board,
    playerToMove: bestCandidate.playerToMove,
    blackCaptures: bestCandidate.blackCaptures,
    whiteCaptures: bestCandidate.whiteCaptures,
    solutions: bestCandidate.solutions,
    hint: CATEGORY_HINTS[cat],
    explanation: 'The best move scores ' + bestCandidate.bestScore + ' while the next best scores only ' + bestCandidate.secondScore + '. A gap of ' + bestCandidate.gap + ' makes this the clear winning play.',
    generated: true,
  }
}

// ── Worker message handler ──
self.onmessage = function(e) {
  var msg = e.data
  if (msg.type === 'findMove') {
    try {
      var result = findBestMove(msg.board, msg.player, msg.captures || {}, msg.config || {}, msg.gameMode || null)
      self.postMessage({ type: 'move', result: result })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) })
    }
  } else if (msg.type === 'generatePuzzle') {
    try {
      var puzzle = generatePuzzle(msg.targetElo || 1000)
      self.postMessage({ type: 'puzzle', puzzle: puzzle })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) })
    }
  }
}
