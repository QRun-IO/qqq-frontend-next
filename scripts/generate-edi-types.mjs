/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Vendor the qbit YAML as lossless JSON, like the other extension documents, then run
// node scripts/generate-edi-types.mjs. No runtime schema or generator dependency ships.
import { readFileSync, writeFileSync } from 'node:fs'

const document = JSON.parse(readFileSync(new URL('../src/lib/api/openapi/extensions/edi.json', import.meta.url), 'utf8'))
const header = readFileSync(new URL('../src/lib/api/tables.ts', import.meta.url), 'utf8').split('/**')[0]
function typeOf(schema) {
  let type = schema.$ref ? schema.$ref.split('/').at(-1)
    : schema.enum ? schema.enum.map(JSON.stringify).join(' | ')
    : schema.type === 'array' ? `Array<${typeOf(schema.items)}>`
    : schema.type === 'object' ? schema.properties
      ? `{\n${Object.entries(schema.properties).map(([name, value]) => `  ${name}${schema.required?.includes(name) ? '' : '?'}: ${typeOf(value)}`).join('\n')}\n}`
      : `Record<string, ${typeof schema.additionalProperties === 'object' ? typeOf(schema.additionalProperties) : 'unknown'}>`
    : ['integer', 'number'].includes(schema.type) ? 'number'
    : ['string', 'boolean'].includes(schema.type) ? schema.type : 'unknown'
  return type + (schema.nullable && type !== 'unknown' ? ' | null' : '')
}
writeFileSync(new URL('../src/types/edi.ts', import.meta.url), header + '/** @file Generated from the vendored edi.json. Run scripts/generate-edi-types.mjs; do not edit. */\n\n' + Object.entries(document.components.schemas).map(([name, schema]) => `/** ${schema.description ?? name} */\nexport type ${name} = ${typeOf(schema)}\n`).join('\n'))
