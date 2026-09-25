/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { CronUIWidget } from './CronUIWidget'

/** Metadata as served for `accHostCron` (built by CronUIWidgetRenderer). */
const meta = {
  name: 'accHostCron',
  label: 'Owned Schedule',
  type: 'cronUI',
  hasPermission: true,
  defaultValues: {
    tableName: 'accWidgetHost',
    cronExpressionFieldName: 'cronExpression',
    timeZoneFieldName: 'cronTimeZoneId',
    includeOnRecordEditScreen: true,
  },
} as QWidgetMetaData
const hostTable = {
  name: 'accWidgetHost',
  label: 'Widget Host',
  fields: {
    cronExpression: { name: 'cronExpression', label: 'Schedule Expression', type: 'STRING', isRequired: false },
    cronTimeZoneId: { name: 'cronTimeZoneId', label: 'Time Zone', type: 'STRING', isRequired: false },
  },
} as unknown as QTableMetaData
/** Host record 1 as served by `GET /data/accWidgetHost/1`. */
const host: QRecord = {
  tableName: 'accWidgetHost',
  values: { id: 1, name: 'Owned host one', cronExpression: '0 0 9 * * ?', cronTimeZoneId: 'America/Chicago' },
  displayValues: { cronExpression: '0 0 9 * * ?', cronTimeZoneId: 'America/Chicago' },
}
const context = { tableName: 'accWidgetHost', recordId: '1', record: host, tableMetaData: hostTable }

describe('CronUIWidget (view)', () => {
  it('shows the expression, the backend description and the time zone', () => {
    const { container } = render(<CronUIWidget widgetMetaData={meta} data={{ label: 'Owned Schedule', cronDescription: 'Every day, at 9:00 am', type: 'cronUI' }} recordContext={context} />)
    const text = (id: string) => container.querySelector(`[data-qqq-id="${id}-accHostCron"]`)?.textContent
    expect(text('cron-expression')).toBe('0 0 9 * * ?')
    expect(text('cron-description')).toBe('Every day, at 9:00 am')
    expect(text('cron-time-zone')).toBe('America/Chicago')
    expect(screen.getByText('Schedule Expression')).toBeInTheDocument()
    expect(screen.getByText('Time Zone')).toBeInTheDocument()
  })

  it('shows No schedule set when the record has no expression', () => {
    const empty: QRecord = { tableName: 'accWidgetHost', values: { id: 3, cronExpression: null, cronTimeZoneId: null } }
    render(<CronUIWidget widgetMetaData={meta} data={{ label: 'Owned Schedule', type: 'cronUI' }} recordContext={{ ...context, record: empty }} />)
    expect(screen.getByText('No schedule set')).toBeInTheDocument()
  })

  it('shows the backend error as a contained alert', () => {
    const invalid: QRecord = { tableName: 'accWidgetHost', values: { cronExpression: 'invalid' } }
    render(<CronUIWidget widgetMetaData={meta} data={{ error: 'Invalid cron expression: invalid', type: 'cronUI' }} recordContext={{ ...context, record: invalid }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid cron expression: invalid')
  })
})
