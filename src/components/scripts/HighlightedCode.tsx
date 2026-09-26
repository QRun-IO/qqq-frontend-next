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
 * @file HighlightedCode and CodeBlock — syntax-colored, read-only code (Material shows these
 * in a read-only Ace editor): script files, CODE_EDITOR values, data bag JSON, script docs.
 */

'use client'

import React, { useMemo } from 'react'

import { tokenize, type CodeLanguage } from '@/lib/utils/code-highlight'
import { cn } from '@/lib/utils/cn'

/** Props for {@link HighlightedCode}. */
export interface HighlightedCodeProps {
  /** The source text. */
  code: string
  /** Language to color it as. */
  language: CodeLanguage
}

/**
 * The colored tokens of a piece of code, as inline spans (the text is unchanged).
 *
 * @param props - {@link HighlightedCodeProps}
 * @returns The token spans.
 */
export function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const tokens = useMemo(() => tokenize(code, language), [code, language])
  return (
    <>
      {tokens.map((token, index) => (
        <React.Fragment key={index}>
          {token.type === 'plain' ? token.text : <span className={`qqq-code-${token.type}`}>{token.text}</span>}
        </React.Fragment>
      ))}
    </>
  )
}

/** Props for {@link CodeBlock}. */
export interface CodeBlockProps extends HighlightedCodeProps {
  /** `data-qqq-id` of the block. */
  dataQqqId?: string
  /** Extra classes for the `<pre>` (sizes, borders). */
  className?: string
  /** Wraps long lines instead of scrolling sideways. */
  wrap?: boolean
}

/**
 * A scrollable, syntax-colored `<pre><code>` block.
 *
 * @param props - {@link CodeBlockProps}
 * @returns The code block.
 */
export function CodeBlock({ code, language, dataQqqId, className, wrap = false }: CodeBlockProps) {
  return (
    <pre
      className={cn('overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground', className)}
      data-qqq-id={dataQqqId}
      data-language={language}
    >
      <code className={wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}>
        <HighlightedCode code={code} language={language} />
      </code>
    </pre>
  )
}
