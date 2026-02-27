/** constants — shared application-wide constants for pagination, debounce, and other tuning knobs */

/**
 * The set of allowed page-size values for the Record Query pagination control.
 *
 * Rendered as selectable options in the rows-per-page dropdown. The `as const`
 * assertion ensures the tuple is used as a literal type throughout the codebase.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/**
 * Debounce delay (in milliseconds) for the quick-search input on the Record Query page.
 *
 * Waits this long after the last keystroke before firing a new query, balancing
 * responsiveness against unnecessary network requests.
 */
export const SEARCH_DEBOUNCE_MS = 400

/**
 * Debounce delay (in milliseconds) for async combobox option fetching.
 *
 * Applied by {@link useAsyncCombobox}'s `debouncedFetch` to throttle possible-value
 * API calls while the user is typing in a filter combobox input.
 */
export const COMBOBOX_DEBOUNCE_MS = 300
