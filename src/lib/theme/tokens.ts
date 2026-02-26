// QQQ Theme Token definitions — 60+ CSS custom properties

export const QQQ_THEME_TOKENS = {
  // Primary brand colors
  '--qqq-primary-color': '#0062ff',
  '--qqq-secondary-color': '#9c27b0',
  '--qqq-accent-color': '#0062ff',
  '--qqq-accent-hover': '#0052d9',

  // Semantic colors
  '--qqq-success-color': '#10b981',
  '--qqq-warning-color': '#f59e0b',
  '--qqq-error-color': '#dc2626',
  '--qqq-info-color': '#3b82f6',

  // Sidebar tokens
  '--qqq-sidebar-background': '#1e293b',
  '--qqq-sidebar-text': '#e2e8f0',
  '--qqq-sidebar-hover': 'rgba(255, 255, 255, 0.1)',
  '--qqq-sidebar-active': 'var(--qqq-accent-color)',
  '--qqq-sidebar-active-bg': 'rgba(0, 98, 255, 0.15)',
  '--qqq-sidebar-border': '#334155',
  '--qqq-sidebar-width': '256px',
  '--qqq-sidebar-width-mini': '80px',

  // Header tokens
  '--qqq-header-background': '#ffffff',
  '--qqq-header-text': '#1e293b',
  '--qqq-header-border': '#e2e8f0',
  '--qqq-header-height': '64px',

  // Grid/Table tokens
  '--qqq-grid-header-bg': '#f8fafc',
  '--qqq-grid-row-hover': '#f1f5f9',
  '--qqq-grid-border': '#e2e8f0',
  '--qqq-grid-text': '#1e293b',
  '--qqq-grid-text-muted': '#64748b',

  // Form tokens
  '--qqq-input-border': '#d1d5db',
  '--qqq-input-focus-border': '#0062ff',
  '--qqq-input-background': '#ffffff',
  '--qqq-input-text': '#1f2937',
  '--qqq-label-text': '#374151',

  // Banner tokens
  '--qqq-banner-height': '40px',
  '--qqq-banner-info-bg': '#eff6ff',
  '--qqq-banner-info-text': '#1d4ed8',
  '--qqq-banner-warning-bg': '#fffbeb',
  '--qqq-banner-warning-text': '#92400e',
  '--qqq-banner-error-bg': '#fef2f2',
  '--qqq-banner-error-text': '#991b1b',

  // Typography
  '--qqq-font-family': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  '--qqq-font-size-xs': '0.75rem',
  '--qqq-font-size-sm': '0.875rem',
  '--qqq-font-size-base': '1rem',
  '--qqq-font-size-lg': '1.125rem',
  '--qqq-font-size-xl': '1.25rem',
  '--qqq-font-size-2xl': '1.5rem',

  // Shadows
  '--qqq-shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  '--qqq-shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  '--qqq-shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',

  // Border radius
  '--qqq-radius-sm': '0.375rem',
  '--qqq-radius-md': '0.5rem',
  '--qqq-radius-lg': '0.75rem',

  // Transitions
  '--qqq-transition-fast': '150ms ease',
  '--qqq-transition-normal': '200ms ease',
  '--qqq-transition-slow': '300ms ease',

  // Z-index layers
  '--qqq-z-sidebar': '100',
  '--qqq-z-header': '200',
  '--qqq-z-banner': '300',
  '--qqq-z-modal': '1000',
  '--qqq-z-toast': '2000',
  '--qqq-z-tooltip': '3000',
} as const

export type ThemeToken = keyof typeof QQQ_THEME_TOKENS

export function injectThemeTokens(
  tokens: Partial<Record<ThemeToken, string>> = QQQ_THEME_TOKENS
): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value)
  }
}
