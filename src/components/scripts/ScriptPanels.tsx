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
 * @file Script panels shared by the script viewer and the script editor: the docs panel (help
 * text and example code), the test runner, and the shared control styles.
 */

'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import { testScript } from '@/lib/api/developer'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { CodeBlock } from './HighlightedCode'
import { dateTimeText, domId, text } from './script-utils'

export const BUTTON_CLASS = cn(
  'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground',
  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
export const PRIMARY_BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
  'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
export const INPUT_CLASS =
  'w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'
export const ALERT_CLASS =
  'whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'

/** Tester input and output fields of a script type. */
export interface ScriptTestFields {
  /** Input fields of the tester. */
  inputFields: QFieldMetaData[]
  /** Output fields of the tester. */
  outputFields: QFieldMetaData[]
}

/**
 * The script type's documentation: help text and syntax-colored example code.
 *
 * @param props - Component props.
 * @param props.idKey - Viewer id suffix.
 * @param props.scriptType - The script type record.
 * @returns The docs panel.
 */
export function ScriptDocs({ idKey, scriptType }: { idKey: string; scriptType?: QRecord }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <h4 className="mb-2 text-base font-semibold text-foreground">Documentation</h4>
        <pre
          className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground"
          data-qqq-id={`script-docs-help-${idKey}`}
        >
          {text(scriptType?.values.helpText)}
        </pre>
      </div>
      <div className="min-w-0">
        <h4 className="mb-2 text-base font-semibold text-foreground">Example Code</h4>
        <CodeBlock
          code={text(scriptType?.values.sampleCode)}
          language="javascript"
          className="max-h-96"
          dataQqqId={`script-docs-example-${idKey}`}
        />
      </div>
    </div>
  )
}

/**
 * Display text of a test output value: the backend value, with date-times in the dashboards' format.
 * @param field - Output field metadata.
 * @param value - Output value.
 * @returns The display text.
 */
function outputText(field: QFieldMetaData, value: unknown): string {
  return field.type === 'DATE_TIME' ? dateTimeText(value) : text(value)
}

/**
 * The script test form and its output.
 *
 * @param props - Component props.
 * @param props.idKey - Viewer id suffix.
 * @param props.scriptId - Script under test.
 * @param props.files - Code to test, by file name (the selected version, or the editor's unsaved code).
 * @param props.inputFields - Tester input fields.
 * @param props.outputFields - Tester output fields.
 * @param props.apiName - API the code runs against.
 * @param props.apiVersion - API version the code runs against.
 * @returns The test form.
 */
export function ScriptTest({ idKey, scriptId, files, inputFields, outputFields, apiName, apiVersion }: {
  idKey: string
  scriptId: string | number
  files: Record<string, string>
  inputFields: QFieldMetaData[]
  outputFields: QFieldMetaData[]
  apiName?: string
  apiVersion?: string
}) {
  const [inputValues, setInputValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputFields.map((field) => [field.name, text(field.defaultValue)])))
  const run = useMutation({
    mutationFn: () => testScript({ scriptId, files, inputValues, apiName, apiVersion }),
    meta: HANDLES_OWN_ERRORS,
  })
  const result = run.data
  const outputs = result?.outputObject ?? {}
  const outputValues = outputs.values && typeof outputs.values === 'object' && !Array.isArray(outputs.values)
    ? outputs.values as Record<string, unknown>
    : outputs
  const errorMessage = run.error ? getErrorMessage(run.error) : result?.exceptionMessage

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        className="min-w-0 space-y-3 rounded-md border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          run.mutate()
        }}
      >
        <h4 className="text-base font-semibold text-foreground">Test Input</h4>
        {inputFields.map((field) => {
          const id = `script-test-${domId(idKey)}-${domId(field.name)}`
          const common = {
            id,
            value: inputValues[field.name] ?? '',
            className: INPUT_CLASS,
            'aria-required': Boolean(field.isRequired),
          }
          return (
            <div key={field.name} className="space-y-1">
              <label htmlFor={id} className="block text-sm font-medium text-foreground">{field.label || field.name}</label>
              {field.type === 'TEXT' ? (
                <textarea {...common} rows={3} onChange={(event) => setInputValues((values) => ({ ...values, [field.name]: event.target.value }))} />
              ) : (
                <input {...common} type="text" onChange={(event) => setInputValues((values) => ({ ...values, [field.name]: event.target.value }))} />
              )}
            </div>
          )
        })}
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={run.isPending} data-qqq-id={`button-test-script-${idKey}`}>
            {run.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit
          </button>
        </div>
      </form>

      <div className="min-w-0 space-y-3 rounded-md border border-border p-4">
        <h4 className="text-base font-semibold text-foreground">Test Output</h4>
        <div className="space-y-1" aria-live="polite" data-qqq-id={`script-test-output-${idKey}`}>
          {run.isPending && <p className="text-sm text-muted-foreground" role="status" aria-busy="true">Running…</p>}
          {errorMessage && (
            <p role="alert" className={ALERT_CLASS} data-qqq-id={`script-test-error-${idKey}`}>{errorMessage}</p>
          )}
          {outputFields.map((field) => (
            <p key={field.name} className="text-sm text-foreground" data-qqq-id={`script-test-output-${idKey}-${field.name}`}>
              <span className="pr-1 font-semibold">{field.label || field.name}:</span>
              {' '}
              <span>{outputText(field, outputValues[field.name])}</span>
            </p>
          ))}
        </div>
        {result && result.logLines.length > 0 && (
          <div>
            <h4 className="mb-2 text-base font-semibold text-foreground">Test Log Lines</h4>
            {/* the table scrolls inside the output card when the card is narrow (tablets with the sidebar) */}
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm" data-qqq-id={`script-test-log-lines-${idKey}`}>
                <thead className="bg-muted text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium text-foreground">Timestamp</th>
                    <th scope="col" className="px-3 py-2 font-medium text-foreground">Log Line</th>
                  </tr>
                </thead>
                <tbody>
                  {result.logLines.map((line, index) => (
                    <tr key={index} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-foreground">{dateTimeText(line.timestamp)}</td>
                      <td className="whitespace-pre-wrap px-3 py-2 text-foreground">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
