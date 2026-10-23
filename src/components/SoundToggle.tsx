import { useSyncExternalStore } from 'react'
import { isMuted, setMuted, subscribeMuted } from 'src/lib/ui/audioContext'

/** The site-wide mute, shared by every game. The server renders "sound on". */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(subscribeMuted, isMuted, () => false)
}

/** One button that mutes or unmutes every game on the site. `className` sets its shape and colours. */
export default function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useSoundMuted()
  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label="Mute sound in every game"
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={() => setMuted(!muted)}
      className={`inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 ${className}`}
    >
      <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h3l4-3.5v11L6 12H3Z" fill="currentColor" stroke="none" />
        {muted ? (
          <path d="m13 7.5 5 5m0-5-5 5" />
        ) : (
          <>
            <path d="M13 7.5a3.5 3.5 0 0 1 0 5" />
            <path d="M15.5 5a7 7 0 0 1 0 10" />
          </>
        )}
      </svg>
    </button>
  )
}
