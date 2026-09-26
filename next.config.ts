import type { NextConfig } from 'next'
import packageJson from './package.json'
import backendPrefixes from './standalone/backend-prefixes.json'

/**
 * Two build outputs:
 * - `QQQ_NEXT_OUTPUT=export`: static files for the QQQ Javalin server to host from its
 *   classpath (the default dashboard). Same origin as the API, so no rewrites.
 * - otherwise `standalone`: a Node server; `QQQ_BACKEND_URL` bakes same-origin API rewrites
 *   into the build (the quickstart container image). The image starts it through
 *   standalone/qqq-server.mjs, which adds the dashboard security headers (QRun-IO/qqq#734).
 */
const exportBuild = process.env.QQQ_NEXT_OUTPUT === 'export'

/**
 * Backend route prefixes the frontend calls; forwarded by the standalone server, which
 * leaves the backend's responses to them without the dashboard's headers.
 */
const BACKEND_PREFIXES: string[] = backendPrefixes

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Reported to the backend as frontendVersion and shown on the developer page.
  env: { NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version },
  ...(exportBuild
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true } }
    : {
        output: 'standalone',
        async rewrites() {
          const backend = process.env.QQQ_BACKEND_URL
          if (!backend) return []
          return BACKEND_PREFIXES.map((prefix) => ({
            source: `/${prefix}/:path*`,
            destination: `${backend}/${prefix}/:path*`,
          }))
        },
      }),
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

export default nextConfig
