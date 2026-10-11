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

/**
 * @file SQL formatting for the workbench's Format button. Imports only the four dialects the
 * workbench uses (sql-formatter's tree-shakable `formatDialect` API) and is loaded with
 * `import()` on first use, so the formatter is not part of any page load.
 */

import { formatDialect, mysql, postgresql, sql, sqlite } from 'sql-formatter'

import type { SqlWorkbenchDialect } from '@/types'
import { formatterLanguage } from './sql-workbench'

const DIALECTS = { postgresql, mysql, sqlite, sql }

/**
 * Formats SQL for a backend dialect, upper-casing keywords and keeping `:name` parameters.
 *
 * @param text - The SQL.
 * @param dialect - The backend's dialect.
 * @returns The formatted SQL.
 * @throws When the formatter cannot parse the SQL.
 */
export function formatWorkbenchSql(text: string, dialect: SqlWorkbenchDialect | undefined): string {
  return formatDialect(text, {
    dialect: DIALECTS[formatterLanguage(dialect)],
    keywordCase: 'upper',
    paramTypes: { named: [':'] },
  })
}
