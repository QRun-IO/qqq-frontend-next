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
 * @file The SQL editor's CodeMirror theme. Every color is a CSS custom property of the app theme
 * (surfaces, borders, the focus ring) or of the code palette (`--qqq-code-*`, the colors the
 * read-only code blocks use, 4.5:1 or more on the card and muted surfaces in both modes). The
 * properties change with the `.dark` class, so the editor follows the theme toggle live,
 * without being reconfigured.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

/** Selection and bracket-match fill: the primary color, translucent over the editor surface. */
const SELECTION = 'color-mix(in srgb, var(--color-primary) 28%, transparent)'

/** Editor chrome: surface, gutter, cursor, selection, active line, placeholder and the autocomplete popup. */
export const workbenchEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--color-foreground)',
    backgroundColor: 'var(--color-background)',
    fontSize: '13px',
    border: '1px solid var(--color-input)',
    borderRadius: '0.375rem',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--color-primary)',
    boxShadow: '0 0 0 1px var(--color-ring)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    caretColor: 'var(--color-foreground)',
    minHeight: '5rem',
    padding: '0.5rem 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-foreground)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: SELECTION },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-muted) 70%, transparent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-muted)',
    color: 'var(--color-muted-foreground)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    borderTopLeftRadius: '0.375rem',
    borderBottomLeftRadius: '0.375rem',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-foreground)' },
  '.cm-placeholder': { color: 'var(--color-muted-foreground)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: SELECTION,
    outline: '1px solid var(--color-ring)',
  },
  '.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--color-destructive) 25%, transparent)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-popover)',
    color: 'var(--color-popover-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    boxShadow: 'var(--qqq-shadow-md)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    maxHeight: '16rem',
    padding: '0.25rem 0',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '0.25rem 0.75rem 0.25rem 0.5rem',
    lineHeight: '1.4',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-foreground)',
  },
  '.cm-completionDetail': {
    color: 'inherit',
    opacity: '0.8',
    fontStyle: 'normal',
    marginLeft: '0.75rem',
  },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '700' },
  '.cm-completionIcon': { opacity: '0.8', width: '1.25em' },
  '.cm-tooltip .cm-completionInfo': {
    backgroundColor: 'var(--color-popover)',
    color: 'var(--color-popover-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
  },
})

/** SQL token colors from the shared code palette. */
const workbenchHighlightStyle = HighlightStyle.define([
  {
    tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword],
    color: 'var(--qqq-code-keyword)',
    fontWeight: '600',
  },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--qqq-code-string)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--qqq-code-number)' },
  { tag: [t.bool, t.null, t.atom], color: 'var(--qqq-code-literal)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: 'var(--qqq-code-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [t.typeName, t.standard(t.name), t.function(t.variableName)],
    color: 'var(--qqq-code-property)',
  },
  {
    tag: [t.special(t.name), t.special(t.variableName), t.labelName],
    color: 'var(--qqq-code-variable)',
  },
  { tag: [t.propertyName, t.attributeName], color: 'var(--qqq-code-attribute)' },
  { tag: [t.invalid], color: 'var(--color-destructive)' },
])

/** The token colors as an editor extension. */
export const workbenchSyntaxHighlighting = syntaxHighlighting(workbenchHighlightStyle)
