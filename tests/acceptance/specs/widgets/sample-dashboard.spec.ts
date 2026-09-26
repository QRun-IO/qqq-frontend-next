/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// The stock sample's widget dashboard and greetings app: every sample widget renders its real payload.
import { expect, open, test } from '../../support/fixtures'
import { expectNoHorizontalScroll, expectTouchReady } from '../../support/touch'
import { chartTable, expectLoaded, isLargeLayout, widget, widgetPayload } from './widget-support'

const DASHBOARD = '/app/SampleWidgetsDashboard'

test.describe('sample widgets dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, DASHBOARD)
    await expect(page.getByRole('heading', { level: 1, name: 'Sample Widgets Dashboard' })).toBeVisible()
  })

  test('[WID-040] widgets render in declared order sized by gridColumns in twelfths @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await (await backend.api.get('/qqq/v1/metaData')).json()
    const declared: string[] = meta.apps.SampleWidgetsDashboard.widgets
    const items = page.locator('[data-qqq-id^="widget-grid-item-"]')
    await expect(items).toHaveCount(declared.length)
    expect(await items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-qqq-id')!.replace('widget-grid-item-', '')))).toEqual(declared)
    const full = await page.locator('[data-qqq-id="widget-grid"]').boundingBox()
    const composite = await page.locator('[data-qqq-id="widget-grid-item-SampleBigNumberBlocksWidget"]').boundingBox()
    const third = await page.locator('[data-qqq-id="widget-grid-item-SampleMultiStatisticsWidget"]').boundingBox()
    // gridColumns 12 spans the grid
    expect(Math.round(composite!.width)).toBe(Math.round(full!.width))
    if (await isLargeLayout(page)) {
      // gridColumns 4 takes a third of it (less the gaps)
      expect(third!.width / full!.width).toBeGreaterThan(0.3)
      expect(third!.width / full!.width).toBeLessThan(0.34)
    } else {
      // on phones and tablets every widget takes the full width, one per row, in declared order
      const boxes = await items.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect))
      for (const [index, box] of boxes.entries()) {
        expect(Math.round(box.width), `${declared[index]} spans the grid`).toBe(Math.round(full!.width))
        if (index > 0) expect(box.top, `${declared[index]} sits below ${declared[index - 1]}`).toBeGreaterThanOrEqual(boxes[index - 1].bottom)
      }
      await expectTouchReady(page, page.locator('[data-qqq-id="widget-grid"]'))
    }
  })

  test('[WID-023] composite big-number blocks render values, up/down context, links and tooltips @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'SampleBigNumberBlocksWidget')
    const card = widget(page, 'SampleBigNumberBlocksWidget')
    await expect(card.locator('[data-layout="FLEX_ROW_WRAPPED"]').first()).toBeVisible()
    const bigNumbers = card.locator('[data-block-type="BIG_NUMBER"]')
    await expect(bigNumbers).toHaveCount(3)
    await expect(bigNumbers.nth(0)).toContainText('Big Number with Simple Context')
    await expect(bigNumbers.nth(0)).toContainText('123')
    await expect(bigNumbers.nth(0)).toContainText('context')
    await expect(bigNumbers.nth(1)).toContainText('Number with Up/Down Context')
    await expect(bigNumbers.nth(1)).toContainText('1,234')
    const upDown = card.locator('[data-block-type="UP_OR_DOWN_NUMBER"]')
    await expect(upDown).toHaveCount(2)
    await expect(upDown.nth(0)).toHaveAttribute('data-direction', 'down')
    await expect(upDown.nth(0)).toContainText('12,345')
    await expect(upDown.nth(1)).toHaveAttribute('data-direction', 'up')
    // same link for all parts of the first block; a per-slot link on the up/down number
    // in-app links (the static export adds trailing slashes)
    await expect(bigNumbers.nth(0).locator('a').first()).toHaveAttribute('href', /^\/same-link-for-all-parts\/?$/)
    await expect(upDown.nth(0).locator('a[href^="/custom-link-per-slot"]')).toHaveCount(1)
    await expect(bigNumbers.nth(0).locator('a').first()).toHaveAccessibleDescription('You can have the same tooltip for all parts')
    await upDown.nth(0).locator('a[href^="/custom-link-per-slot"]').hover()
    await expect(page.getByRole('tooltip').filter({ hasText: 'This number has a customized color' })).toBeVisible()
  })

  test('[WID-012] multi statistics shows every group, subheader and statistic value @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleMultiStatisticsWidget')
    await expectLoaded(page, 'SampleMultiStatisticsWidget')
    const card = widget(page, 'SampleMultiStatisticsWidget')
    for (const [index, group] of payload.statisticsGroupData.entries()) {
      const section = card.locator(`[data-qqq-id="multi-statistics-group-SampleMultiStatisticsWidget-${index}"]`)
      await expect(section.getByRole('heading', { name: group.header })).toBeVisible()
      await expect(section).toContainText(group.subheader)
      await expect(section.locator('[data-icon-name]').first()).toHaveAttribute('data-icon-name', group.icon)
      for (const [statIndex, stat] of group.statisticList.entries()) {
        await expect(section.locator(`[data-qqq-id="multi-statistics-stat-SampleMultiStatisticsWidget-${index}-${statIndex}"]`)).toHaveText(`${stat.label}${stat.value}`)
      }
    }
  })

  test('[WID-014] pie chart draws a colored slice per label with legend values and subheader @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SamplePieChartWidget')
    await expectLoaded(page, 'SamplePieChartWidget')
    const card = widget(page, 'SamplePieChartWidget')
    const { labels, datasets } = payload.chartData
    const slices = card.locator('.recharts-pie-sector path')
    await expect(slices).toHaveCount(labels.length)
    expect(await slices.evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase()))).toEqual(datasets[0].backgroundColors)
    const legend = card.locator('[data-qqq-id="chart-legend-SamplePieChartWidget"] li')
    expect(await legend.allTextContents()).toEqual(labels.map((label: string, i: number) => `${label}: ${datasets[0].data[i]}`))
    await expect(card.locator('[data-qqq-id="chart-subheader-main-SamplePieChartWidget"]')).toHaveText('1,000')
    const change = card.locator('[data-qqq-id="chart-subheader-change-SamplePieChartWidget"]')
    await expect(change).toHaveAttribute('data-direction', 'up')
    await expect(change).toHaveAttribute('data-good', 'true')
    await expect(change).toContainText('900%')
    await expect(card).toContainText('vs prev period')
    expect(await chartTable(page, 'SamplePieChartWidget')).toEqual(labels.map((label: string, i: number) => [label, String(datasets[0].data[i])]))
  })

  test('[WID-016] statistics shows the count, context and a colored percentage change @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleStatisticsWidget')
    await expectLoaded(page, 'SampleStatisticsWidget')
    await expect(page.locator('[data-qqq-id="statistics-count-SampleStatisticsWidget"]')).toHaveText(payload.count)
    await expect(page.locator('[data-qqq-id="statistics-context-SampleStatisticsWidget"]')).toHaveText(payload.countContext)
    const change = page.locator('[data-qqq-id="statistics-percentage-SampleStatisticsWidget"]')
    await expect(change).toContainText('-10%')
    await expect(change).toContainText(payload.percentageLabel)
    // increase is good, so a decrease is bad
    await expect(change).toHaveAttribute('data-direction', 'down')
    await expect(change).toHaveAttribute('data-good', 'false')
    await expect(change.getByRole('link', { name: '-10%' })).toHaveAttribute('href', payload.percentageURL)
  })

  test('[WID-019] table widget renders headers, rows, alignment and the fixed totals row @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleTableWidget')
    await expectLoaded(page, 'SampleTableWidget')
    const table = widget(page, 'SampleTableWidget').getByRole('table')
    expect(await table.locator('thead th').allTextContents()).toEqual(payload.columns.map((column: { header: string }) => column.header))
    const accessors = payload.columns.map((column: { accessor: string }) => column.accessor)
    const body = payload.rows.slice(0, -1).map((row: Record<string, string>) => accessors.map((key: string) => row[key]))
    expect(await table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent)))).toEqual(body)
    const total = payload.rows.at(-1)
    await expect(page.locator('[data-qqq-id="table-total-row-SampleTableWidget"]')).toHaveText(accessors.map((key: string) => total[key]).join(''))
    await expect(table.locator('tbody tr').first().locator('td').nth(1)).toHaveClass(/text-right/)
    // a table wider than its card scrolls inside the card, never the page
    await expectNoHorizontalScroll(page)
    const card = await widget(page, 'SampleTableWidget').boundingBox()
    const scroller = await table.locator('xpath=..').boundingBox()
    expect(scroller!.x + scroller!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    expect(await table.locator('xpath=..').evaluate((node) => getComputedStyle(node).overflowX)).toBe('auto')
  })

  test('[WID-017] stacked bar chart stacks each dataset with its colors and legend @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleStackedBarChartWidget')
    await expectLoaded(page, 'SampleStackedBarChartWidget')
    const card = widget(page, 'SampleStackedBarChartWidget')
    const { labels, datasets } = payload.chartData
    await expect(card.locator('.recharts-bar-rectangle')).toHaveCount(labels.length * datasets.length)
    await expect(card.locator('[data-qqq-id="chart-legend-SampleStackedBarChartWidget"]')).toContainText('One')
    await expect(card.locator('[data-qqq-id="chart-legend-SampleStackedBarChartWidget"]')).toContainText('Two')
    expect(await chartTable(page, 'SampleStackedBarChartWidget')).toEqual(labels.map((label: string, i: number) => [label, ...datasets.map((dataset: { data: number[] }) => String(dataset.data[i]))]))
    // bars of one label sit on top of each other (same x)
    const xs = await card.locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => Math.round(Number(path.getAttribute('x')))))
    expect(new Set(xs).size).toBe(labels.length)
  })

  test('[WID-018] stepper marks completed, current and upcoming steps with the current link @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleStepperWidget')
    await expectLoaded(page, 'SampleStepperWidget')
    const steps = page.locator('[data-qqq-id^="stepper-step-SampleStepperWidget-"]')
    await expect(steps).toHaveCount(payload.steps.length)
    expect(await steps.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-step-state')))).toEqual(['complete', 'current', 'upcoming'])
    await expect(steps.nth(0)).toContainText('Step 1: Underpants')
    await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step')
    await expect(steps.nth(1).getByRole('link', { name: '??' })).toHaveAttribute('href', payload.steps[1].linkURL)
    await expect(steps.nth(0).getByRole('link')).toHaveCount(0)
  })

  test('[WID-008] no-code HTML widget renders the sanitized user-defined markup @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'SampleHTMLWidget')
    const html = page.locator('[data-qqq-id="html-widget-SampleHTMLWidget"]')
    await expect(html).toContainText('Purely Custom')
    await expect(html.locator('i')).toHaveText('User')
    await expect(html.locator('b')).toHaveText('Defined')
    await expect(html.locator('u')).toHaveText('HTML')
    await expect(html.locator('div').first()).toHaveCSS('text-align', 'center')
  })

  test('[WID-010] small line chart shows title, HTML description and one point per month @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleSmallLineChartWidget')
    await expectLoaded(page, 'SampleSmallLineChartWidget')
    const card = widget(page, 'SampleSmallLineChartWidget')
    await expect(card.locator('[data-qqq-id="chart-smallLine-SampleSmallLineChartWidget"]')).toBeVisible()
    await expect(card.locator('[data-qqq-id="chart-title-SampleSmallLineChartWidget"]')).toHaveText(payload.title)
    await expect(card.locator('[data-qqq-id="chart-description-SampleSmallLineChartWidget"] strong')).toHaveText('increasing')
    const points = card.locator('circle.qqq-chart-point')
    await expect(points).toHaveCount(payload.chartData.labels.length)
    expect(await points.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-value'))))).toEqual(payload.chartData.datasets[0].data)
  })

  test('[WID-009] line chart draws one line with a point per label and the description @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleLineChartWidget')
    await expectLoaded(page, 'SampleLineChartWidget')
    const card = widget(page, 'SampleLineChartWidget')
    await expect(card.locator('.recharts-line')).toHaveCount(1)
    const points = card.locator('circle.qqq-chart-point')
    expect(await points.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-label')))).toEqual(payload.chartData.labels)
    expect(await chartTable(page, 'SampleLineChartWidget')).toEqual(payload.chartData.labels.map((label: string, i: number) => [label, String(payload.chartData.datasets[0].data[i])]))
    await expect(card.locator('[data-qqq-id="chart-description-SampleLineChartWidget"]')).toContainText('over the last five months')
  })

  test('[WID-002] bar chart draws one bar per label in its backend color @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const payload = await widgetPayload(backend.api, 'SampleBarChartWidget')
    await expectLoaded(page, 'SampleBarChartWidget')
    const card = widget(page, 'SampleBarChartWidget')
    await expect(card.locator('.recharts-bar-rectangle path')).toHaveCount(payload.chartData.labels.length)
    const fills = await card.locator('.recharts-bar-rectangle path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')?.toUpperCase()))
    expect(fills).toEqual(payload.chartData.datasets[0].backgroundColors)
    expect(await chartTable(page, 'SampleBarChartWidget')).toEqual(payload.chartData.labels.map((label: string, i: number) => [label, String(payload.chartData.datasets[0].data[i])]))
    await expect(card.locator('svg[role="img"]')).toHaveAttribute('aria-label', 'Bar Chart chart')
  })

  test('[WID-042] header icons render with their metadata names, roles and colors @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'SampleBarChartWidget')
    const right = page.locator('[data-qqq-id="widget-icon-topRightInsideCard-SampleBarChartWidget"]')
    await expect(right).toHaveAttribute('data-icon-name', 'sports')
    await expect(right).toHaveCSS('color', 'rgb(143, 0, 216)')
    const left = page.locator('[data-qqq-id="widget-icon-topLeftInsideCard-SampleStatisticsWidget"]')
    await expect(left).toHaveAttribute('data-icon-name', 'assessment')
    await expect(left).toHaveCSS('color', 'rgb(0, 97, 255)')
    // top-left icons come before the label, top-right after the controls
    const statsLabel = await page.locator('[data-qqq-id="widget-label-SampleStatisticsWidget"]').boundingBox()
    expect((await left.boundingBox())!.x).toBeLessThan(statsLabel!.x)
    const barLabel = await page.locator('[data-qqq-id="widget-label-SampleBarChartWidget"]').boundingBox()
    expect((await right.boundingBox())!.x).toBeGreaterThan(barLabel!.x)
  })

  test('[WID-043] the widget label shows its metadata tooltip on hover and focus @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'SampleBarChartWidget')
    const label = page.locator('[data-qqq-id="widget-label-SampleBarChartWidget"]')
    const tooltip = page.locator('[data-qqq-id="widget-tooltip-SampleBarChartWidget"]')
    await expect(tooltip).toBeHidden()
    // hover again if the dashboard grid was still settling (a layout shift moves the label from under the pointer)
    await expect(async () => {
      await page.mouse.move(0, 0)
      await label.hover()
      await expect(tooltip).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    await expect(tooltip).toHaveText('This is a sample of a bar chart')
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
    await label.locator('xpath=..').focus()
    await expect(tooltip).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tooltip).toBeHidden()
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 412, height: 839 }, hasTouch: true })

    test('[WID-043] a tap on the widget label shows its tooltip inside the screen and a tap elsewhere hides it @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await expectLoaded(page, 'SampleBarChartWidget')
      const trigger = page.locator('[data-qqq-id="widget-label-SampleBarChartWidget"]').locator('xpath=..')
      const tooltip = page.locator('[data-qqq-id="widget-tooltip-SampleBarChartWidget"]')
      const target = await trigger.boundingBox()
      expect(Math.min(target!.width, target!.height), 'the label is a 44 px touch target').toBeGreaterThanOrEqual(44)
      await trigger.tap()
      await expect(tooltip).toBeVisible()
      await expect(tooltip).toHaveText('This is a sample of a bar chart')
      const box = await tooltip.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(412)
      await expectTouchReady(page, page.locator('[data-qqq-id="widget-grid"]'))
      await page.getByRole('heading', { level: 1, name: 'Sample Widgets Dashboard' }).tap()
      await expect(tooltip).toBeHidden()
    })
  })
})

test('[WID-003] an untyped widget whose renderer emits chart data renders as a bar chart @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const meta = await (await backend.api.get('/qqq/v1/metaData')).json()
  expect(meta.widgets.PersonsByCreateDateBarChart.type).toBeUndefined()
  const payload = await widgetPayload(backend.api, 'PersonsByCreateDateBarChart')
  expect(payload.type).toBe('chart')
  await open(page, '/app/greetingsApp')
  await expectLoaded(page, 'PersonsByCreateDateBarChart')
  const card = widget(page, 'PersonsByCreateDateBarChart')
  await expect(card.locator('[data-qqq-id="chart-bar-PersonsByCreateDateBarChart"]')).toBeVisible()
  await expect(card.locator('[data-qqq-id="chart-title-PersonsByCreateDateBarChart"]')).toHaveText(payload.title)
  expect(await chartTable(page, 'PersonsByCreateDateBarChart')).toEqual(payload.chartData.labels.map((label: string, i: number) => [label, String(payload.chartData.datasets[0].data[i])]))
  // the zero month has a bar slot but no drawn bar
  await expect(card.locator('.recharts-bar-rectangle')).toHaveCount(payload.chartData.labels.length)
  await expect(card.locator('.recharts-bar-rectangle path')).toHaveCount(payload.chartData.datasets[0].data.filter((value: number) => value !== 0).length)
})

test('[WID-015] QuickSight chart embeds the URL the real renderer obtained from the owned provider endpoint @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const payload = await widgetPayload(backend.api, 'QuickSightChartRenderer')
  expect(payload.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/owned-embed\.html$/)
  // metadata never leaks the configured secret key
  expect(JSON.stringify(await (await backend.api.get('/metaData')).json())).not.toContain('owned-fixture-secret')
  await open(page, '/app/greetingsApp')
  await expectLoaded(page, 'QuickSightChartRenderer')
  const frame = page.locator('[data-qqq-id="quicksight-QuickSightChartRenderer"]')
  await expect(frame).toHaveAttribute('src', payload.url)
  await expect(frame).toHaveAttribute('title', 'Example Quicksight Chart')
  const embedded = page.frameLocator('[data-qqq-id="quicksight-QuickSightChartRenderer"]')
  await expect(embedded.getByRole('heading', { name: 'Owned embedded chart' })).toBeVisible()
  await expect(embedded.getByText('42 units')).toBeVisible()
})
