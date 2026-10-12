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
 * @file AssistantMarkdown — renders model-written markdown safely: raw HTML is dropped, the
 * tree is sanitized, images never load, and only same-origin `/app` links are links (others
 * are plain text with a copy button), so model text cannot exfiltrate data or inject markup.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Check, Copy } from 'lucide-react'

import { internalAppHref } from '@/lib/utils/assistant-links'

/** The default (GitHub) sanitize schema without inline styles, classes or ids from the model. */
const SCHEMA = {
  ...defaultSchema,
  clobberPrefix: 'assistant-md-',
  attributes: {
    ...defaultSchema.attributes,
    '*': (defaultSchema.attributes?.['*'] ?? []).filter((attribute) => !['className', 'id', 'style'].includes(String(attribute))),
  },
}

/**
 * Copies text to the clipboard and confirms it.
 *
 * @param props - Component properties.
 * @param props.text - The text to copy.
 * @returns The button.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }).catch(() => undefined)
      }}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded align-middle text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-8 pointer-coarse:w-8"
      aria-label={copied ? 'Copied' : `Copy link ${text}`}
      data-qqq-id="assistant-copy-link"
    >
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
    </button>
  )
}

/** Element overrides: safe links, blocked images, focusable scrolling code blocks. */
const COMPONENTS: Components = {
  a: ({ href, children }) => {
    const internal = internalAppHref(href)
    if (internal) {
      return <Link href={internal} className="font-medium text-primary underline underline-offset-2 hover:text-primary/80" data-qqq-id="assistant-link">{children}</Link>
    }
    const text = typeof href === 'string' ? href : ''
    const childText = React.Children.toArray(children).join('')
    return (
      <span data-qqq-id="assistant-external-link">
        {children}
        {text && childText !== text && <span className="break-all text-muted-foreground"> ({text})</span>}
        {text && <CopyButton text={text} />}
      </span>
    )
  },
  img: ({ alt }) => <span className="text-muted-foreground">[image{alt ? `: ${alt}` : ''} not shown]</span>,
  pre: ({ children }) => (
    <pre tabIndex={0} className="my-2 overflow-x-auto rounded-md bg-muted p-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</pre>
  ),
  table: ({ children }) => (
    <div tabIndex={0} role="region" aria-label="Table" className="my-2 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
}

/** Typography for the rendered markdown (the app has no typography plugin). */
const PROSE = [
  'min-w-0 break-words text-sm leading-relaxed text-foreground',
  '[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
  '[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
].join(' ')

/**
 * Renders assistant markdown.
 *
 * @param props - Component properties.
 * @param props.text - Markdown from the model.
 * @returns The rendered markdown.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className={PROSE} data-qqq-id="assistant-markdown">
      <ReactMarkdown skipHtml rehypePlugins={[[rehypeSanitize, SCHEMA]]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
