/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material table and chart widget extras (QRun-IO/qqq#728): WidgetTableChartFixtures widgetTableCharts.
import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { byId, downloadText, expectLoaded, widget, widgetPayload } from './widget-support'

/** Whether the page has a coarse (touch) pointer. */
async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia('(pointer: coarse)').matches)
}

/** Opens a hover/focus tooltip: a tap on a touch screen, else hovering its trigger. */
async function showTooltip(page: Page, trigger: Locator) {
  if (await isTouch(page)) await trigger.tap()
  else await trigger.hover()
}

/** Text of each body row's cells (innerText, so hidden tooltips are left out). */
async function bodyRows(table: Locator): Promise<string[][]> {
  return table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => (cell as HTMLElement).innerText.trim())))
}

test.describe('table and chart extras', () => {
  test.beforeEach(async ({ page, diagnostics }) => {
    void diagnostics
    await open(page, '/app/widgetTableCharts')
    await expect(page.getByRole('heading', { level: 1, name: 'Widget Tables And Charts' })).toBeVisible()
  })

  test('[WID-068] typed cells, hidden helper columns, fr widths, column-header help and sub-rows @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accTableCells')
    expect(payload.columns.filter((column: { type: string }) => column.type === 'hidden').map((column: { header: string }) => column.header))
      .toEqual(['Tooltip', 'Image URL', 'Image Label', 'Image Total', 'Image Total Type'])
    await expectLoaded(page, 'accTableCells')
    const card = widget(page, 'accTableCells')
    const table = card.getByRole('table')
    // hidden columns are not shown; the last header is the sub-row expander column
    expect(await table.locator('thead th').allInnerTexts()).toEqual(['Name', 'Count', 'Status', 'Product', 'Detail', 'Details'])

    const first = table.locator('[data-qqq-id="table-row-accTableCells-0"] td')
    await expect(first.nth(0).getByRole('link', { name: 'Owned parent' })).toHaveAttribute('href', '/app/person/1')
    await expect(first.nth(1)).toHaveText('1,234,567')
    await expect(first.nth(1)).toHaveClass(/text-right/)
    await expect(first.nth(2).locator('b')).toHaveText('Shipped')
    // the row's hidden tooltip column is the htmlAndTooltip cell's tooltip
    const statusTip = first.nth(2).getByRole('tooltip', { includeHidden: true })
    await expect(statusTip).toBeHidden()
    await showTooltip(page, first.nth(2).locator('[data-tooltip-trigger]'))
    await expect(statusTip).toBeVisible()
    await expect(statusTip.locator('i')).toHaveText('Left the owned dock')
    await page.keyboard.press('Escape')
    // the image cell: the row's image, label and total with its type
    const image = first.nth(3).locator('img')
    await expect(image).toHaveAttribute('src', payload.rows[0].imageUrl)
    await expect(image).toHaveAttribute('alt', 'Owned product')
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
    await expect(first.nth(3)).toHaveText(/Owned product\s*2,500 sold/)
    await expect(first.nth(4)).toHaveText('Owned composite cell')
    // a zero total shows no total (Material ImageCell)
    await expect(table.locator('[data-qqq-id="table-row-accTableCells-1"] td').nth(3)).toHaveText('Owned product')

    // fr widths share what the fixed 180px column (and the 60px expander) leave: Name (2fr) is twice Count (1fr)
    const headers = table.locator('thead th')
    const widths = await headers.evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width))
    expect(Math.abs(widths[0] - 2 * widths[1])).toBeLessThanOrEqual(2)
    expect(Math.abs(widths[1] - widths[2])).toBeLessThanOrEqual(1)
    expect(Math.abs(widths[3] - 180)).toBeLessThanOrEqual(1)
    expect(Math.abs(widths[5] - 60)).toBeLessThanOrEqual(1)

    // the columnHeader=name help slot on the Name header
    const help = byId(page, 'table-header-help-accTableCells-name')
    await expect(help).toBeHidden()
    await showTooltip(page, headers.nth(0).locator('[data-tooltip-trigger]'))
    await expect(help).toBeVisible()
    await expect(help).toHaveText('Owned name column help')
    await expect(help.locator('b')).toHaveText('name')
    await page.keyboard.press('Escape')
    await expect(headers.nth(1).getByRole('tooltip', { includeHidden: true })).toHaveCount(0)

    // sub-rows expand and collapse, nested rows are shaded
    expect((await bodyRows(table)).map((row) => row[0])).toEqual(['Owned parent', 'Owned second'])
    await card.getByRole('button', { name: 'Expand row 1' }).click()
    expect((await bodyRows(table)).map((row) => row[0])).toEqual(['Owned parent', 'Owned child one', 'Owned child two', 'Owned second'])
    const child = table.locator('[data-qqq-id="table-row-accTableCells-0.0"]')
    await expect(child).toHaveAttribute('data-depth', '1')
    await expect(child.locator('td').nth(1)).toHaveText('7')
    const shade = await child.evaluate((row) => getComputedStyle(row).backgroundColor)
    expect(shade).not.toBe('rgba(0, 0, 0, 0)')
    expect(await table.locator('[data-qqq-id="table-row-accTableCells-1"]').evaluate((row) => getComputedStyle(row).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    await card.getByRole('button', { name: 'Expand row 1.2' }).click()
    await expect(table.locator('[data-qqq-id="table-row-accTableCells-0.1.0"]')).toHaveAttribute('data-depth', '2')
    await expect(table.locator('[data-qqq-id="table-row-accTableCells-0.1.0"] td').nth(0)).toHaveText('Owned grandchild')
    await card.getByRole('button', { name: 'Collapse row 1' }).click()
    expect((await bodyRows(table)).map((row) => row[0])).toEqual(['Owned parent', 'Owned second'])
    await expect(table.locator('[data-qqq-id="table-row-accTableCells-0.1.0"]')).toHaveCount(0)
    await expectTouchReady(page, card)
  })

  test('[WID-068] paging shows 10 rows, numbered pages, entries per page, jump-to-page and a sticky header @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accTablePaging')
    const card = widget(page, 'accTablePaging')
    const table = card.getByRole('table')
    const names = async () => (await bodyRows(table)).map((row) => row[0])
    const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `Owned row ${from + index}`)
    expect(await names()).toEqual(range(1, 10))
    expect((await bodyRows(table))[0][1]).toBe('1,000')
    const pages = card.getByRole('navigation', { name: 'Owned Paging pages' })
    await expect(pages.getByRole('button', { name: /^Page \d+$/ })).toHaveText(['1', '2', '3', '4'])
    await expect(pages.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    await expect(pages.getByRole('button', { name: 'Previous page' })).toHaveCount(0)
    await pages.getByRole('button', { name: 'Page 4' }).click()
    expect(await names()).toEqual(range(31, 40))
    await expect(pages.getByRole('button', { name: 'Next page' })).toHaveCount(0)
    await pages.getByRole('button', { name: 'Previous page' }).click()
    expect(await names()).toEqual(range(21, 30))

    // entries per page (5-25); eight pages of five become a jump-to-page input
    const size = card.getByRole('combobox', { name: 'Entries per page' })
    await expect(size).toHaveValue('10')
    expect(await size.locator('option').allTextContents()).toEqual(['5', '10', '15', '20', '25'])
    await size.selectOption('5')
    expect(await names()).toEqual(range(1, 5))
    await expect(pages.getByRole('button', { name: /^Page \d+$/ })).toHaveCount(0)
    const jump = pages.getByRole('spinbutton', { name: 'Go to page (1 to 8)' })
    await expect(jump).toHaveValue('1')
    await jump.fill('7')
    expect(await names()).toEqual(range(31, 35))
    await pages.getByRole('button', { name: 'Next page' }).click()
    expect(await names()).toEqual(range(36, 40))
    await size.selectOption('25')
    expect(await names()).toEqual(range(1, 25))

    // the header stays at the top while the fixed-height body scrolls
    const scroller = table.locator('xpath=..')
    await scroller.evaluate((node) => { node.scrollTop = 300 })
    await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(200)
    const header = await table.locator('thead th').first().boundingBox()
    const box = await scroller.boundingBox()
    expect(Math.abs(header!.y - box!.y)).toBeLessThanOrEqual(1)
    await expectTouchReady(page, card)
  })

  test('[WID-068] export without csvData downloads the Material CSV of the columns and rows, without icon text @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accTableCells')
    expect(payload.csvData ?? null).toBeNull()
    const image = payload.rows[0].imageUrl
    await expectLoaded(page, 'accTableCells')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Owned Typed Cells' }).click()])
    expect(download.suggestedFilename()).toMatch(/^Owned Typed Cells \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
    const csv = await downloadText(download)
    expect(csv).toBe([
      '"Name","Count","Status","Product","Detail","Tooltip","Image URL","Image Label","Image Total","Image Total Type"',
      `"Owned parent","1234567","Shipped","","","Left the owned dock","${image}","Owned product","2500","sold"`,
      `"Owned second","42","Open","","","Owned second tip","${image}","Owned product","0",""`,
      '',
    ].join('\n'))
    expect(csv).not.toContain('open_in_new')
  })

  test('[WID-068] each table of a multi-table widget has its own export button and footer @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accMultiTableExtras')
    const card = widget(page, 'accMultiTableExtras')
    await expect(card.locator('[data-qqq-id="button-widget-export-accMultiTableExtras"]')).toHaveCount(0)
    const first = card.locator('[data-qqq-id="table-widget-accMultiTableExtras-0"]')
    const second = card.locator('[data-qqq-id="table-widget-accMultiTableExtras-1"]')
    await expect(first.getByRole('heading', { name: 'Owned first table' })).toBeVisible()
    await expect(second.getByRole('heading', { name: 'Owned second table' })).toBeVisible()
    await expect(first.locator('[data-qqq-id="table-footer-accMultiTableExtras-0"] i')).toHaveText('Owned first footer')
    await expect(second.locator('[data-qqq-id="table-footer-accMultiTableExtras-1"] b')).toHaveText('Owned second footer')
    await expect(first.locator('[data-qqq-id^="table-footer-"]')).toHaveCount(1)

    const [firstDownload] = await Promise.all([page.waitForEvent('download'), first.getByRole('button', { name: 'Export Owned first table' }).click()])
    expect(firstDownload.suggestedFilename()).toMatch(/^Owned first table \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
    expect(await downloadText(firstDownload)).toBe('"Name","Qty"\n"Owned alpha","1500"\n')
    const [secondDownload] = await Promise.all([page.waitForEvent('download'), second.getByRole('button', { name: 'Export Owned second table' }).click()])
    expect(secondDownload.suggestedFilename()).toMatch(/^Owned second table \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
    expect(await downloadText(secondDownload)).toBe('"Owned CSV header"\n"Owned CSV value"\n')
    await expectTouchReady(page, card)
  })

  test('[WID-069] pie: theme color names, a full pie, the percent tooltip and legend toggles @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'accPieNamed')
    expect(payload.chartData.datasets[0].backgroundColors).toEqual(['info', 'success', '#8E24AA'])
    await expectLoaded(page, 'accPieNamed')
    const card = widget(page, 'accPieNamed')
    const sectors = card.locator('.recharts-pie-sector path')
    await expect(sectors).toHaveCount(3)
    expect(await sectors.evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase()))).toEqual(['#0062FF', '#43A047', '#8E24AA'])
    // a full pie: one arc per sector, each closing at the same center (a donut sector has two arcs)
    const shapes = await sectors.evaluateAll((paths) => paths.map((path) => {
      const d = (path.getAttribute('d') ?? '').replace(/\s+/g, ' ').trim()
      return { arcs: (d.match(/A/g) ?? []).length, end: /L ([\d.-]+,[\d.-]+) Z$/.exec(d)?.[1] ?? null }
    }))
    expect(shapes.map((shape) => shape.arcs)).toEqual([1, 1, 1])
    expect(new Set(shapes.map((shape) => shape.end)).size).toBe(1)
    expect(shapes[0].end).not.toBeNull()

    // the tooltip adds the percent of the total (Gamma, the lower half, is 3 of 6)
    await sectors.nth(2).hover()
    await expect(card.locator('[data-qqq-id="chart-tooltip"]')).toHaveText('Gamma: 3 (50.0%)')

    const beta = card.getByRole('button', { name: 'Beta: 2' })
    await expect(beta).toHaveAttribute('aria-pressed', 'true')
    await beta.click()
    await expect(beta).toHaveAttribute('aria-pressed', 'false')
    await expect(sectors).toHaveCount(2)
    expect(await sectors.evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase()))).toEqual(['#0062FF', '#8E24AA'])
    await beta.click()
    await expect(sectors).toHaveCount(3)
    await expectTouchReady(page, card.locator('[data-qqq-id="chart-legend-accPieNamed"]'))
  })

  test('[WID-069] stacked: backgroundColor fills, the hovered dataset tooltip, a right whole-number axis, turned labels and legend toggles @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accStackedExtras')
    const card = widget(page, 'accStackedExtras')
    const bars = card.locator('.recharts-bar')
    await expect(bars).toHaveCount(2)
    // North fills from backgroundColor "success" (a theme name), South from a CSS color; zero values draw nothing
    expect(new Set(await bars.nth(0).locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase())))).toEqual(new Set(['#43A047']))
    expect(await bars.nth(0).locator('.recharts-bar-rectangle path').count()).toBe(10)
    expect(new Set(await bars.nth(1).locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase())))).toEqual(new Set(['#8E24AA']))
    expect(await bars.nth(1).locator('.recharts-bar-rectangle path').count()).toBe(7)

    // the y axis sits on the right with whole-number ticks
    const canvas = await byId(page, 'chart-canvas-accStackedExtras').boundingBox()
    const yAxis = await card.locator('.recharts-yAxis').boundingBox()
    expect(yAxis!.x).toBeGreaterThan(canvas!.x + canvas!.width / 2)
    const ticks = await card.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').allTextContents()
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every((tick) => /^\d+$/.test(tick.trim()))).toBe(true)
    expect(ticks.map((tick) => tick.trim())).toContain('3')
    // long category labels turn so none overlap (every label is drawn)
    const labels = card.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value')
    await expect(labels).toHaveCount(10)
    expect((await labels.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('transform') ?? ''))).every((transform) => /rotate\(-45/.test(transform))).toBe(true)

    // the tooltip names only the hovered dataset
    await bars.nth(0).locator('.recharts-bar-rectangle path').first().hover()
    const tooltip = card.locator('[data-qqq-id="chart-tooltip"]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('p')).toHaveText(['North: 1'])

    await card.getByRole('button', { name: 'North' }).click()
    await expect(card.locator('.recharts-bar-rectangle path')).toHaveCount(7)
    await card.getByRole('button', { name: 'North' }).click()
    await expect(card.locator('.recharts-bar-rectangle path')).toHaveCount(17)
    await expectTouchReady(page, card.locator('[data-qqq-id="chart-legend-accStackedExtras"]'))
  })

  test('[WID-069] single-series legends: a horizontal bar legend and line badges above the chart @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accHorizontalLegend')
    await expect(byId(page, 'chart-legend-accHorizontalLegend')).toHaveText('Owned only series')
    await expectLoaded(page, 'accLineBadges')
    const card = widget(page, 'accLineBadges')
    const legend = byId(page, 'chart-legend-accLineBadges')
    await expect(legend).toHaveText('Owned units')
    const legendBox = await legend.boundingBox()
    const canvas = await byId(page, 'chart-canvas-accLineBadges').boundingBox()
    expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(canvas!.y + 1)
    // the series color "info" is the Material theme color
    await expect(card.locator('.recharts-line-curve')).toHaveAttribute('stroke', '#0062FF')
    await expect(card.locator('circle.qqq-chart-point')).toHaveCount(3)
    await legend.getByRole('button', { name: 'Owned units' }).click()
    await expect(card.locator('circle.qqq-chart-point')).toHaveCount(0)
    await legend.getByRole('button', { name: 'Owned units' }).click()
    await expect(card.locator('circle.qqq-chart-point')).toHaveCount(3)
    await expectTouchReady(page, legend)
  })

  test('[WID-069] a small line chart shows y values and a grid; a bar chart ends with the As of line @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accSmallLineTicks')
    const small = widget(page, 'accSmallLineTicks')
    // the chart chunk loads lazily and draws once its width is measured
    await expect(small.locator('circle.qqq-chart-point')).toHaveCount(4)
    const ticks = await small.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').allTextContents()
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every((tick) => /^[\d,]+$/.test(tick.trim()))).toBe(true)
    expect(await small.locator('.recharts-cartesian-grid-horizontal line').count()).toBeGreaterThan(0)

    await expectLoaded(page, 'accBarAsOf')
    const today = await page.evaluate(() => new Date().toDateString())
    const asOf = byId(page, 'chart-as-of-accBarAsOf')
    await expect(asOf).toHaveText(`As of ${today}`)
    await expect(asOf.locator('svg')).toHaveCount(1)
    // only barChart widgets carry it
    await expect(page.locator('[data-qqq-id="chart-as-of-accStackedExtras"]')).toHaveCount(0)
  })
})
