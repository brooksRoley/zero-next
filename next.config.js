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
}

module.exports = nextConfig
