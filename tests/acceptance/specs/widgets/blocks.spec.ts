/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Composite widgets: every QQQ block type and layout (WidgetsFixtures allBlocks()).
import { expect, open, test } from '../../support/fixtures'
import { expectLoaded, widget, widgetBody } from './widget-support'

test.beforeEach(async ({ page }) => {
  await open(page, '/app/widgetBlocks')
  await expect(page.getByRole('heading', { level: 1, name: 'Widget Blocks' })).toBeVisible()
  await expectLoaded(page, 'accBlocks')
})

test('[WID-057] every block type renders its values and styles', async ({ page, diagnostics }) => {
  void diagnostics
  const card = widget(page, 'accBlocks')
  const block = (type: string) => card.locator(`[data-block-type="${type}"]`)

  const text = block('TEXT').first()
  await expect(text).toHaveAttribute('data-block-id', 'ownedText')
  await expect(text).toContainText('Owned text line one')
  await expect(text).toContainText('Owned text line two')
  // Read the properties inside the page: a CSSStyleDeclaration only serializes in Chromium
  const textStyle = await text.locator('span[style]').first().evaluate((node) => {
    const { fontSize, fontWeight } = getComputedStyle(node)
    return { fontSize, fontWeight }
  })
  expect(textStyle.fontSize).toBe('24px')
  expect(textStyle.fontWeight).toBe('700')

  await expect(block('BIG_NUMBER')).toContainText('Owned heading')
  await expect(block('BIG_NUMBER').getByText('4,321')).toHaveCSS('color', 'rgb(143, 0, 216)')
  await expect(block('BIG_NUMBER')).toContainText('owned context')

  await expect(block('UP_OR_DOWN_NUMBER')).toHaveAttribute('data-direction', 'up')
  await expect(block('UP_OR_DOWN_NUMBER')).toContainText('17%')
  await expect(block('UP_OR_DOWN_NUMBER')).toContainText('owned change')
  // up but not good: the bad (red) color
  await expect(block('UP_OR_DOWN_NUMBER').getByText('17%')).toHaveCSS('color', 'rgb(251, 65, 65)')

  await expect(block('NUMBER_ICON_BADGE')).toContainText('12')
  await expect(block('NUMBER_ICON_BADGE').locator('[data-icon-name="inventory"]')).toHaveCSS('color', 'rgb(43, 168, 63)')
  await expect(block('ICON').locator('[data-icon-name="star"]')).toHaveCSS('color', 'rgb(255, 128, 0)')

  await expect(block('TABLE_SUB_ROW_DETAIL_ROW').getByText('Owned detail label')).toHaveCSS('color', 'rgb(84, 110, 122)')
  await expect(block('TABLE_SUB_ROW_DETAIL_ROW').getByText('Owned detail value')).toHaveCSS('color', 'rgb(0, 98, 255)')

  const progress = block('PROGRESS_BAR')
  await expect(progress).toContainText('Owned progress')
  await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62.5')
  await expect(progress).toContainText('62.5%')
  await expect(progress.locator('[data-block-part="bar-fill"]')).toHaveCSS('background-color', 'rgb(16, 184, 166)')

  await expect(block('DIVIDER')).toHaveCount(1)
  expect(await block('DIVIDER').evaluate((node) => node.tagName === 'HR' || node.querySelector('hr') !== null)).toBe(true)

  const image = block('IMAGE').getByRole('img', { name: 'Owned image' })
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBe(8)
  await expect(image).toHaveCSS('width', '32px')

  const audio = block('AUDIO').locator('audio')
  await expect(audio).toHaveAttribute('src', /\/owned-audio\.wav$/)
  await expect(audio).toHaveAttribute('controls', '')
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.readyState >= 1 && node.duration > 0)).toBe(true)

  const input = block('INPUT_FIELD').getByLabel(/Owned message/)
  await expect(input).toHaveAttribute('placeholder', 'Type an owned message')
  await expect(input).toHaveAttribute('aria-required', 'true')
  await input.fill('typed value')
  await expect(input).toHaveValue('typed value')

  await expect(block('BUTTON').getByRole('button', { name: 'Submit owned' })).toHaveAttribute('data-format', 'outlined')
})

test('[WID-058] composite layouts apply their flex rules and slot links carry tooltips', async ({ page, diagnostics }) => {
  void diagnostics
  const card = widget(page, 'accBlocks')
  const layout = (name: string) => card.locator(`[data-layout="${name}"]`).first()
  const style = async (name: string) => layout(name).evaluate((node) => {
    const computed = getComputedStyle(node)
    return { display: computed.display, direction: computed.flexDirection, justify: computed.justifyContent, wrap: computed.flexWrap }
  })
  expect(await style('FLEX_COLUMN')).toMatchObject({ display: 'flex', direction: 'column' })
  expect(await style('FLEX_ROW')).toMatchObject({ display: 'flex', direction: 'row' })
  expect(await style('FLEX_ROW_SPACE_BETWEEN')).toMatchObject({ display: 'flex', direction: 'row', justify: 'space-between' })
  expect(await style('FLEX_ROW_CENTER')).toMatchObject({ display: 'flex', justify: 'center', wrap: 'wrap' })
  expect(await style('FLEX_ROW_WRAPPED')).toMatchObject({ display: 'flex', direction: 'row', wrap: 'wrap' })
  expect(await style('BADGES_WRAPPER')).toMatchObject({ display: 'flex' })
  expect(await style('TABLE_SUB_ROW_DETAILS')).toMatchObject({ display: 'flex', direction: 'column' })
  // left and right texts are pushed apart
  const left = await layout('FLEX_ROW_SPACE_BETWEEN').getByText('Owned left').boundingBox()
  const right = await layout('FLEX_ROW_SPACE_BETWEEN').getByText('Owned right').boundingBox()
  expect(right!.x - (left!.x + left!.width)).toBeGreaterThan(100)
  // the big number links in-app and describes itself with its tooltip
  const link = card.locator('[data-block-type="BIG_NUMBER"] a').first()
  await expect(link).toHaveAttribute('href', /^\/app\/person\/?$/)
  await expect(link).toHaveAccessibleDescription('Owned big number tooltip')
  await link.hover()
  await expect(page.getByRole('tooltip').filter({ hasText: 'Owned big number tooltip' })).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
})

test('[WID-059] an unsupported block type shows a contained warning and neighbors render', async ({ page, diagnostics }) => {
  void diagnostics
  await expectLoaded(page, 'accBlocksUnknown')
  await expect(widget(page, 'accBlocksUnknown').getByRole('alert')).toHaveText('Unsupported block type: OWNED_UNKNOWN')
  await expect(widgetBody(page, 'accHealthy')).toHaveText('Healthy neighbor content')
})

test('[WID-064] a widget whose payload is a single leaf block renders that block', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await expectLoaded(page, 'accLeafBlock')
  // the backend sends the block itself (blockTypeName TEXT, no blocks list), as a Material block widget
  const payload = await (await backend.api.get('/widget/accLeafBlock')).json()
  expect(payload.blockTypeName).toBe('TEXT')
  expect(payload.blocks).toBeUndefined()
  const body = widgetBody(page, 'accLeafBlock')
  await expect(body.locator('[data-block-type="TEXT"]')).toHaveText('Owned leaf block text')
  await expect(body.locator('[data-block-type="COMPOSITE"]')).toHaveCount(0)
})
