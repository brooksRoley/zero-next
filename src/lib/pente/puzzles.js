/**
 * Pente Puzzle Catalog
 * Each puzzle is a frozen board state with known correct move(s).
 * Board format: 19x19 2D array — 0=EMPTY, 1=BLACK, 2=WHITE
 */
import { BOARD_SIZE, EMPTY, BLACK, WHITE, RED, BLUE } from './constants'

// Helper: create empty 19x19 board, then place stones
function makeBoard(stones) {
  const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY))
  for (const [row, col, color] of stones) {
    board[row][col] = color
  }
  return board
}

const B = BLACK
const W = WHITE
const R = RED
const U = BLUE // U for blUe to avoid conflicts

export const PUZZLE_CATEGORIES = ['capture', 'best_capture', 'five_in_a_row', 'defense', 'opening', 'mixed', 'teamplay']
export const DIFFICULTY_LABELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

// Map difficulty to ELO rating for puzzles
const DIFFICULTY_RATINGS = { 1: 850, 2: 1050, 3: 1300, 4: 1600 }

export const puzzles = [
  // ───────────────────── CAPTURE (Difficulty 1-2) ─────────────────────
  {
    id: 'capture-001',
    title: 'First Capture',
    description: 'Black to move. Capture a white pair.',
    category: 'capture',
    difficulty: 1,
    // B at (9,9), W pair at (9,7)-(9,8). Black plays (9,6) to flank.
    // Pattern: B(9,6)-W(9,7)-W(9,8)-B(9,9)
    board: makeBoard([
      [9, 9, B], [9, 7, W], [9, 8, W],
      [8, 8, B], [10, 10, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 6 }],
    hint: 'Look for a pair of white stones you can flank with your existing stone.',
    explanation: 'Playing at (9,6) creates the pattern B(9,6)-W(9,7)-W(9,8)-B(9,9), capturing the white pair.',
  },
  {
    id: 'capture-002',
    title: 'Diagonal Snare',
    description: 'Black to move. Capture a white pair on the diagonal.',
    category: 'capture',
    difficulty: 1,
    // B at (6,6), W pair at (7,7)-(8,8). Black plays (9,9) to flank.
    // Pattern: B(6,6)-W(7,7)-W(8,8)-B(9,9)
    board: makeBoard([
      [6, 6, B],
      [7, 7, W], [8, 8, W],
      [10, 10, B], [5, 5, W], [11, 9, B],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 9 }],
    hint: 'Check the diagonal. Can you flank a pair of white stones?',
    explanation: 'Playing at (9,9) creates the pattern B(6,6)-W(7,7)-W(8,8)-B(9,9), capturing the white pair.',
  },
  {
    id: 'capture-003',
    title: 'Double Capture',
    description: 'Black to move. Capture two pairs at once!',
    category: 'capture',
    difficulty: 2,
    // Horizontal: B(7,5)-W(7,6)-W(7,7)-B(7,8) captures the pair
    // Vertical: B(7,8)-W(8,8)-W(9,8)-B(10,8) captures the pair
    // Playing B at (7,8) triggers BOTH captures
    board: makeBoard([
      [7, 5, B], [7, 6, W], [7, 7, W],
      [8, 8, W], [9, 8, W], [10, 8, B],
      [6, 4, B], [12, 12, W], [4, 10, B],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 7, col: 8 }],
    hint: 'One move can capture in two directions at once.',
    explanation: 'Playing at (7,8) captures BOTH the horizontal pair W(7,6)-W(7,7) flanked by B(7,5), AND the vertical pair W(8,8)-W(9,8) flanked by B(10,8). Two captures in one move!',
  },

  // ─────────────── BEST CAPTURE — classification (2-3) ────────────────
  // These puzzles present multiple *legal* captures and ask the player
  // to classify the strongest one. Every candidate captures; rationale
  // explains the tradeoff so wrong answers teach instead of punish.
  {
    id: 'best-cap-001',
    title: 'Two Captures — One Builds',
    description: 'Black to move. Both moves capture a white pair. Which is stronger?',
    category: 'best_capture',
    difficulty: 2,
    // A = (5,6): captures W(5,7)-W(5,8) via B(5,9) AND extends B(5,4)-B(5,5) into a three.
    // B = (12,2): captures W(12,3)-W(12,4) via B(12,5). Clean capture, no follow-up.
    board: makeBoard([
      [5, 4, B], [5, 5, B], [5, 7, W], [5, 8, W], [5, 9, B],
      [12, 3, W], [12, 4, W], [12, 5, B],
      [9, 9, B], [8, 8, W], [3, 10, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    candidates: [
      {
        row: 5, col: 6, label: 'A', quality: 10,
        rationale: 'Captures the pair AND creates a three-in-a-row with B(5,4)-B(5,5)-B(5,6). The capture pays double: material plus a live offensive threat.',
      },
      {
        row: 12, col: 2, label: 'B', quality: 4,
        rationale: 'Captures the pair cleanly, but the resulting stone is isolated at the edge. No follow-up threat — White gets to set the next agenda.',
      },
    ],
    solutions: [{ row: 5, col: 6 }],
    hint: 'Both moves capture. Ask which capture also sets up your next move.',
    explanation: 'In Pente, a capture is most valuable when it does double duty. (5,6) removes the white pair AND joins B(5,4)-B(5,5) to form a live three. (12,2) captures but dies on the edge.',
  },
  {
    id: 'best-cap-002',
    title: 'Capture That Saves the Game',
    description: 'Black to move. Two captures are available — but White is one move from five.',
    category: 'best_capture',
    difficulty: 3,
    // White has four in a row at row 6: (6,3)-(6,6). Left end (6,2) already blocked by B.
    // Only (6,7) blocks the five. Luckily, (6,7) is also a capture: W(6,8)-W(6,9) flanked by B(6,10).
    // A = (6,7): captures AND blocks the winning five.
    // B = (12,4): captures W(12,5)-W(12,6) via B(12,7). Nice material — but Black loses next turn to W(6,7).
    board: makeBoard([
      [6, 2, B], [6, 3, W], [6, 4, W], [6, 5, W], [6, 6, W],
      [6, 8, W], [6, 9, W], [6, 10, B],
      [12, 5, W], [12, 6, W], [12, 7, B],
      [8, 8, B], [4, 4, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    candidates: [
      {
        row: 6, col: 7, label: 'A', quality: 10,
        rationale: 'Captures W(6,8)-W(6,9) AND blocks White\'s four-in-a-row from becoming five. The only capture that also saves the game.',
      },
      {
        row: 12, col: 4, label: 'B', quality: 1,
        rationale: 'A real capture, but White plays (6,7) next turn for five-in-a-row. You won a pair and lost the game.',
      },
    ],
    solutions: [{ row: 6, col: 7 }],
    hint: 'One capture saves the game. Count White\'s stones on row 6.',
    explanation: 'White threatens five-in-a-row at (6,7). (6,7) is ALSO a capture square (W(6,8)-W(6,9) flanked by B(6,10)). One move does two jobs: capture + block. The other capture is materially equivalent but you lose next turn.',
  },
  {
    id: 'best-cap-003',
    title: 'Whose Pair to Capture',
    description: 'Black to move in Free-for-All. Three captures available — which opponent to slow down?',
    category: 'best_capture',
    difficulty: 3,
    // FFA: Black vs Red (3 captures, near winning), Blue (1 capture), White (0 captures).
    // A = (9,6): captures R(9,7)-R(9,8) via B(9,9). Slows the leader. BEST.
    // B = (6,9): captures U(7,9)-U(8,9) via B(9,9). Secondary threat.
    // C = (14,6): captures W(14,7)-W(14,8) via B(14,9). Least urgent.
    board: makeBoard([
      [9, 9, B], [9, 7, R], [9, 8, R],
      [7, 9, U], [8, 9, U],
      [14, 7, W], [14, 8, W], [14, 9, B],
      [4, 4, B], [11, 11, R], [5, 12, U], [16, 3, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    candidates: [
      {
        row: 9, col: 6, label: 'A', quality: 10,
        rationale: 'Captures Red\'s pair. Red has 3 captures already — two away from winning. Slowing the leader is the highest-leverage move.',
      },
      {
        row: 6, col: 9, label: 'B', quality: 5,
        rationale: 'Captures Blue\'s pair. Blue only has 1 capture — not the immediate threat. Useful material, wrong priority.',
      },
      {
        row: 14, col: 6, label: 'C', quality: 2,
        rationale: 'Captures White\'s pair. White has zero captures. Least urgent — you\'re giving the leader another turn.',
      },
    ],
    solutions: [{ row: 9, col: 6 }],
    hint: 'All three moves capture. Which opponent is closest to 5 captures?',
    explanation: 'In FFA, captures aren\'t all worth the same. Red has 3 captures — one more and they\'re at match point. Capturing Red\'s pair is the highest-leverage move. Capturing the 0-capture or 1-capture opponents is material for its own sake; it lets the leader keep building.',
    gameMode: 'ffa4',
    teamContext: 'Free-for-All: Red (3 captures) is closest to winning. Blue (1), White (0).',
  },

  // ───────────────── FIVE IN A ROW (Difficulty 1-2) ──────────────────
  {
    id: 'five-001',
    title: 'Complete the Line',
    description: 'White to move. Win with five in a row.',
    category: 'five_in_a_row',
    difficulty: 1,
    // W has four horizontal at (5,5)-(5,8). Play either end.
    board: makeBoard([
      [5, 5, W], [5, 6, W], [5, 7, W], [5, 8, W],
      [6, 5, B], [6, 6, B], [6, 7, B], [4, 6, B],
    ]),
    playerToMove: W,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 5, col: 4 }, { row: 5, col: 9 }],
    hint: 'Count the horizontal line of white stones.',
    explanation: 'White has four in a row at (5,5)-(5,8). Playing at either end — (5,4) or (5,9) — completes five in a row for the win!',
  },
  {
    id: 'five-002',
    title: 'Diagonal Victory',
    description: 'Black to move. Complete five on the diagonal.',
    category: 'five_in_a_row',
    difficulty: 1,
    // B at (4,4),(5,5),(7,7),(8,8) with gap at (6,6)
    board: makeBoard([
      [4, 4, B], [5, 5, B], [7, 7, B], [8, 8, B],
      [4, 5, W], [5, 6, W], [7, 6, W], [8, 7, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 6, col: 6 }],
    hint: 'There is a gap in the diagonal. Fill it.',
    explanation: 'Black has stones at (4,4), (5,5), (7,7), (8,8) with a gap at (6,6). Filling the gap completes five in a row diagonally.',
  },
  {
    id: 'five-003',
    title: 'Hidden Five',
    description: 'White to move. Find the winning line.',
    category: 'five_in_a_row',
    difficulty: 2,
    // Vertical: W at (3,9),(4,9),(5,9),(6,9) — extend to (7,9) or (2,9)
    // Distractor: horizontal three at row 9 that doesn't win
    board: makeBoard([
      [3, 9, W], [4, 9, W], [5, 9, W], [6, 9, W],
      [9, 3, W], [9, 4, W], [9, 5, W],
      [3, 8, B], [5, 8, B], [7, 8, B], [9, 6, B], [10, 9, B],
    ]),
    playerToMove: W,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 7, col: 9 }, { row: 2, col: 9 }],
    hint: 'Look at the vertical lines, not just horizontal.',
    explanation: 'White has four vertically in column 9: (3,9)-(6,9). Playing at (7,9) or (2,9) completes five. The horizontal three at row 9 is a distraction.',
  },

  // ──────────────────── DEFENSE (Difficulty 2-3) ─────────────────────
  {
    id: 'defense-001',
    title: 'Block or Lose',
    description: 'Black to move. Stop White from winning next turn.',
    category: 'defense',
    difficulty: 2,
    // White open four at (3,3)-(3,6). Both ends open.
    board: makeBoard([
      [3, 3, W], [3, 4, W], [3, 5, W], [3, 6, W],
      [5, 5, B], [6, 6, B], [7, 3, B], [8, 8, B],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 3, col: 2 }, { row: 3, col: 7 }],
    hint: 'White has four in a row with open ends. Block one!',
    explanation: 'White has an open four at (3,3)-(3,6). You must block at (3,2) or (3,7). With both ends open, White will still win next turn — in a real game, you should have prevented this earlier!',
  },
  {
    id: 'defense-002',
    title: 'Prevent the Capture Win',
    description: 'White to move. Black has 4 captures — stop the 5th!',
    category: 'defense',
    difficulty: 2,
    // Black can play (8,5) to capture W(8,6)-W(8,7) flanked by B(8,8)
    // That would be Black's 5th capture = win. White must block at (8,5).
    board: makeBoard([
      [8, 8, B], [8, 6, W], [8, 7, W],
      [7, 7, B], [9, 9, B], [6, 6, W], [10, 5, W],
      [5, 5, B], [4, 4, B],
    ]),
    playerToMove: W,
    blackCaptures: 4,
    whiteCaptures: 1,
    solutions: [{ row: 8, col: 5 }],
    hint: 'Black has 4 captures and is threatening a 5th. Where would Black capture next?',
    explanation: 'Black threatens to play at (8,5), which would capture the white pair at (8,6)-(8,7) by flanking with B(8,8). That would be Black\'s 5th capture — an instant win. White must play at (8,5) to block.',
  },
  {
    id: 'defense-003',
    title: 'Block the Diagonal Threat',
    description: 'Black to move. White is one away from five on a diagonal.',
    category: 'defense',
    difficulty: 3,
    // White diagonal: (2,2),(3,3),(4,4),(5,5) — needs (6,6) or (1,1)
    // White also has horizontal buildup at row 6
    board: makeBoard([
      [2, 2, W], [3, 3, W], [4, 4, W], [5, 5, W],
      [6, 5, W], [6, 4, W], [6, 3, W],
      [7, 7, B], [8, 8, B], [3, 5, B], [1, 3, B],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 6, col: 6 }, { row: 1, col: 1 }],
    hint: 'White has four on a diagonal. Which end is more dangerous?',
    explanation: 'White has four diagonally at (2,2)-(5,5). Blocking at (6,6) is strategically superior because it also prevents White from extending the horizontal group at row 6. Blocking at (1,1) stops the diagonal but leaves the row 6 threat alive.',
  },

  // ──────────────────── OPENING (Difficulty 1-2) ─────────────────────
  {
    id: 'opening-001',
    title: 'Center Control',
    description: 'Black opens. Where is the strongest first move?',
    category: 'opening',
    difficulty: 1,
    board: makeBoard([]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 9 }],
    hint: 'In Pente, the center of the board is the most powerful position.',
    explanation: 'The center intersection (9,9) is the strongest opening move. It maximizes your influence in all directions and gives the most options for building lines.',
  },
  {
    id: 'opening-002',
    title: 'Pro Rule Response',
    description: 'White responds to Black\'s center opening. Build influence.',
    category: 'opening',
    difficulty: 2,
    board: makeBoard([
      [9, 9, B],
    ]),
    playerToMove: W,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [
      { row: 8, col: 8 }, { row: 8, col: 9 }, { row: 8, col: 10 },
      { row: 9, col: 8 }, { row: 9, col: 10 },
      { row: 10, col: 8 }, { row: 10, col: 9 }, { row: 10, col: 10 },
    ],
    hint: 'Stay close to the center to contest Black\'s influence.',
    explanation: 'Playing adjacent to the center stone is the strongest response. It immediately contests the center and sets up potential captures and lines.',
  },

  // ──────────────────── MIXED (Difficulty 3-4) ───────────────────────
  {
    id: 'mixed-001',
    title: 'Capture and Threaten',
    description: 'Black to move. Capture AND create a three-in-a-row.',
    category: 'mixed',
    difficulty: 3,
    // Capture: B(6,3)-W(6,4)-W(6,5)-B(6,6) captures the pair
    // Also: B(6,6),(7,7),(8,8) creates diagonal three
    board: makeBoard([
      [6, 3, B],
      [6, 4, W], [6, 5, W],
      [7, 7, B], [8, 8, B],
      [5, 5, W], [4, 4, W], [10, 10, W],
      [3, 3, B], [11, 11, B],
    ]),
    playerToMove: B,
    blackCaptures: 1,
    whiteCaptures: 0,
    solutions: [{ row: 6, col: 6 }],
    hint: 'Can one move both capture and build a line?',
    explanation: 'Playing at (6,6) captures the white pair at (6,4)-(6,5) flanked by B(6,3), AND creates a three-in-a-row diagonal with B(7,7) and B(8,8). A powerful dual-purpose move!',
  },
  {
    id: 'mixed-002',
    title: 'Fork: Two Ways to Win',
    description: 'White to move. Create an unstoppable double threat.',
    category: 'mixed',
    difficulty: 3,
    // Horizontal: W(4,3),(4,4),(4,5) — playing (4,6) makes open four
    // Vertical: W(4,6),(5,6),(6,6) — playing (4,6) creates open three
    // Black can't block both
    board: makeBoard([
      [4, 3, W], [4, 4, W], [4, 5, W],
      [5, 6, W], [6, 6, W],
      [3, 3, B], [5, 4, B], [6, 5, B], [7, 7, B], [8, 6, B],
    ]),
    playerToMove: W,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 4, col: 6 }],
    hint: 'Find a move that creates two threats at once.',
    explanation: 'Playing at (4,6) creates an open four horizontally W(4,3)-(4,6) that Black must block, AND an open three vertically W(4,6),(5,6),(6,6). Black cannot block both — White wins!',
  },
  {
    id: 'mixed-003',
    title: 'Capture for the Win',
    description: 'Black to move. Find all winning moves.',
    category: 'mixed',
    difficulty: 4,
    // Capture win: B(10,5)-W(10,6)-W(10,7)-B(10,8) = 5th capture
    // Five-in-a-row win: B(12,7) or B(12,12) extends B(12,8)-(12,11)
    board: makeBoard([
      [10, 5, B], [10, 6, W], [10, 7, W],
      [12, 8, B], [12, 9, B], [12, 10, B], [12, 11, B],
      [8, 8, B], [7, 7, W], [9, 9, W],
      [5, 5, B], [11, 11, W],
    ]),
    playerToMove: B,
    blackCaptures: 4,
    whiteCaptures: 2,
    solutions: [{ row: 10, col: 8 }, { row: 12, col: 7 }, { row: 12, col: 12 }],
    hint: 'You have 4 captures. But also check for five in a row.',
    explanation: 'Multiple winning moves! Playing at (10,8) captures the pair at (10,6)-(10,7) for Black\'s 5th capture — an instant win. Playing (12,7) or (12,12) also wins by completing five in a row. Finding ALL wins is the mark of a strong player.',
  },
  {
    id: 'mixed-004',
    title: 'The Only Move',
    description: 'Black to move. Only one move prevents an immediate loss.',
    category: 'mixed',
    difficulty: 4,
    // White four at (6,4)-(6,7). Left end (6,3) blocked by B.
    // Only (6,8) prevents the five.
    board: makeBoard([
      [6, 4, W], [6, 5, W], [6, 6, W], [6, 7, W],
      [6, 3, B],
      [7, 5, B], [8, 5, B], [5, 8, B], [4, 8, B],
      [8, 8, W], [9, 9, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 6, col: 8 }],
    hint: 'White has four in a row, but one end is already blocked...',
    explanation: 'White has four in a row at (6,4)-(6,7). The left end at (6,3) is already blocked by Black. The ONLY move to prevent White from winning is to block the right end at (6,8).',
  },

  // ───────────────────── TEAMPLAY (Difficulty 2-3) ─────────────────────
  {
    id: 'team-001',
    title: 'Teammate Bracket',
    description: 'Black to move. Your teammate (White) is already positioned. Capture the red pair using your teammate as a bracket.',
    category: 'teamplay',
    difficulty: 2,
    // White (teammate) at (9,6). Red pair at (9,7)-(9,8). Black plays (9,9) to capture.
    // Pattern: W(9,6)-R(9,7)-R(9,8)-B(9,9) — teammate bracket capture
    board: makeBoard([
      [9, 6, W], [9, 7, R], [9, 8, R],
      [8, 8, B], [10, 6, W], [8, 5, R], [10, 10, U],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 9 }],
    hint: 'Your teammate\'s stone at (9,6) can serve as the far bracket for a capture.',
    explanation: 'In 2v2, your teammate\'s stones count as brackets. W(9,6)-R(9,7)-R(9,8)-B(9,9) captures the red pair. Shared capture count goes up!',
    gameMode: 'team2v2',
    teamContext: 'You (Black) and White are teammates vs Red and Blue.',
  },
  {
    id: 'team-002',
    title: 'Don\'t Block Your Ally',
    description: 'Black to move. Your teammate (White) has an open three. Find the move that defends without blocking it.',
    category: 'teamplay',
    difficulty: 3,
    // White has open three at row 7: (7,7)-(7,8)-(7,9) with open ends at (7,6) and (7,10).
    // Red has threatening three at row 9: (9,7)-(9,8)-(9,9) open at (9,6) and (9,10).
    // Wrong: playing (7,10) blocks White's extension. Correct: play (9,6) to block Red without hurting White.
    board: makeBoard([
      [7, 7, W], [7, 8, W], [7, 9, W],
      [9, 7, R], [9, 8, R], [9, 9, R],
      [8, 5, B], [6, 6, B], [10, 10, U], [8, 11, U],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 6 }],
    hint: 'Block the opponent\'s threat, but make sure you\'re not also blocking your teammate\'s open line.',
    explanation: 'Playing (9,6) blocks Red\'s open three while leaving White\'s open three at row 7 intact. Playing (9,10) would also block Red, but (9,6) is equally good. Don\'t play near (7,6) or (7,10) — those are White\'s extension points!',
    gameMode: 'team2v2',
    teamContext: 'You (Black) and White are teammates vs Red and Blue.',
  },
  {
    id: 'team-003',
    title: 'Team Capture Race',
    description: 'Black to move. Your team has 4 captures. Find the move that gets the winning 5th capture.',
    category: 'teamplay',
    difficulty: 2,
    // Team has 4 captures already. Red pair at (10,8)-(10,9), Black at (10,10).
    // Black plays (10,7) to capture. B(10,7)-R(10,8)-R(10,9)-B(10,10)
    board: makeBoard([
      [10, 10, B], [10, 8, R], [10, 9, R],
      [9, 9, W], [8, 8, W], [11, 11, U], [8, 6, B],
      [7, 7, R], [12, 12, U],
    ]),
    playerToMove: B,
    blackCaptures: 4,  // team total is 4 already
    whiteCaptures: 0,
    solutions: [{ row: 10, col: 7 }],
    hint: 'Your team needs one more capture to win. Look for a red pair to bracket.',
    explanation: 'B(10,7) flanks the red pair at (10,8)-(10,9) with B(10,10). That\'s the team\'s 5th capture — you win!',
    gameMode: 'team2v2',
    teamContext: 'You (Black) and White are teammates. Your team has 4 captures — one more wins!',
  },
  {
    id: 'team-004',
    title: 'FFA Capture Choice',
    description: 'Black to move in Free-for-All. Choose which opponent\'s pair to capture for maximum advantage.',
    category: 'teamplay',
    difficulty: 3,
    // Red pair at (9,7)-(9,8) with B at (9,9) — B plays (9,6) to capture Red.
    // Blue pair at (7,9)-(8,9) with B at (9,9) — B plays (6,9) to capture Blue.
    // Capturing Red is better because Red has 3 captures (closer to winning).
    board: makeBoard([
      [9, 9, B], [9, 7, R], [9, 8, R],
      [7, 9, U], [8, 9, U],
      [6, 6, B], [10, 10, W], [11, 11, R], [5, 5, W],
    ]),
    playerToMove: B,
    blackCaptures: 0,
    whiteCaptures: 0,
    solutions: [{ row: 9, col: 6 }, { row: 6, col: 9 }],
    hint: 'You can capture either Red or Blue. In FFA, think about who is the bigger threat.',
    explanation: 'Both (9,6) and (6,9) are valid captures. In FFA, consider which opponent is closest to winning and capture their pair to slow them down.',
    gameMode: 'ffa4',
    teamContext: 'Free-for-All: everyone is an opponent. Both captures are correct.',
  },
  {
    id: 'team-005',
    title: 'Five Is Yours Alone',
    description: 'Black to move in 2v2. Your teammate\'s stones DON\'T count for five-in-a-row. Find the real winning move.',
    category: 'teamplay',
    difficulty: 2,
    // Black has 3 in a row at (9,7)-(9,8)-(9,9). White (teammate) at (9,10).
    // Playing (9,6) gives B four, but still not five with W in between.
    // Actually: B at (9,7),(9,8),(9,9) and (9,11). Playing (9,10) is occupied by teammate.
    // Need to find the capture win instead.
    // Red pair at (7,8)-(7,9), Black at (7,7). B plays (7,10). Team has 4 captures.
    board: makeBoard([
      [9, 7, B], [9, 8, B], [9, 9, B], [9, 10, W], [9, 11, B],
      [7, 7, B], [7, 8, R], [7, 9, R],
      [8, 6, W], [10, 12, U], [6, 6, R], [11, 11, U],
    ]),
    playerToMove: B,
    blackCaptures: 4,
    whiteCaptures: 0,
    solutions: [{ row: 7, col: 10 }],
    hint: 'Your teammate\'s stone breaks your five-in-a-row. Look for a capture win instead.',
    explanation: 'B(9,7)-(9,8)-(9,9)-W(9,10)-(9,11) is NOT five-in-a-row because White\'s stone interrupts (teammate or not, only YOUR color counts). Instead, play (7,10) to capture the red pair: B(7,7)-R(7,8)-R(7,9)-B(7,10). That\'s the 5th team capture — you win!',
    gameMode: 'team2v2',
    teamContext: 'You (Black) and White are teammates. Five-in-a-row only counts YOUR stones. But captures are shared!',
  },
]

// Attach ELO ratings to puzzles based on difficulty
puzzles.forEach(p => {
  p.rating = DIFFICULTY_RATINGS[p.difficulty] || 1000
})

export function getPuzzleById(id) {
  return puzzles.find(p => p.id === id)
}

export function getPuzzlesByCategory(category) {
  return puzzles.filter(p => p.category === category)
}

export function getPuzzlesByDifficulty(difficulty) {
  return puzzles.filter(p => p.difficulty === difficulty)
}

/**
 * Get the next recommended puzzle based on player ELO.
 * Picks the unsolved puzzle closest to the player's rating.
 */
export function getRecommendedPuzzle(playerElo, solvedIds) {
  const unsolved = puzzles.filter(p => !solvedIds.includes(p.id))
  if (unsolved.length === 0) return null
  return unsolved.reduce((best, p) =>
    Math.abs(p.rating - playerElo) < Math.abs(best.rating - playerElo) ? p : best
  )
}
