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
 * @file MarkdownView — renders a markdown cell's text as React elements (never as HTML):
 * headings, paragraphs, bullet and numbered lists, fenced code, and inline bold, italic, code
 * and http(s) links. Anything else is shown as text, so a notebook can never inject markup.
 */

'use client'

import React from 'react'

/**
 * Renders inline markdown (bold, italic, code, links) as React nodes.
 *
 * @param text - One line or paragraph.
 * @param keyPrefix - Key prefix for the produced nodes.
 * @returns The nodes.
 */
export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g
  let last = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      const label = token.slice(1, token.indexOf(']'))
      nodes.push(
        <a
          key={key}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {label}
        </a>
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/**
 * Renders a markdown document.
 *
 * @param props - Component props.
 * @param props.source - The markdown text.
 * @returns The rendered blocks.
 */
export function MarkdownView({ source }: { source: string }) {
  const blocks: React.ReactNode[] = []
  const lines = source.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${i}`
    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
          {code.join('\n')}
        </pre>
      )
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-sm']
      const Tag = `h${Math.min(level + 1, 6)}` as 'h2'
      blocks.push(
        <Tag key={key} className={`${sizes[level - 1]} font-semibold`}>
          {renderInline(heading[2], key)}
        </Tag>
      )
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(
          <li key={`${key}-${items.length}`}>
            {renderInline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''), `${key}-${items.length}`)}
          </li>
        )
        i++
      }
      blocks.push(
        ordered ? (
          <ol key={key} className="list-decimal pl-5">
            {items}
          </ol>
        ) : (
          <ul key={key} className="list-disc pl-5">
            {items}
          </ul>
        )
      )
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|\s*([-*]|\d+\.)\s+)/.test(lines[i])
    )
      paragraph.push(lines[i++])
    blocks.push(<p key={key}>{renderInline(paragraph.join(' '), key)}</p>)
  }
  return <div className="space-y-2 text-sm">{blocks}</div>
}
