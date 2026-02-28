/**
 * Convenience helper for running axe accessibility checks in Vitest tests.
 *
 * Import `checkA11y` and call it with the result of `render()` from
 * `@testing-library/react`. The function runs axe on the rendered container
 * and asserts that there are no accessibility violations using the jest-axe
 * matcher registered in `tests/setup.ts`.
 */

import { axe } from 'jest-axe'
import type { RenderResult } from '@testing-library/react'

/**
 * Runs axe-core on the rendered container and asserts no violations are found.
 *
 * @param result - The render result returned by `render()` from `@testing-library/react`.
 * @returns A promise that resolves when axe has finished and assertions have passed.
 */
export async function checkA11y(result: RenderResult): Promise<void> {
  const axeResults = await axe(result.container)
  expect(axeResults).toHaveNoViolations()
}
