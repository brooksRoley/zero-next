/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return []
  },
  async rewrites() {
    return [
      // Hardwood Autochess: the built Vite client lives in public/hardwood/
      // (built from the BballTactics repo via `npm run build:hardwood`).
      // public/ doesn't resolve directory indexes, so map the clean URL.
      { source: '/hardwood', destination: '/hardwood/index.html' },
    ]
  },
  async headers() {
    return [
      {
        // Applies to every route. CSP is intentionally not set here yet —
        // the site loads Stripe Checkout, Calendly, and Supabase/OpenRouter
        // requests from the client, and a wrong CSP silently breaks those
        // rather than failing loudly; it needs a dedicated pass with live
        // verification, not a guess bundled into this header sweep.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
