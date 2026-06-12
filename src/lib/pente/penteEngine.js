/**
 * penteEngine.js
 * Minimax engine with alpha-beta pruning, iterative deepening,
 * move ordering, and Zobrist transposition table for Pente.
 *
 * Designed to run inside a Web Worker (no DOM, no React).
 * All constants/helpers are inlined to avoid import issues in worker context.
 */

// ── Constants (mirrored from constants.js for worker isolation) ──
const BOARD_SIZE = 19
const EMPTY = 0
const BLACK = 1
const WHITE = 2

// ── Zobrist hashing (inlined for worker) ──
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
  return (hi * 0x100000000 + lo) // combine into single number for Map key
}

function hashToggle(hash, row, col, color) {
  const i = zobristIdx(row, col, color)
  // Decompose back, XOR, recompose
  const hi = ((hash / 0x100000000) >>> 0) ^ TABLE_HI[i]
  const lo = (hash >>> 0) ^ TABLE_LO[i]
  return hi * 0x100000000 + lo
}

// ── Board helpers ──
function isValid(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

function isOpp(player, target, gameMode) {
  if (target === EMPTY) return false
  if (!gameMode?.teams) return target !== player
  const pTeam = gameMode.teams.findIndex(t => t.includes(player))
  const tTeam = gameMode.teams.findIndex(t => t.includes(target))
  return pTeam !== tTeam
}

function getOpponents(player, gameMode) {
  if (!gameMode || gameMode.key === 'classic') {
    return [player === BLACK ? WHITE : BLACK]
  }
  return gameMode.turnOrder.filter(c => c !== player && isOpp(player, c, gameMode))
}

// ── Directions ──
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

// ── Win detection ──
function checkFive(board, row, col, player) {
  for (const [dx, dy] of DIRS) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const r = row + i * dx, c = col + i * dy
      if (!isValid(r, c) || board[r][c] !== player) break
      count++
    }
    for (let i = 1; i < 5; i++) {
      const r = row - i * dx, c = col - i * dy
      if (!isValid(r, c) || board[r][c] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

// ── Capture logic ──
function countCaptures(board, row, col, player, gameMode) {
  let pairs = 0
  const captured = []
  for (const [dx, dy] of DIRS) {
    for (const sign of [1, -1]) {
      const sdx = dx * sign, sdy = dy * sign
      const r1 = row + sdx, c1 = col + sdy
      const r2 = row + 2 * sdx, c2 = col + 2 * sdy
      const r3 = row + 3 * sdx, c3 = col + 3 * sdy
      if (!isValid(r1, c1) || !isValid(r2, c2) || !isValid(r3, c3)) continue
      const mid1 = board[r1][c1], mid2 = board[r2][c2], far = board[r3][c3]
      if (mid1 === EMPTY || mid2 === EMPTY || mid1 !== mid2) continue

      let isCapture = false
      if (!gameMode || gameMode.key === 'classic') {
        const opp = player === BLACK ? WHITE : BLACK
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
  return { pairs, captured }
}

// ── Candidate move generation ──
// Returns empty cells within `radius` of any existing stone, sorted by rough heuristic
function getCandidates(board, radius) {
  const seen = new Uint8Array(BOARD_SIZE * BOARD_SIZE)
  let hasStones = false

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        hasStones = true
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const nr = r + dr, nc = c + dc
            if (isValid(nr, nc) && board[nr][nc] === EMPTY) {
              seen[nr * BOARD_SIZE + nc] = 1
            }
          }
        }
      }
    }
  }

  if (!hasStones) {
    const center = Math.floor(BOARD_SIZE / 2)
    return [{ row: center, col: center }]
  }

  const candidates = []
  for (let i = 0; i < seen.length; i++) {
    if (seen[i]) candidates.push({ row: Math.floor(i / BOARD_SIZE), col: i % BOARD_SIZE })
  }
  return candidates
}

// ── Static evaluation function ──
// Evaluates the board from `player`'s perspective
function evaluate(board, player, captures, gameMode) {
  const opponents = getOpponents(player, gameMode)
  let score = 0

  // Capture advantage
  const threshold = gameMode?.captureThreshold || 5
  const myCaps = getPlayerCaptures(player, captures, gameMode)
  let maxOppCaps = 0
  for (const opp of opponents) {
    maxOppCaps = Math.max(maxOppCaps, getPlayerCaptures(opp, captures, gameMode))
  }
  score += (myCaps - maxOppCaps) * 8000
  // Capture-win proximity bonus
  if (myCaps >= threshold - 1) score += 30000
  if (maxOppCaps >= threshold - 1) score -= 25000

  // Scan all cells for line patterns
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c]
      if (cell === EMPTY) continue

      // Only count in positive directions to avoid double-counting
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const lineScore = scoreLine(board, r, c, dr, dc, cell)
        if (cell === player) {
          score += lineScore
        } else if (opponents.includes(cell)) {
          score -= lineScore
        }
      }
    }
  }

  // Centrality: sum of stone distances from center
  const center = Math.floor(BOARD_SIZE / 2)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === EMPTY) continue
      const dist = Math.abs(r - center) + Math.abs(c - center)
      const centralityBonus = Math.max(0, 18 - dist)
      if (board[r][c] === player) score += centralityBonus
      else if (opponents.includes(board[r][c])) score -= centralityBonus
    }
  }

  return score
}

// Score the run of `color` stones starting at (r,c) in direction (dr,dc).
// Only scores at the start of a run (no stone behind), so each run counts once.
// Open-end counting makes threes/fours visible to leaf evaluation — the old
// fixed-window scan counted trailing empties as "gaps" and scored a clean
// open three as 0, leaving shallow searches blind to it.
function scoreLine(board, r, c, dr, dc, color) {
  const pr = r - dr, pc = c - dc
  if (isValid(pr, pc) && board[pr][pc] === color) return 0 // not a run start

  let len = 0
  let er = r, ec = c
  while (isValid(er, ec) && board[er][ec] === color) {
    len++
    er += dr
    ec += dc
  }
  if (len < 2) return 0

  const open =
    (isValid(pr, pc) && board[pr][pc] === EMPTY ? 1 : 0) +
    (isValid(er, ec) && board[er][ec] === EMPTY ? 1 : 0)

  if (len >= 5) return 500000  // five in a row (should be caught by win check, but safety)
  if (len === 4) {
    if (open === 2) return 50000  // open four — unstoppable
    if (open === 1) return 5000   // half-open four — wins unless answered now
    return 0
  }
  if (len === 3) {
    if (open === 2) return 3000  // open three — becomes an open four
    if (open === 1) return 300   // half-open three
    return 0
  }
  if (len === 2) {
    if (open === 2) return 100  // open two
    return 0
  }
  return 0
}

function getPlayerCaptures(player, captures, gameMode) {
  if (gameMode?.teams) {
    const teamIdx = gameMode.teams.findIndex(t => t.includes(player))
    return captures[`team${teamIdx}`] || 0
  }
  return captures[player] || 0
}

// ── Transposition table ──
// Entry: { depth, score, flag, bestMove }
// flag: 0=EXACT, 1=LOWER_BOUND, 2=UPPER_BOUND
const TT_EXACT = 0
const TT_LOWER = 1
const TT_UPPER = 2

class TranspositionTable {
  constructor(maxSize = 500000) {
    this.map = new Map()
    this.maxSize = maxSize
  }

  get(hash) {
    return this.map.get(hash)
  }

  set(hash, entry) {
    if (this.map.size >= this.maxSize) {
      // Evict oldest entries (approximate — delete first 25%)
      const toDelete = this.maxSize >>> 2
      let count = 0
      for (const key of this.map.keys()) {
        if (count++ >= toDelete) break
        this.map.delete(key)
      }
    }
    this.map.set(hash, entry)
  }

  clear() {
    this.map.clear()
  }
}

// ── Make/unmake move on board (mutating for speed) ──
function makeMove(board, row, col, player, captures, gameMode) {
  board[row][col] = player
  const { pairs, captured } = countCaptures(board, row, col, player, gameMode)
  // Remove captured stones from board
  for (let i = 0; i < captured.length; i += 2) {
    board[captured[i]][captured[i + 1]] = EMPTY
  }
  // Update captures
  const newCaptures = { ...captures }
  if (gameMode?.teams) {
    const teamIdx = gameMode.teams.findIndex(t => t.includes(player))
    const key = `team${teamIdx}`
    newCaptures[key] = (newCaptures[key] || 0) + pairs
  } else {
    newCaptures[player] = (newCaptures[player] || 0) + pairs
  }
  return { capturedStones: captured, newCaptures, pairs }
}

function unmakeMove(board, row, col, capturedStones, captures) {
  board[row][col] = EMPTY
  // Restore captured stones — we need their colors stored alongside
  // capturedStones format: [r1, c1, r2, c2, ...] but we need to know what color they were
  // The caller needs to provide the captured stone colors
}

// ── The Engine ──
export class PenteEngine {
  constructor(config = {}) {
    this.maxDepth = config.searchDepth || 4
    this.timeBudget = config.timeBudgetMs || 3000
    this.blunderRate = config.blunderRate || 0
    this.randomness = config.randomness || 0
    this.gameMode = config.gameMode || null
    this.tt = new TranspositionTable()
    this.nodesSearched = 0
    this.startTime = 0
    this.aborted = false
  }

  /**
   * Find the best move using iterative deepening with alpha-beta.
   * @param {number[][]} board
   * @param {number} player - Who is moving
   * @param {object} captures - Current capture counts
   * @returns {{ row: number, col: number, score: number, depth: number, nodes: number }}
   */
  findBestMove(board, player, captures) {
    this.nodesSearched = 0
    this.startTime = Date.now()
    this.aborted = false
    this.tt.clear()

    const candidates = getCandidates(board, 2)
    if (candidates.length === 0) {
      const center = Math.floor(BOARD_SIZE / 2)
      return { row: center, col: center, score: 0, depth: 0, nodes: 0 }
    }

    // Empty board — play center
    if (candidates.length === 1 && board[candidates[0].row][candidates[0].col] === EMPTY) {
      let allEmpty = true
      outer: for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== EMPTY) { allEmpty = false; break outer }
        }
      }
      if (allEmpty) {
        const center = Math.floor(BOARD_SIZE / 2)
        return { row: center, col: center, score: 0, depth: 0, nodes: 0 }
      }
    }

    // Quick heuristic score for move ordering
    const scored = candidates.map(m => ({
      ...m,
      heuristic: this.quickScore(board, m.row, m.col, player, captures),
    }))
    scored.sort((a, b) => b.heuristic - a.heuristic)

    // Limit candidates to top N for deeper searches
    const maxCandidates = Math.min(scored.length, 40)
    const topMoves = scored.slice(0, maxCandidates)

    let bestMove = topMoves[0]
    let bestScore = -Infinity
    let completedDepth = 0

    // Iterative deepening
    for (let depth = 1; depth <= this.maxDepth; depth++) {
      if (this.isTimeUp()) break

      const depthBest = this.searchRoot(board, player, captures, topMoves, depth)
      if (this.aborted) break // time ran out mid-search, use previous depth's result

      bestMove = depthBest.move
      bestScore = depthBest.score
      completedDepth = depth

      // Early exit if we found a winning move
      if (bestScore >= 900000) break
    }

    // Blunder injection for lower difficulties.
    // Forced moves are exempt: heuristic >= 500000 means the best move wins
    // outright or blocks an imminent opponent win — a blunder there doesn't
    // read as "beginner", it reads as broken.
    const FORCED_MOVE = 500000
    if (
      this.blunderRate > 0 && Math.random() < this.blunderRate &&
      topMoves.length > 1 && topMoves[0].heuristic < FORCED_MOVE && bestScore < 900000
    ) {
      // Pick a random move from top 60% instead of the best
      const pool = topMoves.slice(0, Math.max(2, Math.ceil(topMoves.length * 0.6)))
      const blunder = pool[Math.floor(Math.random() * pool.length)]
      return { row: blunder.row, col: blunder.col, score: blunder.heuristic, depth: completedDepth, nodes: this.nodesSearched, blundered: true }
    }

    return { row: bestMove.row, col: bestMove.col, score: bestScore, depth: completedDepth, nodes: this.nodesSearched }
  }

  searchRoot(board, player, captures, moves, depth) {
    let bestScore = -Infinity
    let bestMove = moves[0]
    let alpha = -Infinity
    const beta = Infinity
    const opponents = getOpponents(player, this.gameMode)
    const turnOrder = this.gameMode ? this.gameMode.turnOrder : [BLACK, WHITE]
    const currentIdx = turnOrder.indexOf(player)
    const nextPlayer = turnOrder[(currentIdx + 1) % turnOrder.length]

    for (const move of moves) {
      if (this.isTimeUp()) { this.aborted = true; break }

      // Make move
      const savedCells = this.doMove(board, move.row, move.col, player, captures)

      // Check for immediate win
      let score
      if (checkFive(board, move.row, move.col, player)) {
        score = 1000000 - depth // prefer shorter wins
      } else {
        const capsAfter = savedCells.newCaptures
        const myCaps = getPlayerCaptures(player, capsAfter, this.gameMode)
        const threshold = this.gameMode?.captureThreshold || 5
        if (myCaps >= threshold) {
          score = 1000000 - depth
        } else {
          score = -this.alphaBeta(board, nextPlayer, player, savedCells.newCaptures, depth - 1, -beta, -alpha)
        }
      }

      // Unmake
      this.undoMove(board, move.row, move.col, savedCells)

      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
      if (score > alpha) alpha = score
    }

    return { move: bestMove, score: bestScore }
  }

  /**
   * Negamax alpha-beta search.
   * Score is always from the perspective of `currentPlayer`.
   */
  alphaBeta(board, currentPlayer, rootPlayer, captures, depth, alpha, beta) {
    this.nodesSearched++

    // Time check every 4096 nodes
    if ((this.nodesSearched & 0xFFF) === 0 && this.isTimeUp()) {
      this.aborted = true
      return 0
    }

    // Transposition table lookup
    const hash = hashBoardFull(board)
    const ttEntry = this.tt.get(hash)
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === TT_EXACT) return ttEntry.score
      if (ttEntry.flag === TT_LOWER && ttEntry.score >= beta) return ttEntry.score
      if (ttEntry.flag === TT_UPPER && ttEntry.score <= alpha) return ttEntry.score
    }

    // Leaf node — static evaluation
    if (depth <= 0) {
      const eval_ = evaluate(board, currentPlayer, captures, this.gameMode)
      return eval_
    }

    const candidates = getCandidates(board, 2)
    if (candidates.length === 0) {
      return evaluate(board, currentPlayer, captures, this.gameMode)
    }

    // Move ordering: use TT best move first, then quick heuristic
    const ordered = this.orderMoves(board, candidates, currentPlayer, captures, ttEntry?.bestMove)

    // Limit branching at deeper levels
    const maxBranch = depth >= 3 ? 20 : depth >= 2 ? 25 : 30
    const movesToSearch = ordered.slice(0, maxBranch)

    const turnOrder = this.gameMode ? this.gameMode.turnOrder : [BLACK, WHITE]
    const currentIdx = turnOrder.indexOf(currentPlayer)
    const nextPlayer = turnOrder[(currentIdx + 1) % turnOrder.length]

    let bestScore = -Infinity
    let bestMove = null
    let flag = TT_UPPER

    for (const move of movesToSearch) {
      if (this.aborted) return 0

      const savedCells = this.doMove(board, move.row, move.col, currentPlayer, captures)

      let score
      if (checkFive(board, move.row, move.col, currentPlayer)) {
        score = 1000000 - (this.maxDepth - depth)
      } else {
        const capsAfter = savedCells.newCaptures
        const myCaps = getPlayerCaptures(currentPlayer, capsAfter, this.gameMode)
        const threshold = this.gameMode?.captureThreshold || 5
        if (myCaps >= threshold) {
          score = 1000000 - (this.maxDepth - depth)
        } else {
          score = -this.alphaBeta(board, nextPlayer, rootPlayer, capsAfter, depth - 1, -beta, -alpha)
        }
      }

      this.undoMove(board, move.row, move.col, savedCells)

      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
      if (score > alpha) {
        alpha = score
        flag = TT_EXACT
      }
      if (alpha >= beta) {
        flag = TT_LOWER
        break
      }
    }

    // Store in transposition table
    if (!this.aborted && bestMove) {
      this.tt.set(hash, {
        depth,
        score: bestScore,
        flag,
        bestMove: { row: bestMove.row, col: bestMove.col },
      })
    }

    return bestScore
  }

  /**
   * Order moves for better alpha-beta pruning.
   * TT best move first, then sorted by quick heuristic.
   */
  orderMoves(board, candidates, player, captures, ttBestMove) {
    const scored = candidates.map(m => ({
      ...m,
      heuristic: this.quickScore(board, m.row, m.col, player, captures),
      isTTBest: ttBestMove && m.row === ttBestMove.row && m.col === ttBestMove.col,
    }))
    scored.sort((a, b) => {
      if (a.isTTBest) return -1
      if (b.isTTBest) return 1
      return b.heuristic - a.heuristic
    })
    return scored
  }

  /**
   * Fast single-ply heuristic score for move ordering.
   * Similar to the old PenteBot.evaluateMove but lighter.
   */
  quickScore(board, row, col, player, captures) {
    let score = 0
    const opponents = getOpponents(player, this.gameMode)

    board[row][col] = player

    // Win by five
    if (checkFive(board, row, col, player)) {
      board[row][col] = EMPTY
      return 1000000
    }

    // Captures
    const { pairs } = countCaptures(board, row, col, player, this.gameMode)
    const myCaps = getPlayerCaptures(player, captures, this.gameMode) + pairs
    const threshold = this.gameMode?.captureThreshold || 5
    if (myCaps >= threshold) {
      board[row][col] = EMPTY
      return 1000000
    }
    score += pairs * 10000

    // Block opponent wins
    for (const opp of opponents) {
      board[row][col] = opp
      if (checkFive(board, row, col, opp)) score += 500000
      const oppCapResult = countCaptures(board, row, col, opp, this.gameMode)
      if (getPlayerCaptures(opp, captures, this.gameMode) + oppCapResult.pairs >= threshold) {
        score += 500000
      }
    }

    board[row][col] = player

    // Line patterns
    for (const [dr, dc] of DIRS) {
      score += this.quickLineScore(board, row, col, dr, dc, player, false)
      for (const opp of opponents) {
        score += this.quickLineScore(board, row, col, dr, dc, opp, true)
      }
    }

    // Proximity
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = row + dr, nc = col + dc
        if (isValid(nr, nc) && board[nr][nc] !== EMPTY) {
          score += 10 / Math.max(Math.abs(dr), Math.abs(dc))
        }
      }
    }

    // Centrality
    const center = Math.floor(BOARD_SIZE / 2)
    score += Math.max(0, 18 - Math.abs(row - center) - Math.abs(col - center)) * 0.5

    board[row][col] = EMPTY
    return score
  }

  quickLineScore(board, row, col, dRow, dCol, color, isBlocking) {
    let count = 1
    let openEnds = 0

    let i = 1
    while (i < 5) {
      const r = row + i * dRow, c = col + i * dCol
      if (!isValid(r, c) || board[r][c] !== color) break
      count++
      i++
    }
    const fR = row + i * dRow, fC = col + i * dCol
    if (isValid(fR, fC) && board[fR][fC] === EMPTY) openEnds++

    i = 1
    while (i < 5) {
      const r = row - i * dRow, c = col - i * dCol
      if (!isValid(r, c) || board[r][c] !== color) break
      count++
      i++
    }
    const bR = row - i * dRow, bC = col - i * dCol
    if (isValid(bR, bC) && board[bR][bC] === EMPTY) openEnds++

    if (count >= 4 && openEnds >= 1) return isBlocking ? 4500 : 5000
    if (count === 3 && openEnds === 2) return isBlocking ? 900 : 1000
    if (count === 3 && openEnds === 1) return (isBlocking ? 900 : 1000) * 0.5
    return 0
  }

  /**
   * Apply move to board (mutating) and return undo info.
   */
  doMove(board, row, col, player, captures) {
    board[row][col] = player
    const { pairs, captured } = countCaptures(board, row, col, player, this.gameMode)

    // Save captured stone colors before removing them
    const removedStones = []
    for (let i = 0; i < captured.length; i += 2) {
      const cr = captured[i], cc = captured[i + 1]
      removedStones.push({ row: cr, col: cc, color: board[cr][cc] })
      board[cr][cc] = EMPTY
    }

    const newCaptures = { ...captures }
    if (this.gameMode?.teams) {
      const teamIdx = this.gameMode.teams.findIndex(t => t.includes(player))
      const key = `team${teamIdx}`
      newCaptures[key] = (newCaptures[key] || 0) + pairs
    } else {
      newCaptures[player] = (newCaptures[player] || 0) + pairs
    }

    return { removedStones, newCaptures, oldCaptures: captures }
  }

  /**
   * Undo a move on the board (mutating).
   */
  undoMove(board, row, col, saved) {
    board[row][col] = EMPTY
    for (const stone of saved.removedStones) {
      board[stone.row][stone.col] = stone.color
    }
  }

  isTimeUp() {
    return Date.now() - this.startTime > this.timeBudget
  }
}
