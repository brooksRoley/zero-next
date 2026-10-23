import Head from 'next/head'
import Reveal from 'src/components/Reveal'
import { track } from 'src/lib/analytics'

// Contact is links only (2026-10-23). The old page took text and voice notes
// from anyone on the internet: browser uploads to a public bucket, no size or
// length limit, client-supplied audio URLs emailed to the owner. It also never
// worked in production (the table and bucket were never created). Links store
// nothing, so there is nothing to abuse or to protect. Do not bring back an
// open upload or a stored message thread without a security review.
const CONTACTS = [
  {
    key: 'email',
    href: 'mailto:brooksroley@gmail.com',
    title: 'Email',
    detail: 'brooksroley@gmail.com',
  },
  {
    key: 'linkedin',
    href: 'https://www.linkedin.com/in/brooksroley',
    title: 'LinkedIn',
    detail: 'linkedin.com/in/brooksroley',
    external: true,
  },
  {
    key: 'calendly',
    href: 'https://calendly.com/brooksroley/',
    title: 'Book a call',
    detail: 'Pick a time on Calendly',
    external: true,
  },
]

export default function Contact() {
  return (
    <main className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Contact | Brooks Roley</title>
        <meta name="description" content="Reach Brooks Roley by email, on LinkedIn, or book a call." />
      </Head>

      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Get in touch</h1>
        </Reveal>
        <Reveal delay={100}>
          <p className="mb-10 text-lg text-forest-200">
            Email is the quickest way to reach me. I&apos;ll reply.
          </p>
        </Reveal>

        <ul className="grid gap-3 sm:grid-cols-3">
          {CONTACTS.map((c) => (
            <li key={c.key}>
              <a
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => track('cta_click', { page: '/intake', metadata: { location: `contact_${c.key}` } })}
                className="flex h-full flex-col gap-1 rounded-xl border border-forest-700/50 bg-forest-900/40 p-5 transition-colors hover:border-forest-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candy-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950"
              >
                <span className="text-base font-semibold text-white">{c.title}</span>
                <span className="break-all text-sm text-forest-400">{c.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
