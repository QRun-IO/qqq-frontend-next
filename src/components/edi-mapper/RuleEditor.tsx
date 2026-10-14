/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Local rule editing with transform arguments described by the registry. */
'use client'
import type { EdiRuleV1, EdiTransformV1 } from '@/types/edi'
import { control } from './GuideTree'

/** Parses a string-valued argument object without losing invalid existing text.
 * @param text - Stored argument JSON.
 * @returns An object, or null when the existing arguments need repair.
 */
function argumentsOf(text?: string | null): Record<string, string> | null {
  try {
    const value: unknown = JSON.parse(text || '{}')
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((v) => typeof v === 'string')
      ? (value as Record<string, string>)
      : null
  } catch {
    return null
  }
}

/** Edits all rule properties, including registry-defined string arguments.
 * @param props - Rule, transforms and local change handler.
 * @returns Labelled rule controls.
 */
export function RuleEditor({
  rule,
  transforms,
  onChange,
  id,
}: {
  rule: EdiRuleV1
  transforms: EdiTransformV1[]
  onChange: (rule: EdiRuleV1) => void
  id: string
}) {
  const transform = transforms.find((item) => item.name === rule.transform)
  const schema = transform?.argumentSchema
  const properties =
    schema?.properties && typeof schema.properties === 'object'
      ? Object.entries(schema.properties)
      : []
  const args = argumentsOf(rule.transformArgs)
  const required = Array.isArray(schema?.required) ? schema.required : []
  return (
    <div className="grid min-w-0 gap-3">
      {(['ediPath', 'qqqPath', 'sequence', 'condition', 'defaultValue'] as const).map((key) => (
        <label key={key} className="grid min-w-0 gap-1" htmlFor={`${id}-${key}`}>
          {
            {
              ediPath: 'EDI path',
              qqqPath: 'Target field',
              sequence: 'Sequence',
              condition: 'Condition',
              defaultValue: 'Default value',
            }[key]
          }
          <input
            id={`${id}-${key}`}
            data-qqq-id={`${id}-${key}`}
            className={control}
            type={key === 'sequence' ? 'number' : 'text'}
            value={rule[key] ?? ''}
            onChange={(event) =>
              onChange({
                ...rule,
                [key]:
                  key === 'sequence'
                    ? event.target.value === ''
                      ? null
                      : Number(event.target.value)
                    : event.target.value,
              })
            }
          />
        </label>
      ))}
      <label htmlFor={`${id}-required`}>
        <input
          id={`${id}-required`}
          data-qqq-id={`${id}-required`}
          type="checkbox"
          checked={rule.required ?? false}
          onChange={(event) => onChange({ ...rule, required: event.target.checked })}
        />{' '}
        Required
      </label>
      <label className="grid gap-1" htmlFor={`${id}-transform`}>
        Transform
        <select
          id={`${id}-transform`}
          data-qqq-id={`${id}-transform`}
          className={control}
          value={rule.transform ?? ''}
          onChange={(event) =>
            onChange({ ...rule, transform: event.target.value || null, transformArgs: '{}' })
          }
        >
          <option value="">No transform</option>
          {rule.transform && !transform && (
            <option value={rule.transform}>{rule.transform} (unavailable)</option>
          )}
          {transforms
            .filter((item) => item.name)
            .map((item) => (
              <option key={item.name} value={item.name!}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      {args &&
        properties.map(([name, property]) => {
          const description =
            property && typeof property === 'object' && 'description' in property
              ? String(property.description)
              : name
          const options: string[] | null =
            property &&
            typeof property === 'object' &&
            'enum' in property &&
            Array.isArray(property.enum)
              ? property.enum.map(String)
              : null
          const update = (value: string) =>
            onChange({ ...rule, transformArgs: JSON.stringify({ ...args, [name]: value }) })
          return (
            <label key={name} className="grid min-w-0 gap-1" htmlFor={`${id}-arg-${name}`}>
              {name}
              {required.includes(name) ? ' (required)' : ''}
              {options ? (
                <select
                  id={`${id}-arg-${name}`}
                  data-qqq-id={`${id}-arg-${name}`}
                  aria-required={required.includes(name)}
                  className={control}
                  value={args[name] ?? ''}
                  onChange={(event) => update(event.target.value)}
                >
                  <option value="">Choose {name}</option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${id}-arg-${name}`}
                  data-qqq-id={`${id}-arg-${name}`}
                  aria-required={required.includes(name)}
                  title={description}
                  className={control}
                  value={args[name] ?? ''}
                  onChange={(event) => update(event.target.value)}
                />
              )}
            </label>
          )
        })}
      {(!args || schema?.additionalProperties === true) && (
        <label className="grid gap-1" htmlFor={`${id}-args`}>
          Transform arguments (JSON object)
          <textarea
            id={`${id}-args`}
            data-qqq-id={`${id}-args`}
            className={control}
            value={rule.transformArgs ?? '{}'}
            onChange={(event) => onChange({ ...rule, transformArgs: event.target.value })}
          />
        </label>
      )}
    </div>
  )
}
