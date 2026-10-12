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
 * @file Search page — every page (app, table, process, report) and recently viewed record
 * matching `?q=`, plus the records a backend record search finds when the metadata
 * advertises searchable tables. URL state: `q`, `tables`, `view=pages`, `sort=recent`.
 */

'use client'

import React from 'react'

import { SearchPage } from '@/components/search/SearchPage'

/**
 * Renders the search page at `/app/search`.
 *
 * @returns The search page.
 */
export default function SearchResultsPage() {
  return <SearchPage />
}
