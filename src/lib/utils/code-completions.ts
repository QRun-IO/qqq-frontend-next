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

/** @file Local script suggestions matching the QQQ API helpers offered by Material. */
import { codeKeywords, MAX_HIGHLIGHT_LENGTH, type CodeLanguage } from './code-highlight'

export interface CodeCompletion { text: string; description: string }
export interface CodeCompletionMatch { start: number; end: number; items: CodeCompletion[] }

const API_COMPLETIONS: CodeCompletion[] = [
  { text: 'api.get(', description: 'Get a record from a table' },
  { text: 'api.query(', description: 'Search for records in a table' },
  { text: 'api.insert(', description: 'Create a record in a table' },
  { text: 'api.update(', description: 'Update a record in a table' },
  { text: 'api.delete(', description: 'Remove a record from a table' },
  { text: 'api.bulkInsert(', description: 'Create multiple records in a table' },
  { text: 'api.bulkUpdate(', description: 'Update multiple records in a table' },
  { text: 'api.bulkDelete(', description: 'Remove multiple records from a table' },
  { text: 'api.runProcess(', description: 'Run a process' },
  { text: 'logger.log(', description: 'Write a script log line' },
]

/**
 * Finds matching helpers, keywords and file words at the caret without editing the source.
 * @param source - Current file contents.
 * @param caret - Collapsed selection offset.
 * @param language - Current file language.
 * @param explicit - Ctrl+Space allows an empty prefix.
 * @returns Replacement range and suggestions, or null when there is no match.
 */
export function findCodeCompletions(source: string, caret: number, language: CodeLanguage, explicit = false): CodeCompletionMatch | null {
  if (source.length > MAX_HIGHLIGHT_LENGTH) return null
  let start = caret
  while (start > 0 && /[\w$.]/.test(source[start - 1])) start--
  const prefix = source.slice(start, caret)
  if (!explicit && (!prefix || (!prefix.includes('.') && prefix.length < 2))) return null
  const end = caret + (source.slice(caret).match(/^[\w$.]*/)?.[0].length ?? 0)
  const candidates: CodeCompletion[] = language === 'javascript' || language === 'java' ? [...API_COMPLETIONS] : []
  candidates.push(...codeKeywords(language).map(text => ({ text, description: 'Keyword' })))
  const otherText = source.slice(0, start) + ' ' + source.slice(end)
  candidates.push(...[...new Set(otherText.match(/[$A-Za-z_][$\w]*(?:\.[$A-Za-z_][$\w]*)*/g) ?? [])]
    .map(text => ({ text, description: 'In this file' })))
  const seen = new Set<string>()
  const lower = prefix.toLowerCase()
  const items = candidates.filter(item => {
    if (seen.has(item.text) || item.text === prefix) return false
    seen.add(item.text)
    return item.text.toLowerCase().startsWith(lower) || (!prefix.includes('.') && item.text.split('.').at(-1)!.toLowerCase().startsWith(lower))
  }).slice(0, 50)
  return items.length ? { start, end, items } : null
}
