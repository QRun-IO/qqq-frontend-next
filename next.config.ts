import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    const backend = process.env.QQQ_BACKEND_URL
    if (!backend) return []
    return ['qqq', 'data', 'widget', 'metaData', 'download', 'processes'].map((prefix) => ({
      source: `/${prefix}/:path*`,
      destination: `${backend}/${prefix}/:path*`,
    }))
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

export default nextConfig
