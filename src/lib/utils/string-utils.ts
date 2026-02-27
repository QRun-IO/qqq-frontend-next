/** string-utils — lightweight string classification predicates used throughout the UI */

/**
 * Returns true when the string is an absolute HTTP or HTTPS URL.
 *
 * Used by `FieldValue` and `BlockWidget` to decide whether to render a value as a link
 * with an external href, as opposed to a relative navigation link or plain text.
 *
 * @param s - The string to test.
 * @returns `true` if `s` begins with `http://` or `https://` (case-insensitive).
 */
export const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s)

/**
 * Returns true when the string is a root-relative path (starts with `/`).
 *
 * Used to distinguish internal Next.js navigation links from external URLs and plain text.
 *
 * @param s - The string to test.
 * @returns `true` if `s` starts with `/`.
 */
export const isRelativeUrl = (s: string): boolean => s.startsWith('/')

/**
 * Returns true when the string looks like an email address.
 *
 * Uses a simple heuristic regex (`local@domain.tld`) suitable for display-time formatting;
 * not intended as a strict RFC-5322 validator.
 *
 * @param s - The string to test.
 * @returns `true` if `s` matches the email heuristic pattern.
 */
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
