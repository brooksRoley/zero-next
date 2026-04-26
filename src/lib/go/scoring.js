import { EMPTY, BLACK, WHITE, getNeighbors } from './gameLogic'

/**
 * Chinese (area) scoring: each player's score = stones on the board + territory.
 * Territory = empty regions whose entire boundary is one color. Empty regions
 * touching both colors are dame (neutral, count for nobody).
 *
 * Komi (default 0) is added to White's score before computing winner/margin.
 * Standard Chinese komi is 7.5; the .5 prevents draws.
 */
export function computeAreaScore(board, komi = 0) {
  const size = board.length
  let blackStones = 0
  let whiteStones = 0
  let blackTerritory = 0
  let whiteTerritory = 0
  let dame = 0

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === BLACK) blackStones++
      else if (board[r][c] === WHITE) whiteStones++
    }
  }

  const visited = new Set()
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue
      const key = `${r},${c}`
      if (visited.has(key)) continue

      let touchesBlack = false
      let touchesWhite = false
      let regionSize = 0
      const stack = [[r, c]]
      while (stack.length > 0) {
        const [rr, cc] = stack.pop()
        const k = `${rr},${cc}`
        if (visited.has(k)) continue
        visited.add(k)
        regionSize++
        for (const [nr, nc] of getNeighbors(rr, cc, size)) {
          const v = board[nr][nc]
          if (v === EMPTY) stack.push([nr, nc])
          else if (v === BLACK) touchesBlack = true
          else if (v === WHITE) touchesWhite = true
        }
      }

      if (touchesBlack && !touchesWhite) blackTerritory += regionSize
      else if (touchesWhite && !touchesBlack) whiteTerritory += regionSize
      else dame += regionSize
    }
  }

  const black = blackStones + blackTerritory
  const white = whiteStones + whiteTerritory + komi
  return {
    rule: 'chinese',
    black,
    white,
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    dame,
    komi,
    winner: black > white ? BLACK : white > black ? WHITE : null,
    margin: Math.abs(black - white),
  }
}

/**
 * Same as computeAreaScore, but treats `deadStones` (Set of "row,col") as
 * removed before scoring and credits each dead stone as a capture by the
 * opposite color. Used in the post-game marking phase so players can declare
 * stones dead without first having to play them out.
 */
/**
 * Japanese (territory) scoring: each player's score = territory + prisoners.
 * Stones on the board do NOT count. Prisoners include both stones captured
 * during play and stones marked dead at game end.
 *
 * The same game scored with Chinese vs Japanese rules usually picks the same
 * winner; the absolute scores and margins differ.
 *
 * Note: real Japanese rules require dame to be played out (and have special
 * cases for seki). MVP treats dame as neutral and ignores seki.
 */
export function computeTerritoryScore(board, captures, deadStones, komi = 0) {
  const size = board.length
  let blackCapturesDead = 0
  let whiteCapturesDead = 0
  const synthetic = board.map(r => [...r])
  for (const key of deadStones) {
    const [r, c] = key.split(',').map(Number)
    if (synthetic[r][c] === BLACK) {
      whiteCapturesDead++
      synthetic[r][c] = EMPTY
    } else if (synthetic[r][c] === WHITE) {
      blackCapturesDead++
      synthetic[r][c] = EMPTY
    }
  }

  let blackTerritory = 0
  let whiteTerritory = 0
  let dame = 0
  const visited = new Set()
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (synthetic[r][c] !== EMPTY) continue
      const key = `${r},${c}`
      if (visited.has(key)) continue

      let touchesBlack = false
      let touchesWhite = false
      let regionSize = 0
      const stack = [[r, c]]
      while (stack.length > 0) {
        const [rr, cc] = stack.pop()
        const k = `${rr},${cc}`
        if (visited.has(k)) continue
        visited.add(k)
        regionSize++
        for (const [nr, nc] of getNeighbors(rr, cc, size)) {
          const v = synthetic[nr][nc]
          if (v === EMPTY) stack.push([nr, nc])
          else if (v === BLACK) touchesBlack = true
          else if (v === WHITE) touchesWhite = true
        }
      }

      if (touchesBlack && !touchesWhite) blackTerritory += regionSize
      else if (touchesWhite && !touchesBlack) whiteTerritory += regionSize
      else dame += regionSize
    }
  }

  const blackPrisoners = (captures?.[BLACK] || 0) + blackCapturesDead
  const whitePrisoners = (captures?.[WHITE] || 0) + whiteCapturesDead
  const black = blackTerritory + blackPrisoners
  const white = whiteTerritory + whitePrisoners + komi

  return {
    rule: 'japanese',
    black,
    white,
    blackStones: 0,
    whiteStones: 0,
    blackTerritory,
    whiteTerritory,
    blackPrisoners,
    whitePrisoners,
    blackCapturesDead,
    whiteCapturesDead,
    dame,
    komi,
    winner: black > white ? BLACK : white > black ? WHITE : null,
    margin: Math.abs(black - white),
  }
}

export function computeAreaScoreWithDead(board, deadStones, komi = 0) {
  let blackCapturesDead = 0
  let whiteCapturesDead = 0
  const synthetic = board.map(r => [...r])
  for (const key of deadStones) {
    const [r, c] = key.split(',').map(Number)
    if (synthetic[r][c] === BLACK) {
      whiteCapturesDead++
      synthetic[r][c] = EMPTY
    } else if (synthetic[r][c] === WHITE) {
      blackCapturesDead++
      synthetic[r][c] = EMPTY
    }
  }
  const score = computeAreaScore(synthetic, komi)
  return { ...score, blackCapturesDead, whiteCapturesDead }
}
