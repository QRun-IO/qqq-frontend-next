/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Owned widgets of the remaining canonical display types (WidgetsFixtures widgetGallery).
import { expect, open, test } from '../../support/fixtures'
import { chartTable, expectLoaded, widget, widgetPayload } from './widget-support'

test.describe('widget gallery', () => {
  test.beforeEach(async ({ page, diagnostics }) => {
    // the gallery deliberately includes a custom component whose bundle is missing (WID-062)
    diagnostics.allow('/missing-extension.js 404')
    diagnostics.allow('Failed to load resource: the server responded with a status of 404')
    await open(page, '/app/widgetGallery')
    await expect(page.getByRole('heading', { level: 1, name: 'Widget Gallery' })).toBeVisible()
  })

  test('[WID-001] alert renders its severity, sanitized HTML and bullet list', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accAlert')
    expect(payload.alertType).toBe('WARNING')
    await expectLoaded(page, 'accAlert')
    const alert = widget(page, 'accAlert').getByRole('alert')
    await expect(alert).toHaveAttribute('data-alert-type', 'WARNING')
    await expect(alert.locator('strong')).toHaveText('Owned warning')
    await expect(alert.locator('li')).toHaveCount(2)
    await expect(alert.locator('li').first().locator('em')).toHaveText('Owned bullet')
    await expect(alert.locator('li').nth(1)).toHaveText('Second owned bullet')
  })

  test('[WID-063] a hidden alert renders nothing at all', async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await widgetPayload(backend.api, 'accAlertHidden')).hideWidget).toBe(true)
    await expectLoaded(page, 'accAlert')
    await expect(page.locator('[data-qqq-id="widget-grid-item-accAlertHidden"]')).toBeAttached()
    await expect(widget(page, 'accAlertHidden')).toHaveCount(0)
    await expect(page.getByText('Hidden owned alert')).toHaveCount(0)
  })

  test('[WID-004] divider renders a rule without card chrome', async ({ page, diagnostics }) => {
    void diagnostics
    const divider = widget(page, 'accDivider')
    await expect(divider.locator('hr')).toBeVisible()
    await expect(divider).not.toContainText('Owned Divider')
    await expect(divider.locator('[data-qqq-id="widget-label-accDivider"]')).toHaveCount(0)
  })

  test('[WID-005] field value list shows labels, display values, zero, prefix icon and indentation', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accFieldValueList')
    const owner = page.locator('[data-qqq-id="field-value-accFieldValueList-owner"]')
    await expect(owner).toHaveText('Owner:Alice')
    await expect(page.locator('[data-qqq-id="field-value-icon-accFieldValueList-owner"]')).toHaveAttribute('data-icon-name', 'person')
    await expect(page.locator('[data-qqq-id="field-value-icon-accFieldValueList-owner"]')).toHaveCSS('color', 'rgb(143, 0, 216)')
    const zero = page.locator('[data-qqq-id="field-value-accFieldValueList-zero"]')
    await expect(zero).toHaveText('Zero:0')
    await expect(zero).toHaveCSS('padding-left', '24px')
    await expect(page.locator('[data-qqq-id="field-value-accFieldValueList-choice"]')).toHaveText('Choice:Owned choice')
  })

  test('[WID-007] horizontal bar chart draws negative values left of the zero line', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accHorizontalBarChart')
    await expectLoaded(page, 'accHorizontalBarChart')
    const card = widget(page, 'accHorizontalBarChart')
    await expect(card.locator('[data-qqq-id="chart-horizontalBar-accHorizontalBarChart"]')).toBeVisible()
    await expect(card.locator('[data-qqq-id="chart-canvas-accHorizontalBarChart"]')).toHaveCSS('height', `${payload.height}px`)
    expect(await chartTable(page, 'accHorizontalBarChart')).toEqual([['First', '5'], ['Zero', '0'], ['Negative', '-2']])
    await expect(card.locator('.recharts-bar-rectangle path')).toHaveCount(2)
    const zeroX = Number(await card.locator('.recharts-reference-line-line').getAttribute('x1'))
    const bars = await card.locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => ({ x: Number(path.getAttribute('x')), width: Number(path.getAttribute('width')) })))
    expect(bars).toHaveLength(2)
    // the positive bar starts at zero and grows right; the negative bar ends at zero
    expect(Math.round(bars[0].x)).toBe(Math.round(zeroX))
    expect(Math.round(Math.min(bars[1].x, bars[1].x + bars[1].width))).toBeLessThan(Math.round(zeroX))
    await expect(card.locator('[data-qqq-id="chart-description-accHorizontalBarChart"] b')).toHaveText('data')
  })

  test('[WID-013] multi-table renders each labelled table with its rows', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accMultiTable')
    const first = page.locator('[data-qqq-id="table-widget-accMultiTable-0"]')
    const second = page.locator('[data-qqq-id="table-widget-accMultiTable-1"]')
    await expect(first.getByRole('heading', { name: 'First' })).toBeVisible()
    await expect(first.getByRole('cell', { name: 'First owned row' })).toBeVisible()
    await expect(second.getByRole('heading', { name: 'Second' })).toBeVisible()
    await expect(second.getByRole('cell', { name: 'Second owned row' })).toBeVisible()
    await expect(first.getByRole('columnheader')).toHaveText(['Name'])
  })

  test('[WID-011] location card shows image, title, description, address and footer', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accLocation')
    await expectLoaded(page, 'accLocation')
    const card = page.locator('[data-qqq-id="location-accLocation"]')
    const image = card.locator('[data-qqq-id="location-image-accLocation"]')
    await expect(image).toHaveAttribute('src', payload.imageUrl)
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBe(8)
    await expect(card.getByRole('heading', { name: 'Owned location' })).toBeVisible()
    await expect(card).toContainText('Owned description')
    await expect(card.locator('[data-qqq-id="location-address-accLocation"]')).toHaveText('Owned address')
    await expect(card).toContainText('Owned footer')
  })

  test('[WID-020] USA map plots each marker by longitude and lists the locations', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accUsaMap')
    await expectLoaded(page, 'accUsaMap')
    const map = page.locator('[data-qqq-id="usa-map-accUsaMap"]')
    await expect(map.getByRole('img')).toHaveAttribute('aria-label', 'Owned Map: 3 locations')
    const markers = map.locator('[data-qqq-id^="usa-map-marker-accUsaMap-"]')
    await expect(markers).toHaveCount(payload.mapMarkerList.length)
    const placed = await markers.evaluateAll((groups) => groups.map((group) => ({ name: group.getAttribute('data-marker-name'), x: Number(group.querySelector('circle')!.getAttribute('cx')), y: Number(group.querySelector('circle')!.getAttribute('cy')) })))
    const byName = Object.fromEntries(placed.map((marker) => [marker.name, marker]))
    // Denver is west of Chicago, which is west of Boston; Denver is the southernmost of the three
    expect(byName['Owned Denver'].x).toBeLessThan(byName['Owned Chicago'].x)
    expect(byName['Owned Chicago'].x).toBeLessThan(byName['Owned Boston'].x)
    expect(byName['Owned Denver'].y).toBeGreaterThan(byName['Owned Boston'].y)
    for (const [index, marker] of payload.mapMarkerList.entries()) {
      await expect(page.locator(`[data-qqq-id="usa-map-location-accUsaMap-${index}"]`)).toHaveText(`${marker.name} (${marker.latitude}, ${marker.longitude})`)
    }
  })

  test('[WID-025] custom component loads its bundle and renders with the widget metadata and data', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accCustomComponent')
    await expect(page.locator('[data-qqq-id="custom-component-accCustomComponent"]')).toHaveText('Loaded component: Owned Custom Component / Owned component value')
  })

  test('[WID-062] a custom component whose bundle is missing shows a contained error', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accCustomComponentMissing')
    await expect(page.locator('[data-qqq-id="custom-component-error-accCustomComponentMissing"]')).toHaveText('Error loading MissingOwnedComponent')
    // the neighbour still renders
    await expect(page.locator('[data-qqq-id="custom-component-accCustomComponent"]')).toContainText('Loaded component')
  })

  test('[WID-006] generic widget renders its sublabel and sanitized footer', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accGeneric')
    await expect(page.locator('[data-qqq-id="widget-sublabel-accGeneric"]')).toHaveText('Owned sublabel')
    await expect(page.locator('[data-qqq-id="widget-footer-accGeneric"] b')).toHaveText('Owned footer')
  })

  test('[WID-016] statistics count links to its URL and an increase is bad when increases are not good', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accStatisticsGood')
    await expectLoaded(page, 'accStatisticsGood')
    await expect(page.locator('[data-qqq-id="statistics-count-accStatisticsGood"]').getByRole('link', { name: '1,234' })).toHaveAttribute('href', new RegExp(`^${payload.countURL}/?$`))
    const change = page.locator('[data-qqq-id="statistics-percentage-accStatisticsGood"]')
    await expect(change).toContainText('+12.5%')
    await expect(change).toHaveAttribute('data-direction', 'up')
    await expect(change).toHaveAttribute('data-good', 'false')
    await expect(change).toHaveClass(/text-red-600/)
  })

  test('[WID-017] stacked bars use each dataset color', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accStackedBars')
    await expect(widget(page, 'accStackedBars').locator('.recharts-bar-rectangle path')).toHaveCount(4)
    const fills = await widget(page, 'accStackedBars').locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase()))
    expect(fills.sort()).toEqual(['#0000FF', '#0000FF', '#FF0000', '#FF0000'])
    expect(await chartTable(page, 'accStackedBars')).toEqual([['North', '3', '5'], ['South', '4', '1']])
  })
})
