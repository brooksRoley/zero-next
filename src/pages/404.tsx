import Head from 'next/head'
import Link from 'next/link'
import { route, type RouteKey } from 'src/lib/routes'

const DESTINATIONS: RouteKey[] = ['home', 'resume', 'theater', 'intake']

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-forest-950 text-forest-100 flex items-center">
      <Head>
        <title>Page not found | Brooks Roley</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-forest-400">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">This page doesn&apos;t exist.</h1>
        <p className="mt-4 text-forest-300">It may have moved, or the link has a typo. Try one of these:</p>
        <ul className="mt-8 flex flex-wrap gap-3">
          {DESTINATIONS.map((key) => (
            <li key={key}>
              <Link
                href={route(key).href}
                className="inline-block rounded-lg border border-forest-700/60 px-4 py-2 text-sm font-medium hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 transition-colors"
              >
                {route(key).label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
