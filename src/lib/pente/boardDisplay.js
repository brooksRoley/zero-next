import { BLACK, WHITE, RED, BLUE, PLAYER_COLORS } from 'src/lib/pente/constants'

/**
 * Pure presentation helpers for the Pente board UI — cell/style class
 * lookups plus the static mode-preset and rules-copy tables. No React, no
 * game state. Split out of src/pages/posts/pente.js so the page component
 * stops growing with content that never changes at runtime.
 */

// Map cell value to CSS class
export function cellClass(cell) {
  switch (cell) {
    case BLACK: return 'black'
    case WHITE: return 'white'
    case RED:   return 'red'
    case BLUE:  return 'blue'
    default:    return ''
  }
}

// Map cell value to capture-eject CSS class
export function captureClass(color) {
  switch (color) {
    case BLACK: return 'capture-black'
    case WHITE: return 'capture-white'
    case RED:   return 'capture-red'
    case BLUE:  return 'capture-blue'
    default:    return 'capture-black'
  }
}

// Get hover class for current player
export function hoverClass(player) {
  return `board-hover-${PLAYER_COLORS[player]?.css || 'black'}`
}

// Game mode presets for the mode selector
export const MODE_PRESETS = [
  { key: 'local', label: 'Local', modeKey: null, bots: false },
  { key: 'bot1v1', label: 'vs Bot', modeKey: 'classic', bots: true },
  { key: 'bot4ffa', label: 'vs 3 Bots', modeKey: 'ffa4', bots: true },
  { key: 'bot2v2', label: '2v2 Bots', modeKey: 'team2v2', bots: true },
  { key: 'online', label: 'Online', modeKey: null, bots: false },
]

// Rules text per game mode
export const MODE_RULES = {
  classic: {
    title: 'Classic Pente',
    captures: 'Bracket exactly two opponent stones with yours in a straight line to capture them.',
  },
  ffa4: {
    title: 'Free-for-All (4 Players)',
    captures: 'You can capture any opponent\'s pair. All three other players are opponents. Pairs must be the same color — you can\'t capture a mixed pair.',
  },
  team2v2: {
    title: '2v2 Team Pente',
    captures: 'You and your teammate share a capture count. Your teammate\'s stones count as brackets for captures — their stone at one end and yours at the other can capture an opponent pair between you. Five-in-a-row must be your stones only.',
  },
}

export function modeBtnClass(active) {
  return `px-3 py-2 text-xs transition-colors ${
    active
      ? 'bg-forest-700/70 text-white'
      : 'bg-forest-900/60 text-forest-400 hover:text-forest-200'
  }`
}

export function actionBtnClass(active = false) {
  return `text-xs px-3 py-2 rounded-lg border transition-colors min-h-[36px] ${
    active
      ? 'bg-cyan-900/50 text-cyan-300 border-cyan-600/50'
      : 'bg-forest-900/60 text-forest-400 hover:text-forest-200 border-forest-700/40 hover:border-forest-500'
  }`
}
