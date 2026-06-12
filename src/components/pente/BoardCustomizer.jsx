import React from 'react';
import { BOARD_THEMES, STONE_STYLES, EFFECT_MODES } from 'src/lib/pente/boardThemes';

// Mini stone previews for the stone-style picker (one dark, one light stone)
const STONE_PREVIEWS = {
  glass: [
    { background: 'radial-gradient(circle at 36% 34%, #555 0%, #1a1a1a 55%, #000 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.16), 0 2px 4px rgba(0,0,0,0.45)' },
    { background: 'radial-gradient(circle at 36% 34%, #fff 0%, #e0e0e0 55%, #c8c8c8 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.3)' },
  ],
  matte: [
    { background: '#1f2430', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' },
    { background: '#e8e6e1', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' },
  ],
  gem: [
    { background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 30%), radial-gradient(circle at 50% 60%, #374151 0%, #0b0f19 80%)', boxShadow: '0 0 6px rgba(148,163,184,0.55)' },
    { background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 32%), radial-gradient(circle at 50% 60%, #f8fafc 0%, #cbd5e1 85%)', boxShadow: '0 0 6px rgba(241,245,249,0.7)' },
  ],
};

/**
 * Floating panel for per-player board customization:
 * board skin, stone style, and motion-effects mode.
 */
export default function BoardCustomizer({ open, prefs, onChange, onClose }) {
  if (!open) return null;

  const sectionLabel = 'text-[10px] uppercase tracking-wider text-forest-500 mb-1.5';

  return (
    <div className="fixed right-3 top-28 z-50 w-60 rounded-2xl border border-forest-700/50 bg-forest-950/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white tracking-wide">Board Style</h3>
        <button
          onClick={onClose}
          aria-label="Close board style panel"
          className="text-forest-500 hover:text-forest-200 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* Board skins */}
      <p className={sectionLabel}>Skin</p>
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {BOARD_THEMES.map(theme => {
          const active = prefs.theme === theme.key;
          return (
            <button
              key={theme.key}
              onClick={() => onChange({ theme: theme.key })}
              title={theme.label}
              aria-label={`${theme.label} board skin`}
              aria-pressed={active}
              className={`aspect-square rounded-lg transition-all duration-150 ${
                active
                  ? 'ring-2 ring-candy-pink ring-offset-2 ring-offset-forest-950 scale-105'
                  : 'ring-1 ring-forest-700/60 hover:ring-forest-500 hover:scale-105'
              }`}
              style={{ background: theme.swatch }}
            />
          );
        })}
      </div>
      <p className="text-[10px] text-forest-400 -mt-3 mb-4">
        {BOARD_THEMES.find(t => t.key === prefs.theme)?.label}
      </p>

      {/* Stone styles */}
      <p className={sectionLabel}>Stones</p>
      <div className="flex gap-1.5 mb-4">
        {STONE_STYLES.map(style => {
          const active = prefs.stones === style.key;
          const [dark, light] = STONE_PREVIEWS[style.key];
          return (
            <button
              key={style.key}
              onClick={() => onChange({ stones: style.key })}
              title={style.description}
              aria-pressed={active}
              className={`flex-1 flex flex-col items-center gap-1 rounded-lg px-1 py-2 border transition-colors ${
                active
                  ? 'bg-forest-800/80 border-candy-pink/60 text-white'
                  : 'bg-forest-900/60 border-forest-700/40 text-forest-400 hover:text-forest-200 hover:border-forest-500'
              }`}
            >
              <span className="flex -space-x-1">
                <span className="w-4 h-4 rounded-full" style={dark} />
                <span className="w-4 h-4 rounded-full" style={light} />
              </span>
              <span className="text-[10px]">{style.label}</span>
            </button>
          );
        })}
      </div>

      {/* Motion effects */}
      <p className={sectionLabel}>Motion</p>
      <div className="flex gap-1.5">
        {EFFECT_MODES.map(mode => {
          const active = prefs.effects === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => onChange({ effects: mode.key })}
              title={mode.description}
              aria-pressed={active}
              className={`flex-1 rounded-lg px-2 py-2 text-[11px] border transition-colors ${
                active
                  ? 'bg-forest-800/80 border-candy-pink/60 text-white'
                  : 'bg-forest-900/60 border-forest-700/40 text-forest-400 hover:text-forest-200 hover:border-forest-500'
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-forest-500 mt-2 leading-snug">
        Saved on this device — your opponent sees their own style.
      </p>
    </div>
  );
}
