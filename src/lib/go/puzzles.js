import { parseSgf } from './sgf'
import { BLACK, WHITE, EMPTY } from './gameLogic'

/**
 * Curated tsumego catalog. Each entry is an SGF string plus presentation
 * metadata. SGFs are parsed at module load so puzzle pages can render
 * synchronously.
 *
 * SGF coords: column letter then row letter, both a-i for the 9×9 board.
 * "bb" = column b (col 1), row b (row 1) = (row 1, col 1).
 *
 * Every starter puzzle is a single-move capture: the white group has exactly
 * one liberty; the user plays there to capture. PuzzleBoard validates the
 * user's first move against the SGF mainline.
 */
const RAW = [
  {
    id: 'capture-corner',
    title: 'Atari in the corner',
    category: 'capture',
    difficulty: 'beginner',
    rating: 800,
    prompt: 'Black to play. Capture the white stone.',
    region: { rMin: 0, rMax: 3, cMin: 0, cMax: 3 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[ba][ab][bc]AW[bb]PL[B];B[cb]C[Captured!])',
    concept: 'capture',
  },
  {
    id: 'capture-edge',
    title: 'Atari on the edge',
    category: 'capture',
    difficulty: 'beginner',
    rating: 850,
    prompt: 'Black to play. Capture the white stone on the top edge.',
    region: { rMin: 0, rMax: 2, cMin: 2, cMax: 7 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[eb][da]AW[ea]PL[B];B[fa]C[Captured!])',
    concept: 'capture',
  },
  {
    id: 'capture-center',
    title: 'Atari in the open',
    category: 'capture',
    difficulty: 'beginner',
    rating: 900,
    prompt: 'Black to play. The white stone is in atari — capture it.',
    region: { rMin: 2, rMax: 6, cMin: 2, cMax: 6 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[ed][ef][de]AW[ee]PL[B];B[fe]C[Captured!])',
    concept: 'capture',
  },
  {
    id: 'capture-pair',
    title: 'Capture two stones',
    category: 'capture',
    difficulty: 'easy',
    rating: 1050,
    prompt: 'Black to play. Both white stones share a single liberty — take it.',
    region: { rMin: 1, rMax: 5, cMin: 2, cMax: 7 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[ec][fc][ee][fe][dd]AW[ed][fd]PL[B];B[gd]C[Both gone!])',
    concept: 'capture',
  },
  {
    id: 'capture-corner-pair',
    title: 'Two stones in the corner',
    category: 'capture',
    difficulty: 'easy',
    rating: 1100,
    prompt: 'Black to play. Capture the two white corner stones.',
    region: { rMin: 0, rMax: 3, cMin: 0, cMax: 3 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[ab][bb]AW[aa][ba]PL[B];B[ca]C[Corner cleared.])',
    concept: 'capture',
  },
  {
    id: 'capture-l-shape',
    title: 'The L-shape vital point',
    category: 'capture',
    difficulty: 'medium',
    rating: 1300,
    prompt: 'Black to play. Three white stones form an L — find the vital point inside.',
    region: { rMin: 0, rMax: 3, cMin: 0, cMax: 3 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[ca][ac]AW[aa][ba][ab]PL[B];B[bb]C[Inside the L was the only liberty.])',
    concept: 'capture',
  },
  {
    id: 'capture-wall-line',
    title: 'End of the line',
    category: 'capture',
    difficulty: 'easy',
    rating: 1150,
    prompt: 'Black to play. Four white stones run between two black walls — close the gap.',
    region: { rMin: 0, rMax: 2, cMin: 0, cMax: 5 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[aa][ba][ca][da][ea][ac][bc][cc][dc][ec]AW[ab][bb][cb][db]PL[B];B[eb]C[Four down!])',
    concept: 'capture',
  },
  {
    id: 'kill-vital-point',
    title: 'Kill the eye-space',
    category: 'death',
    difficulty: 'medium',
    rating: 1300,
    prompt: 'Black to play. White has three internal points — find the vital point that prevents two eyes.',
    region: { rMin: 1, rMax: 3, cMin: 2, cMax: 6 },
    sgf: '(;FF[4]GM[1]SZ[9]AW[cb][db][eb][fb][gb][cc][gc][cd][dd][ed][fd][gd]PL[B];B[ec]C[White can no longer make two eyes.])',
    concept: 'eyes',
  },
  {
    id: 'live-make-two-eyes',
    title: 'Make two eyes',
    category: 'life',
    difficulty: 'medium',
    rating: 1350,
    prompt: 'Black to play. Three internal points in a row — split them into two separate eyes to live.',
    region: { rMin: 1, rMax: 3, cMin: 2, cMax: 6 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[cb][db][eb][fb][gb][cc][gc][cd][dd][ed][fd][gd]PL[B];B[ec]C[Two single-point eyes — alive!])',
    concept: 'eyes',
  },
  {
    id: 'tesuji-double-atari',
    title: 'One stone, two captures',
    category: 'tesuji',
    difficulty: 'medium',
    rating: 1400,
    prompt: 'Black to play. Two isolated white stones share one liberty — take it.',
    region: { rMin: 1, rMax: 3, cMin: 1, cMax: 5 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[bb][cb][db][eb][fb][bc][fc][bd][cd][dd][ed][fd]AW[cc][ec]PL[B];B[dc]C[Both whites captured at once.])',
  },
  {
    id: 'capture-two-step',
    title: 'Atari and chase',
    category: 'capture',
    difficulty: 'medium',
    rating: 1450,
    prompt: 'Black to play. White has two liberties — atari first, then capture after the forced extension.',
    region: { rMin: 0, rMax: 4, cMin: 1, cMax: 5 },
    sgf: '(;FF[4]GM[1]SZ[9]AB[cb][eb][cc][ec][cd][ed]AW[dc]PL[B];B[db];W[dd];B[de]C[Two-move chase — captured.])',
    concept: 'capture',
  },
]

/**
 * Target stones = the side being captured. For our capture puzzles, that's
 * always the side opposite to the player to move. The engine uses these to
 * evaluate puzzle success: when every original target stone is gone, the
 * goal is achieved.
 */
function deriveTargetStones(initialBoard, toMove, explicitColor) {
  const targetColor = explicitColor || (toMove === BLACK ? WHITE : BLACK)
  const out = []
  for (let r = 0; r < initialBoard.length; r++) {
    for (let c = 0; c < initialBoard[r].length; c++) {
      if (initialBoard[r][c] === targetColor) out.push([r, c])
    }
  }
  return { targetColor, targetStones: out }
}

export const PUZZLES = RAW.map(p => {
  const parsed = parseSgf(p.sgf)
  const { targetColor, targetStones } = deriveTargetStones(
    parsed.initialBoard,
    parsed.toMove,
    p.targetColor,
  )
  return {
    ...p,
    size: parsed.size,
    initialBoard: parsed.initialBoard,
    toMove: parsed.toMove,
    mainline: parsed.mainline,
    comment: parsed.comment,
    targetColor,
    targetStones,
  }
})

/**
 * Returns true when every original target stone has been removed from the
 * given board (i.e. the capture goal is achieved).
 */
export function isPuzzleSolvedOnBoard(board, targetStones) {
  for (const [r, c] of targetStones) {
    if (board[r] && board[r][c] !== EMPTY) return false
  }
  return true
}

export const PUZZLE_BY_ID = Object.fromEntries(PUZZLES.map(p => [p.id, p]))

export const PUZZLE_CATEGORIES = ['capture', 'life', 'death', 'tesuji']

export const DIFFICULTY_ORDER = ['beginner', 'easy', 'medium', 'hard']

export function difficultyColor(diff) {
  switch (diff) {
    case 'beginner': return 'text-green-300 border-green-500/30 bg-green-900/20'
    case 'easy':     return 'text-cyan-300  border-cyan-500/30  bg-cyan-900/20'
    case 'medium':   return 'text-amber-300 border-amber-500/30 bg-amber-900/20'
    case 'hard':     return 'text-red-300   border-red-500/30   bg-red-900/20'
    default:         return 'text-forest-300 border-forest-600/30 bg-forest-800/20'
  }
}
