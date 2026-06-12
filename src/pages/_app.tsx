import '@/styles/globals.css'
import '@/styles/GameBoard.css';
import '@/styles/PenteThemes.css';
import '@/styles/GoBoard.css';

import { useState, useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import NavHeader from 'src/components/NavHeader'

const SESSION_ID_KEY = 'br_session_id'

function getSessionId(): string | null {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return null // sessionStorage unavailable (private mode) — still record the view
  }
}

function trackPageView(url: string) {
  // Strip query/hash so routes aggregate cleanly (UTM params live on leads already).
  const path = url.split('?')[0].split('#')[0]
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: getSessionId(),
      page: path,
      event_type: 'page_view',
      metadata: { path },
    }),
    keepalive: true,
  }).catch(() => { /* analytics must never break navigation */ })
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    const handleStart = () => setTransitioning(true)
    const handleComplete = () => {
      setTransitioning(false)
      window.scrollTo(0, 0)
    }

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [router])

  // First-party page view tracking: initial load + every client-side navigation.
  useEffect(() => {
    trackPageView(router.asPath)
    const handleRouteChange = (url: string) => trackPageView(url)
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Head>
        <title>Brooks Roley | Software Engineer</title>
        <meta name="description" content="Brooks Roley — Software Engineer building games, tools, and things for the web." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Brooks Roley | Software Engineer" />
        <meta property="og:description" content="Software Engineer building games, tools, and things for the web." />
        <meta property="og:image" content="/cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavHeader />
      <div
        className="transition-opacity duration-300 ease-in-out"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <Component {...pageProps} />
      </div>
    </>
  )
}
