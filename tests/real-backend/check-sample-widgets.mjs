/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'node:assert/strict'
import path from 'node:path'

/** Compare rendered widgets with the actual canonical QQQ widget payloads. */
export async function checkSampleWidgets({ page, baseUrl, samplePort, output, evidence }) {
  evidence.widgetPayloads = {}
  for (const name of ['SampleStatisticsWidget', 'SampleBarChartWidget', 'SampleLineChartWidget', 'SamplePieChartWidget', 'SampleHTMLWidget']) {
    const response = await fetch(`http://127.0.0.1:${samplePort}/widget/${name}`)
    assert.equal(response.status, 200)
    evidence.widgetPayloads[name] = await response.json()
  }
  const versioned = await fetch(`http://127.0.0.1:${samplePort}/qqq/v1/widget/SampleStatisticsWidget`)
  evidence.versionedWidgetRoute = { status: versioned.status, contentType: versioned.headers.get('content-type') }
  await page.goto(`${baseUrl}/app/SampleWidgetsDashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('heading', { name: 'Sample Widgets Dashboard', exact: true }).waitFor({ timeout: 45000 })
  await page.screenshot({ path: path.join(output, 'widgets-loaded.png'), fullPage: true })
  evidence.widgetText = await page.locator('body').innerText()
  await page.getByText('98.5%', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByText('Purely Custom', { exact: true }).waitFor()
  const bars = page.locator('[data-qqq-id="bar-chart-SampleBarChartWidget"] .recharts-bar-rectangle')
  await bars.first().waitFor()
  assert.equal(await bars.count(), evidence.widgetPayloads.SampleBarChartWidget.chartData.labels.length)
  await page.locator('[data-qqq-id="line-chart-SampleLineChartWidget"] .recharts-line-curve').waitFor()
  const sectors = page.locator('[data-qqq-id="pie-chart-SamplePieChartWidget"] .recharts-pie-sector')
  await sectors.first().waitFor()
  assert.equal(await sectors.count(), evidence.widgetPayloads.SamplePieChartWidget.chartData.labels.length)
  await page.screenshot({ path: path.join(output, 'widgets-rendered.png'), fullPage: true })
  evidence.checks.push('Canonical statistics value, generated HTML, bar shapes, line curve and pie sectors render from QQQ payloads')
}
