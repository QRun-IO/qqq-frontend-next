import type { StorybookConfig } from '@storybook/nextjs-vite'
import { fileURLToPath } from 'node:url'

// The Vite builder: the webpack-based @storybook/nextjs framework bundled Node core
// polyfills (crypto-browserify -> elliptic, GHSA-848j-6mx2-7j84) that no story needs.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  viteFinal: async (config) => {
    const src = fileURLToPath(new URL('../src', import.meta.url))
    const alias = config.resolve?.alias
    config.resolve = {
      ...config.resolve,
      alias: Array.isArray(alias)
        ? [...alias, { find: '@', replacement: src }]
        : { ...alias, '@': src },
    }
    // Rollup drops the Next.js "use client" directives (meaningless in Storybook) and warns
    // once per client module; keep the build log to the warnings that matter.
    const onwarn = config.build?.rollupOptions?.onwarn
    config.build = {
      ...config.build,
      rollupOptions: {
        ...config.build?.rollupOptions,
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR') return
          if (onwarn) onwarn(warning, warn)
          else warn(warning)
        },
      },
    }
    return config
  },
}

export default config
