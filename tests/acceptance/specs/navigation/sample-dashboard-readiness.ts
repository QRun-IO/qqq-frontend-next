/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** Fixed sample dashboard dependency boundary for NAV026. Runs in the document. */
export function sampleDashboardReady(): boolean {
  const home = document.querySelector('[data-qqq-id="app-home-SampleWidgetsDashboard"]')
  if (!home || home.querySelectorAll('[data-qqq-id^="widget-grid-item-"]').length !== 11) return false
  if (home.querySelector('[role="alert"], [aria-busy="true"], [aria-label="Loading widget"], [data-qqq-id^="widget-error-"], [data-qqq-id^="widget-no-permission-"], [data-qqq-id^="widget-permission-denied-"], [data-qqq-id^="widget-needs-selection-"]')) return false
  const outputs: Array<[string, string]> = [
    ['BigNumberBlocks', '[data-block-type="BIG_NUMBER"]'],
    ['MultiStatistics', '[data-qqq-id="multi-statistics-group-SampleMultiStatisticsWidget-0"]'],
    ['Statistics', '[data-qqq-id="statistics-count-SampleStatisticsWidget"]'],
    ['Table', 'tbody tr td'],
    ['Stepper', '[data-qqq-id="stepper-step-SampleStepperWidget-0"]'],
    ['HTML', '[data-qqq-id="html-widget-SampleHTMLWidget"]'],
    ...['PieChart', 'StackedBarChart', 'SmallLineChart', 'LineChart', 'BarChart'].map(name => [name, `[data-qqq-id="chart-data-Sample${name}Widget"] tbody tr td`] as [string, string]),
  ]
  return outputs.every(([name, selector]) => {
    const card = home.querySelector(`[data-qqq-id="widget-Sample${name}Widget"][aria-busy="false"]`)
    return Boolean(card?.querySelector(selector)?.textContent?.trim())
  })
}
