import { useId } from 'react'
import { KEYBOARD_LEGEND, TOUCH_LEGEND, keyCap } from 'src/lib/games/cloudfall/controls'
import { OUTLINE } from './paint'

/** The "how to play" key: every control, grouped into playing a piece and running the game. */
export default function ControlsKey({ touch, className = '' }: { touch: boolean; className?: string }) {
  const id = useId()
  const groups = touch ? TOUCH_LEGEND : KEYBOARD_LEGEND
  return (
    <section
      aria-labelledby={id}
      className={`w-full rounded-2xl border-2 bg-white/90 p-3 ${className}`}
      style={{ borderColor: OUTLINE, boxShadow: `0 4px 0 ${OUTLINE}` }}
    >
      <h2 id={id} className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-600">
        How to play
      </h2>
      <p className="mt-1 text-xs leading-snug text-ink-800">Fill a row from wall to wall to clear it.</p>
      {groups.map((group) => (
        <div key={group.title} className="mt-3">
          <h3 className="text-xs font-bold text-ink-950">{group.title}</h3>
          <dl className="mt-1 space-y-1">
            {group.rows.map((row) => (
              <div key={row.does} className="flex items-center justify-between gap-2">
                <dt className="flex flex-wrap gap-1">
                  {row.keys.map((k) => (
                    <kbd
                      key={k}
                      className="min-w-[1.5rem] rounded-md border bg-white px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold leading-none text-ink-950"
                      style={{ borderColor: OUTLINE, boxShadow: `0 2px 0 ${OUTLINE}` }}
                    >
                      {touch ? k : keyCap(k)}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-right text-xs leading-snug text-ink-800">{row.does}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
