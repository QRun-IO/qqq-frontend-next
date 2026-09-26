import type { Preview } from '@storybook/nextjs-vite'
import '../src/styles/globals.css'

const preview: Preview = {
  tags: ['autodocs'],
  initialGlobals: { backgrounds: { value: 'light' } },
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        light: { name: 'light', value: '#ffffff' },
        dark: { name: 'dark', value: '#0f172a' },
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
}

export default preview
