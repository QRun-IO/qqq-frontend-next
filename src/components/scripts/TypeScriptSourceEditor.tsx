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


/** @file CodeMirror TypeScript editor backed by bounded, advisory offline language analysis. */

'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { forceLinting, linter, lintGutter } from '@codemirror/lint'
import { Compartment, EditorState, StateEffect } from '@codemirror/state'
import { EditorView, hoverTooltip, keymap, lineNumbers } from '@codemirror/view'
import { EditorAnalysisBusyError, TypeScriptWorkerClient } from '@/lib/scripting/typescript-worker-client'
import type { IdeDefinition, IdeFile, IdeOperation } from '@/lib/scripting/typescript-session'
import { BUTTON_CLASS } from './ScriptPanels'

/**
 * Asks the linter to re-analyse the current buffer without a document change. forceLinting alone only fast-forwards a
 * lint that is already scheduled, so a request with nothing scheduled needs this effect (read by the linter's needsRefresh).
 */
const relintRequested = StateEffect.define<null>()

/**
 * Re-analyse the current buffer now, even when no document change has scheduled a lint.
 * @param view - The editor whose active buffer should be analysed.
 */
function requestLint(view: EditorView) {
  view.dispatch({ effects: relintRequested.of(null) })
  forceLinting(view)
}

/** Complete project buffers, with source persistence still owned by the parent workspace. */
export interface TypeScriptSourceEditorProps {
  files: IdeFile[]
  active: string
  readOnly: boolean
  declarations: string
  onChange: (content: string) => void
  onNavigate: (target: IdeDefinition) => void
  selection?: IdeDefinition | null
}

/**
 * Real language-service assistance never executes source or grants publish authority.
 * @param props - Current virtual project and editing callbacks.
 * @returns Accessible CodeMirror editor and explicit analysis controls.
 */
export function TypeScriptSourceEditor(props: TypeScriptSourceEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const helpId = useId()
  const viewRef = useRef<EditorView | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const clientRef = useRef<TypeScriptWorkerClient | null>(null)
  const readOnly = useRef(new Compartment())
  const [analysisError, setAnalysisError] = useState('')
  const activeFile = props.files.find((file) => file.path === props.active) ?? props.files[0]

  useEffect(() => {
    if (!host.current) return
    const client = new TypeScriptWorkerClient()
    clientRef.current = client
    let alive = true
    // One coalesced re-lint for the CURRENT buffer after the finite queue refused a diagnostics request.
    // It is admission control (nothing was sent, nothing failed), not a retry of timed-out or failed analysis.
    let relint: ReturnType<typeof setTimeout> | null = null
    const relintLater = () => {
      if (relint || !alive) return
      relint = setTimeout(() => { relint = null; if (alive && viewRef.current) requestLint(viewRef.current) }, 250)
    }
    /**
     * Capture source identity so stale async analysis never edits a newer buffer.
     * @param operation - Requested advisory feature.
     * @param position - Cursor offset.
     * @returns Current result or null when the buffer changed while computing.
     */
    const analyze = async (operation: IdeOperation, position: number) => {
      const before = propsRef.current
      const source = viewRef.current!.state.doc.toString()
      const files = before.files.map((file) => file.path === before.active ? { ...file, content: source } : file)
      try {
        const result = await client.request(operation, files, before.active, position, before.declarations)
        if (!alive || before.files !== propsRef.current.files || before.active !== propsRef.current.active
          || before.declarations !== propsRef.current.declarations || viewRef.current?.state.doc.toString() !== source) return null
        setAnalysisError('')
        return result
      } catch (error) {
        if (alive && error instanceof EditorAnalysisBusyError && operation === 'diagnostics') relintLater()
        if (alive) setAnalysisError(error instanceof Error ? error.message : 'Editor analysis unavailable')
        return null
      }
    }
    const definition = () => {
      const position = viewRef.current!.state.selection.main.head
      void analyze('definition', position).then((result) => {
        const target = result?.definitions?.[0]
        if (target) propsRef.current.onNavigate(target)
      })
      return true
    }
    const format = () => {
      if (propsRef.current.readOnly) return false
      void analyze('format', 0).then((result) => {
        const view = viewRef.current
        if (!view || !result?.edits?.length || propsRef.current.readOnly) return
        const edits = result.edits.slice().sort((a, b) => a.from - b.from)
        let end = 0
        if (edits.some((edit) => {
          const invalid = edit.from < end || edit.to < edit.from || edit.to > view.state.doc.length
          end = edit.to
          return invalid
        })) return
        view.dispatch({ changes: edits.map((edit) => ({ from: edit.from, to: edit.to, insert: edit.insert })), userEvent: 'input.format' })
      })
      return true
    }
    const view: EditorView = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: activeFile?.content ?? '',
        extensions: [
          lineNumbers(), history(), bracketMatching(), closeBrackets(), javascript({ typescript: true }),
          syntaxHighlighting(defaultHighlightStyle), lintGutter(),
          autocompletion({ override: [async (context) => {
            const result = await analyze('completion', context.pos)
            const items = result?.completions
            if (!items?.length) return null
            return { from: items[0].from, to: items[0].to, options: items.map((item) => ({ label: item.label, type: item.type, detail: item.detail })) }
          }] }),
          linter(async () => (await analyze('diagnostics', 0))?.diagnostics?.map((item) => ({
            from: Math.min(item.from, view.state.doc.length), to: Math.min(item.to, view.state.doc.length),
            severity: item.severity, message: item.message, source: 'TypeScript ' + item.code,
          })) ?? [], { delay: 500, needsRefresh: (update) => update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(relintRequested))) }),
          hoverTooltip(async (_view, position) => {
            const info = (await analyze('hover', position))?.hover
            if (!info) return null
            return { pos: info.from, end: info.to, create: () => {
              const dom = document.createElement('pre')
              dom.className = 'max-w-lg whitespace-pre-wrap p-2 text-sm'
              dom.textContent = info.text
              return { dom }
            } }
          }),
          keymap.of([{ key: 'F12', run: definition }, { key: 'Mod-Shift-f', run: format },
            ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap]),
          readOnly.current.of([EditorState.readOnly.of(props.readOnly), EditorView.editable.of(!props.readOnly)]),
          EditorView.contentAttributes.of({ 'aria-label': 'TypeScript source: ' + props.active, 'aria-describedby': helpId }),
          EditorView.theme({
            '&': { color: 'var(--color-foreground)', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '0.375rem' },
            '.cm-scroller': { fontFamily: 'var(--font-mono, monospace)', overflow: 'auto', maxHeight: '32rem' },
            '.cm-content': { minHeight: '22rem' }, '.cm-gutters': { backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)', borderRight: '1px solid var(--color-border)' },
            '.cm-tooltip': { backgroundColor: 'var(--color-popover)', color: 'var(--color-popover-foreground)', border: '1px solid var(--color-border)' },
            '.cm-cursor': { borderLeftColor: 'var(--color-foreground)' },
          }),
          EditorView.updateListener.of((update) => { if (update.docChanged) propsRef.current.onChange(update.state.doc.toString()) }),
        ],
      }),
    })
    viewRef.current = view
    const formatListener = () => { format() }
    const definitionListener = () => { definition() }
    host.current.addEventListener('qqq-format', formatListener)
    host.current.addEventListener('qqq-definition', definitionListener)
    const element = host.current
    return () => {
      alive = false
      if (relint) clearTimeout(relint)
      element.removeEventListener('qqq-format', formatListener)
      element.removeEventListener('qqq-definition', definitionListener)
      client.dispose()
      clientRef.current = null
      view.destroy()
      viewRef.current = null
    }
    // One editor view per active file; controlled updates use the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active])

  // What the last lint was based on besides the active buffer itself: other files and the SDK declarations.
  const lintBasis = useRef<{ others: string; declarations: string } | null>(null)
  useEffect(() => {
    const view = viewRef.current
    let external = false
    if (view && activeFile && view.state.doc.toString() !== activeFile.content) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: activeFile.content } })
      external = true
    }
    const others = props.files.filter((file) => file !== activeFile).map((file) => file.path + '\u0000' + file.content).join('\u0001')
    const first = lintBasis.current === null // lint once at mount so the cold worker starts while the user is still reading
    const basisChanged = !first && (lintBasis.current!.others !== others || lintBasis.current!.declarations !== props.declarations)
    lintBasis.current = { others, declarations: props.declarations }
    // The editor's own keystrokes are already debounced by the linter; forcing a lint for each one floods the finite queue.
    if (view && (first || external || basisChanged)) requestLint(view)
  }, [activeFile, props.files, props.declarations])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: readOnly.current.reconfigure([EditorState.readOnly.of(props.readOnly), EditorView.editable.of(!props.readOnly)]) })
  }, [props.readOnly])

  useEffect(() => {
    const view = viewRef.current
    const target = props.selection
    if (view && target?.file === props.active) {
      const from = Math.min(Math.max(0, target.from), view.state.doc.length)
      const to = Math.min(Math.max(from, target.to), view.state.doc.length)
      view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
      view.focus()
    }
  }, [props.selection, props.active])

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={BUTTON_CLASS} onClick={() => host.current?.dispatchEvent(new Event('qqq-definition'))}>Go to definition (F12)</button>
      <button type="button" className={BUTTON_CLASS} disabled={props.readOnly} onClick={() => host.current?.dispatchEvent(new Event('qqq-format'))}>Format source</button>
      <button type="button" className={BUTTON_CLASS} onClick={() => { clientRef.current?.dispose(); setAnalysisError('Editor analysis stopped. Switch files or reopen the editor to restart.') }}>Stop editor analysis</button>
    </div>
    <p id={helpId} className="text-xs text-muted-foreground">TypeScript 6.0.3 advisory diagnostics · Ctrl+Space completions · hover for types · F12 definition · Ctrl/Cmd+Shift+F format · Tab moves focus. Server build and test are required separately.</p>
    {analysisError && <p role="status" className="text-sm text-muted-foreground">{analysisError}</p>}
    <div ref={host} />
  </div>
}

