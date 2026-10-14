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
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Check, Copy } from 'lucide-react'

import { internalAppHref } from '@/lib/utils/assistant-links'

/** Keep GitHub's table/align, del and disabled checkbox rules; strip model styles and ids. */
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
    <pre tabIndex={0} data-qqq-id="markdown-code" className="my-2 overflow-x-auto rounded-md bg-muted p-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</pre>
  ),
  table: ({ children }) => (
    <div tabIndex={0} data-qqq-id="markdown-table" role="region" aria-label="Table" className="my-2 overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  // react-markdown converts sanitized GFM align attributes to textAlign before these run.
  th: ({ style, children }) => <th scope="col" style={{ textAlign: style?.textAlign ?? 'left' }}>{children}</th>,
  td: ({ style, children }) => <td style={{ textAlign: style?.textAlign ?? 'left' }}>{children}</td>,
}

/** Comment-only links; arbitrary markdown never turns into executable links. */
const COMMENT_COMPONENTS: Components = {
  ...COMPONENTS,
  a: ({ href, children }) => {
    if (href?.startsWith('user:')) return <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary" data-qqq-id="mention-chip">{children}</span>
    const match = href?.match(/^record:([^/]+)\/(.+)$/)
    const internal = internalAppHref(match ? `/app/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}` : href)
    return internal ? <Link href={internal} className="text-primary underline" data-qqq-id="comment-record-link">{children}</Link> : <span>{children}</span>
  },
}
const COMMENT_SCHEMA = { ...SCHEMA, protocols: { ...SCHEMA.protocols, href: [...(SCHEMA.protocols?.href ?? []), 'user', 'record'] } }

/** Typography for the rendered markdown (the app has no typography plugin). */
const PROSE = [
  'min-w-0 break-words text-sm leading-relaxed text-foreground',
  '[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
  '[&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_thead]:bg-muted [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:tabular-nums',
].join(' ')

/**
 * Renders assistant markdown.
 *
 * @param props - Component properties.
 * @param props.text - Markdown from the model or comment.
 * @param props.mentions - Enables non-navigating mention chips and validated record links for comments.
 * @returns The rendered markdown.
 */
export function AssistantMarkdown({ text, mentions = false }: { text: string; mentions?: boolean }) {
  return (
    <div className={PROSE} data-qqq-id="assistant-markdown">
<<<<<<< HEAD
      <ReactMarkdown skipHtml rehypePlugins={[[rehypeSanitize, mentions ? COMMENT_SCHEMA : SCHEMA]]} components={mentions ? COMMENT_COMPONENTS : COMPONENTS} urlTransform={(url) => mentions && /^(user|record):/.test(url) ? url : defaultUrlTransform(url)}>
||||||| 14ec5cc
      <ReactMarkdown skipHtml rehypePlugins={[[rehypeSanitize, SCHEMA]]} components={COMPONENTS}>
=======
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[[rehypeSanitize, SCHEMA]]} components={COMPONENTS}>
>>>>>>> origin/main
        {text}
      </ReactMarkdown>
    </div>
  )
}
