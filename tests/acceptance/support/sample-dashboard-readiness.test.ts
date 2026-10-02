/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { afterEach, expect, test } from 'vitest'
import { sampleDashboardReady } from '../specs/navigation/sample-dashboard-readiness'

afterEach(() => { document.body.innerHTML = '' })

test('shell and breadcrumb without AppHome are not a ready dashboard', () => {
  document.body.innerHTML = '<main id="main-content"><nav aria-label="Breadcrumb">Sample Widgets Dashboard</nav></main>'
  expect(sampleDashboardReady()).toBe(false)
})

test('an empty mounted AppHome cannot pass vacuously', () => {
  document.body.innerHTML = '<div data-qqq-id="app-home-SampleWidgetsDashboard"><section data-qqq-id="widget-grid"></section></div>'
  expect(sampleDashboardReady()).toBe(false)
})

/** Fixture output declared by the sample dashboard and existing WID renderer assertions. */
function renderedDashboard() {
  const contents: Record<string, string> = {
    SampleBigNumberBlocksWidget: '<div data-block-type="BIG_NUMBER">123</div>',
    SampleMultiStatisticsWidget: '<div data-qqq-id="multi-statistics-group-SampleMultiStatisticsWidget-0">Statistics</div>',
    SamplePieChartWidget: '<table data-qqq-id="chart-data-SamplePieChartWidget"><tbody><tr><td>Pie</td></tr></tbody></table>',
    SampleStatisticsWidget: '<span data-qqq-id="statistics-count-SampleStatisticsWidget">123</span>',
    SampleTableWidget: '<table><tbody><tr><td>Row 1</td></tr></tbody></table>',
    SampleStackedBarChartWidget: '<table data-qqq-id="chart-data-SampleStackedBarChartWidget"><tbody><tr><td>Stack</td></tr></tbody></table>',
    SampleStepperWidget: '<li data-qqq-id="stepper-step-SampleStepperWidget-0">Step 1</li>',
    SampleHTMLWidget: '<div data-qqq-id="html-widget-SampleHTMLWidget">Purely Custom</div>',
    SampleSmallLineChartWidget: '<table data-qqq-id="chart-data-SampleSmallLineChartWidget"><tbody><tr><td>Small</td></tr></tbody></table>',
    SampleLineChartWidget: '<table data-qqq-id="chart-data-SampleLineChartWidget"><tbody><tr><td>Line</td></tr></tbody></table>',
    SampleBarChartWidget: '<table data-qqq-id="chart-data-SampleBarChartWidget"><tbody><tr><td>Bar</td></tr></tbody></table>',
  }
  document.body.innerHTML = `<div data-qqq-id="app-home-SampleWidgetsDashboard"><section data-qqq-id="widget-grid">${Object.entries(contents).map(([name, html]) => `<div data-qqq-id="widget-grid-item-${name}"><section data-qqq-id="widget-${name}" aria-busy="false">${html}</section></div>`).join('')}</section></div>`
}

test('all eleven actual fixture renderers are ready without scrolling offscreen cards', () => {
  renderedDashboard()
  expect(sampleDashboardReady()).toBe(true)
})

test('eleven wrappers cannot substitute for the exact missing widget card', () => {
  renderedDashboard()
  document.querySelector('[data-qqq-id="widget-SampleTableWidget"]')!.remove()
  expect(sampleDashboardReady()).toBe(false)
})

test('an actual held table request remains unready even if old rows are present', () => {
  renderedDashboard()
  document.querySelector('[data-qqq-id="widget-SampleTableWidget"]')!.setAttribute('aria-busy', 'true')
  expect(sampleDashboardReady()).toBe(false)
})

test('busy false with an actual widget error is not readiness', () => {
  renderedDashboard()
  document.querySelector('[data-qqq-id="widget-SampleTableWidget"]')!.insertAdjacentHTML('beforeend', '<div role="alert" data-qqq-id="widget-error-SampleTableWidget">Failed</div>')
  expect(sampleDashboardReady()).toBe(false)
})

test('a lazy chart fallback below a nonbusy card is not a rendered chart', () => {
  renderedDashboard()
  document.querySelector('[data-qqq-id="widget-SamplePieChartWidget"]')!.innerHTML = '<div class="h-60 animate-pulse rounded bg-muted"></div>'
  expect(sampleDashboardReady()).toBe(false)
})

test('held table completion requires real rows, not only a cleared busy flag', () => {
  renderedDashboard()
  const card = document.querySelector('[data-qqq-id="widget-SampleTableWidget"]')!
  card.setAttribute('aria-busy', 'true')
  card.innerHTML = '<div role="status" aria-label="Loading widget"></div>'
  expect(sampleDashboardReady()).toBe(false)
  card.setAttribute('aria-busy', 'false')
  card.innerHTML = ''
  expect(sampleDashboardReady()).toBe(false)
  card.innerHTML = '<table><tbody><tr><td>Forwarded row</td></tr></tbody></table>'
  expect(sampleDashboardReady()).toBe(true)
})

test('one missing declared widget is not accepted as a smaller completed dashboard', () => {
  renderedDashboard()
  document.querySelector('[data-qqq-id="widget-grid-item-SampleTableWidget"]')!.remove()
  expect(sampleDashboardReady()).toBe(false)
})
