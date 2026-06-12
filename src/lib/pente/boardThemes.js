/**
 * boardThemes.js
 * Registry of Pente board skins, stone styles, and motion-effect modes.
 *
 * The visual definitions live in src/styles/PenteThemes.css, keyed off
 * data-theme / data-stones / data-effects attributes on .game-board.
 * This module only holds metadata the customizer UI needs (labels, swatches)
 * plus validation helpers for persisted preferences.
 */

export const BOARD_THEMES = [
  { key: 'classic', label: 'Classic Wood',    swatch: 'linear-gradient(135deg, #dfc48b 0%, #c9a65a 100%)', accent: '#ff69b4' },
  { key: 'walnut',  label: 'Midnight Walnut', swatch: 'linear-gradient(135deg, #6b4226 0%, #2e1c10 100%)', accent: '#fbbf24' },
  { key: 'nebula',  label: 'Nebula',          swatch: 'linear-gradient(135deg, #312e81 0%, #0c0a1f 100%)', accent: '#a78bfa' },
  { key: 'holo',    label: 'Hologrid',        swatch: 'linear-gradient(135deg, #0e7490 0%, #020617 100%)', accent: '#22d3ee' },
  { key: 'zen',     label: 'Zen Paper',       swatch: 'linear-gradient(135deg, #f5f0e6 0%, #d6cdb8 100%)', accent: '#40916c' },
]

export const STONE_STYLES = [
  { key: 'glass', label: 'Glass', description: 'Classic 3D polished stones' },
  { key: 'matte', label: 'Matte', description: 'Flat, minimal, high contrast' },
  { key: 'gem',   label: 'Gem',   description: 'Glossy with a luminous rim' },
]

export const EFFECT_MODES = [
  { key: 'full', label: 'Full motion', description: 'Sheen, orbit rings, win sweeps' },
  { key: 'calm', label: 'Calm',        description: 'Just stones and captures' },
]

export const DEFAULT_BOARD_PREFS = {
  theme: 'classic',
  stones: 'glass',
  effects: 'full',
}

/** Drop unknown keys/values from persisted prefs (registry may change between visits). */
export function sanitizeBoardPrefs(raw) {
  const prefs = { ...DEFAULT_BOARD_PREFS }
  if (!raw || typeof raw !== 'object') return prefs
  if (BOARD_THEMES.some(t => t.key === raw.theme)) prefs.theme = raw.theme
  if (STONE_STYLES.some(s => s.key === raw.stones)) prefs.stones = raw.stones
  if (EFFECT_MODES.some(e => e.key === raw.effects)) prefs.effects = raw.effects
  return prefs
}
