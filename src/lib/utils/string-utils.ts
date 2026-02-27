// String classification utilities

/** Returns true for http:// or https:// URLs */
export const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s)

/** Returns true for root-relative paths (starts with /) */
export const isRelativeUrl = (s: string): boolean => s.startsWith('/')

/** Returns true for email addresses */
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
