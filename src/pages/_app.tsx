import '@/styles/globals.css'
import '@/styles/GameBoard.css';

import { useState, useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import NavHeader from 'src/components/NavHeader'

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

  return (
    <>
      <Head>
        <title>Brooks Roley | Software Engineer</title>
        <meta name="description" content="Brooks Roley — Software Engineer building games, tools, and things for the web." />
        <meta property="og:title" content="Brooks Roley | Software Engineer" />
        <meta property="og:description" content="Software Engineer building games, tools, and things for the web." />
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
