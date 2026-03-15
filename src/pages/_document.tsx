import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/BRLogoBox.png" />
        <meta name="theme-color" content="#081f15" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/cover.png" />
        <meta property="og:site_name" content="Brooks Roley" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/cover.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
