import Link from 'next/link'
import { track } from 'src/lib/analytics'

type Props = {
  /** The page the link lives on — recorded on the cta_click event. */
  page: string
  /** A short slug (e.g. "guestbook_tip") stored in event metadata.location. */
  location: string
  label?: string
  /** Full class override so each page can match its own aesthetic. */
  className?: string
}

// Small "tip jar" cross-link to /funding, matching the inline pattern in
// hardwood.tsx and pente.js. Fires a cta_click (beacon) so funding-intent
// traffic is measurable in /admin/analytics. Copy is a soft ask, never a
// payment widget — /funding itself gates the actual tip buttons until Stripe
// is live.
export default function SupportCta({
  page,
  location,
  label = 'Enjoying this? Support development →',
  className = 'text-candy-500 transition-colors hover:text-candy-400',
}: Props) {
  return (
    <Link
      href="/funding"
      onClick={() =>
        track('cta_click', { page, metadata: { location }, beacon: true })
      }
      className={className}
    >
      {label}
    </Link>
  )
}
