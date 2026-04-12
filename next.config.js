/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/pente', destination: '/posts/pente-puzzles?mode=endless', permanent: false },
    ]
  },
}

module.exports = nextConfig
