// E2E: quiet record-form validation — required fields, length limits and counters, number entry,
// server errors placed on their fields, and focus moving to the first invalid field.
//
// Set FORM_SHOTS_DIR to also write the screenshot set (light and dark, 390 and 1440 px).

import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks, METADATA } from './api-mocks'

type MockField = Record<string, unknown>

/** Gives the mocked person table the validation metadata these tests need (this file's worker only). */
function addValidationRules() {
  const person = METADATA.tables.person as unknown as { fields: Record<string, MockField>; sections: Array<{ fieldNames: string[] }> }
  person.fields.firstName = { ...person.fields.firstName, maxLength: 10, behaviors: ['ERROR'] }
  person.fields.email = { ...person.fields.email, maxLength: 20, behaviors: ['TRUNCATE'] }
  person.fields.age = {
    name: 'age', label: 'Age', type: 'INTEGER', isEditable: true, isRequired: false, isHeavy: false, isHidden: false,
    adornments: [], minValue: 1, maxValue: 120,
  }
  person.sections[0].fieldNames = ['firstName', 'lastName', 'email', 'age', 'status']
}

async function openCreate(page: Page) {
  addValidationRules()
  await setupApiMocks(page)
  await page.goto('/app/person/create')
  await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({ timeout: 30000 })
}

const field = (page: Page, name: string) => page.locator(`input[data-qqq-id="${name}"]`)

test.describe('Record form validation', () => {
  test('a required field stays quiet while typing, errors on blur, then clears live', async ({ page }) => {
    await openCreate(page)
    const first = field(page, 'firstName')
    await first.fill('Al')
    await first.fill('')
    await expect(page.getByText('Required')).toHaveCount(0)
    await first.blur()
    await expect(page.getByText('Required')).toHaveCount(1)
    await expect(first).toHaveAttribute('aria-invalid', 'true')
    await first.pressSequentially('A')
    await expect(page.getByText('Required')).toHaveCount(0)
    await expect(first).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('a refused length caps typing and the counter appears only near the limit', async ({ page }) => {
    await openCreate(page)
    const first = field(page, 'firstName')
    await first.pressSequentially('abcdefg')
    await expect(page.getByText(/^\d+ \/ 10$/)).toHaveCount(0)
    await first.pressSequentially('h')
    await expect(page.getByText('8 / 10')).toBeVisible()
    await first.pressSequentially('ijklmn')
    await expect(first).toHaveValue('abcdefghij')
    await expect(page.getByText('10 / 10')).toBeVisible()
  })

  test('number entry rejects letters and signs, and names the range when out of it', async ({ page }) => {
    await openCreate(page)
    const age = field(page, 'age')
    await age.pressSequentially('a1e.2')
    await expect(age).toHaveValue('12')
    await age.fill('130')
    await age.blur()
    await expect(page.getByText('Must be between 1 and 120')).toBeVisible()
  })

  test('save moves focus to the first invalid field', async ({ page }) => {
    await openCreate(page)
    await page.locator('[data-qqq-id="button-save"]').click()
    await expect(page.getByText('Required').first()).toBeVisible()
    await expect(field(page, 'firstName')).toBeFocused()
  })

  test('a server error lands on its field and keeps what was typed', async ({ page }) => {
    await openCreate(page)
    await page.route(/\/qqq\/v1\/table\/person(\?|$)/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ record: { tableName: 'person', values: {}, errors: ['The value for Email is too long (max allowed length=20)'] } }),
      })
    })
    await field(page, 'firstName').fill('Ada')
    await field(page, 'lastName').fill('Lovelace')
    await field(page, 'status').fill('ACTIVE')
    await field(page, 'email').fill('ada.lovelace@example.com')
    await page.locator('[data-qqq-id="button-save"]').click()
    await expect(page.getByText('Must be 20 characters or fewer')).toBeVisible()
    await expect(field(page, 'email')).toBeFocused()
    await expect(field(page, 'email')).toHaveValue('ada.lovelace@example.com')
    await expect(page.getByText(/Failed to create/)).toHaveCount(0)
  })
})

const SHOTS = process.env.FORM_SHOTS_DIR
for (const scheme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test(`screenshots ${scheme} ${width}`, async ({ page }) => {
      test.skip(!SHOTS, 'set FORM_SHOTS_DIR to write screenshots')
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 })
      await page.emulateMedia({ colorScheme: scheme })
      await page.addInitScript((value) => { try { localStorage.setItem('qqq-dark-mode', String(value === 'dark')) } catch { /* ignore */ } }, scheme)
      await openCreate(page)
      const form = page.locator('[data-qqq-id="entity-form-person"]')
      await form.screenshot({ path: `${SHOTS}/clean-${scheme}-${width}.png` })
      await field(page, 'firstName').pressSequentially('abcdefgh')
      await field(page, 'email').pressSequentially('someone.else@example.com')
      await form.screenshot({ path: `${SHOTS}/near-limit-${scheme}-${width}.png` })
      await field(page, 'firstName').fill('')
      await field(page, 'age').fill('130')
      await page.locator('[data-qqq-id="button-save"]').click()
      await expect(page.getByText('Required').first()).toBeVisible()
      await page.waitForTimeout(400)
      await form.screenshot({ path: `${SHOTS}/errors-${scheme}-${width}.png` })
    })
  }
}
