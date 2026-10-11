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
 * @file SqlEditor — CodeMirror 6 SQL editor for workbench cells: dialect-aware highlighting,
 * schema autocomplete (tables, columns, keywords) plus QQQ table/field names that insert their
 * SQL names, and Ctrl/Cmd+Enter to run.
 *
 * Keyboard (WCAG 2.1.2 No Keyboard Trap): Tab is not bound, so Tab and Shift+Tab always move
 * focus out of the editor; indentation uses the editor's indent commands (Ctrl+] / Ctrl+[).
 * Loaded only inside the lazily imported workbench widget, so CodeMirror stays out of the
 * initial bundle.
 */

'use client'

import React, { useEffect, useRef } from 'react'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { MySQL, PostgreSQL, SQLite, StandardSQL, sql, type SQLDialect } from '@codemirror/lang-sql'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap, lineNumbers, placeholder } from '@codemirror/view'

import type { SqlSchema, SqlWorkbenchDialect } from '@/types'
import { editorDialectName, editorSchema, qqqNameCompletions } from '@/lib/utils/sql-workbench'

const DIALECTS: Record<ReturnType<typeof editorDialectName>, SQLDialect> = {
  PostgreSQL,
  MySQL,
  SQLite,
  StandardSQL,
}

/** Props for {@link SqlEditor}. */
export interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  dialect?: SqlWorkbenchDialect
  schema?: SqlSchema
  readOnly?: boolean
  /** Called on Ctrl/Cmd+Enter. */
  onRun?: () => void
  /** Accessible name of the editor. */
  label: string
  /** `data-qqq-id` of the editable content. */
  qqqId: string
}

/**
 * A completion source offering QQQ table and field names that insert SQL names.
 *
 * @param schema - The backend schema, with its QQQ tables.
 * @returns The completion source.
 */
function qqqCompletionSource(schema: SqlSchema | undefined): CompletionSource {
  const options = qqqNameCompletions(schema)
  return (context) => {
    const word = context.matchBefore(/[\w.]+/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    return { from: word.from, options, validFor: /^[\w.]*$/ }
  }
}

/**
 * Builds the language extension for a dialect and schema.
 *
 * @param dialect - Backend dialect.
 * @param schema - Backend schema.
 * @returns The extensions for the language compartment.
 */
function languageExtensions(
  dialect: SqlWorkbenchDialect | undefined,
  schema: SqlSchema | undefined
) {
  const sqlDialect = DIALECTS[editorDialectName(dialect)]
  return [
    sql({ dialect: sqlDialect, schema: editorSchema(schema), upperCaseKeywords: true }),
    sqlDialect.language.data.of({ autocomplete: qqqCompletionSource(schema) }),
  ]
}

/**
 * Renders the editor.
 *
 * @param props - Component props.
 * @returns The editor container.
 */
export function SqlEditor(props: SqlEditorProps) {
  const { value, onChange, dialect, schema, readOnly = false, onRun, label, qqqId } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageRef = useRef(new Compartment())
  const readOnlyRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  onChangeRef.current = onChange
  onRunRef.current = onRun

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ activateOnTyping: true }),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          placeholder('SELECT …   (Ctrl/Cmd+Enter to run)'),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current?.()
                return true
              },
            },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
          ]),
          languageRef.current.of(languageExtensions(dialect, schema)),
          readOnlyRef.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.contentAttributes.of({ 'aria-label': label, 'data-qqq-id': qqqId }),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': {
              fontSize: '13px',
              border: '1px solid var(--border, #d4d4d8)',
              borderRadius: '6px',
            },
            '&.cm-focused': { outline: '2px solid var(--ring, #6366f1)', outlineOffset: '1px' },
            '.cm-content': {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              minHeight: '5rem',
            },
            '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The view is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageRef.current.reconfigure(languageExtensions(dialect, schema)),
    })
  }, [dialect, schema])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
    })
  }, [readOnly])

  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={hostRef} className="qqq-sql-workbench-editor min-w-0" />
}
