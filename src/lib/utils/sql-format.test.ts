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

// Tests for the workbench SQL formatter

import { describe, expect, it } from 'vitest'

import { formatWorkbenchSql } from './sql-format'

describe('formatWorkbenchSql', () => {
  it('formats per dialect, upper-cases keywords and keeps :parameters', () => {
    expect(formatWorkbenchSql('select id from person where a = :since', 'postgresql')).toBe(
      'SELECT\n  id\nFROM\n  person\nWHERE\n  a = :since'
    )
    expect(formatWorkbenchSql('select `id` from t', 'mysql')).toContain('SELECT')
    expect(formatWorkbenchSql('select 1', 'sqlite')).toBe('SELECT\n  1')
    expect(formatWorkbenchSql('select 1', undefined)).toBe('SELECT\n  1')
  })

  it('throws on SQL it cannot parse', () => {
    expect(() => formatWorkbenchSql('select "unterminated', 'postgresql')).toThrow()
  })
})
