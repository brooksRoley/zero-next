// Shared timing & easing constants so every tactile interaction speaks the
// same language. Change a value here, it propagates across the UI.

export const TIMING = {
  // Feedback must begin within ~100ms to feel instantaneous.
  feedbackBudgetMs: 100,

  // Stone placement animation duration (matches `stoneDrop` keyframes).
  stoneDropMs: 280,

  // Ripple on click.
  rippleMs: 500,

  // Capture eject (matches `captureEject` keyframes).
  captureEjectMs: 420,

  // Wrong-move feedback window.
  wrongFlashMs: 600,

  // Post-solve auto-advance pause.
  postSolvePauseMs: 1200,

  // Transition scatter/dropIn phases.
  scatterMs: 900,
  dropInMs: 700,
}

// The house's only easing curves. globals.css mirrors each as `--ease-<name>`
// and Tailwind exposes them as `ease-<name>`; motionTokens.test.ts fails if a
// stylesheet writes its own cubic-bezier or the two copies drift.
export const EASING = {
  // Overshoot — the springy, tactile curve used everywhere pieces "land".
  overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Fast-in, slow-out: responsiveness with physical drag.
  responsive: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  // Heavy, weighted curve for large transitions.
  weighted: 'cubic-bezier(0.65, 0, 0.35, 1)',
  // Entrances: arrives fast, settles long. Reveals, cards, hero lines.
  settle: 'cubic-bezier(0.22, 1, 0.36, 1)',
  // Exits: leaves slowly then accelerates away (captured stones, dismissals).
  exit: 'cubic-bezier(0.55, 0, 0.9, 0.4)',
}

// Durations for UI chrome. Game pieces keep their own TIMING values above.
export const DURATION = {
  tap: 150, // hover, press, focus
  ui: 250, // menus, toggles, small panels
  enter: 500, // something arriving on screen
}

// Haptic strengths in ms — short = click, long = impact.
export const HAPTIC = {
  tap: 8,
  place: 12,
  wrong: 25,
  capture: [12, 20, 18],
  levelUp: [20, 40, 30, 60],
}
