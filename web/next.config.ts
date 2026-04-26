import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // react-leaflet(MapContainer) + React 19 dev 의 이중 effect 시 "Map container is already initialized" 방지
  reactStrictMode: false,
  output: 'standalone',
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg' }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.tile.openstreetmap.org',
      },
      {
        protocol: 'https',
        hostname: 'basemaps.cartocdn.com',
      },
    ],
  },
}

export default nextConfig
