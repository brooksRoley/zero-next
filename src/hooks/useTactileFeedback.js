import { useCallback } from 'react'
import useGameSounds from 'src/hooks/useGameSounds'
import { HAPTIC } from 'src/lib/ui/tactile'

/**
 * Unified tactile feedback hook. Bundles audio + haptic per named action so
 * every interaction in the Pente platform speaks the same sensory language.
 *
 * Each action fires its audio and haptic together (no awaits, no React
 * re-render blocking) so the perceived latency stays under ~100ms.
 *
 * Actions:
 *   onPlace     — stone lands on the board (user or opponent)
 *   onCapture   — a pair is ejected
 *   onCorrect   — puzzle solved at current zone
 *   onWrong     — invalid move / wrong puzzle click
 *   onLevelUp   — ELO zone transition, peak reached
 *   onGameWin   — full-game victory
 */
export default function useTactileFeedback() {
  const sounds = useGameSounds()

  const haptic = useCallback((pattern) => {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    try { navigator.vibrate(pattern) } catch { /* unsupported */ }
  }, [])

  const onPlace = useCallback(() => {
    sounds.playPlace()
    haptic(HAPTIC.place)
  }, [sounds, haptic])

  const onCapture = useCallback(() => {
    sounds.playCapture()
    haptic(HAPTIC.capture)
  }, [sounds, haptic])

  const onCorrect = useCallback(() => {
    sounds.playClimb()
    haptic(HAPTIC.tap)
  }, [sounds, haptic])

  const onWrong = useCallback(() => {
    sounds.playStumble()
    haptic(HAPTIC.wrong)
  }, [sounds, haptic])

  const onStamp = useCallback(() => {
    sounds.playStamp()
    haptic(HAPTIC.place)
  }, [sounds, haptic])

  const onLevelUp = useCallback(() => {
    sounds.playSummit()
    haptic(HAPTIC.levelUp)
  }, [sounds, haptic])

  const onGameWin = useCallback(() => {
    sounds.playWin()
    haptic(HAPTIC.levelUp)
  }, [sounds, haptic])

  return { onPlace, onCapture, onCorrect, onWrong, onStamp, onLevelUp, onGameWin }
}
