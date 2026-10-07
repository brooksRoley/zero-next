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
  // Security headers (X-Frame-Options, X-Content-Type-Options, etc.) are
  // already set platform-side in vercel.json for every route — don't
  // duplicate them here.
}

module.exports = nextConfig
