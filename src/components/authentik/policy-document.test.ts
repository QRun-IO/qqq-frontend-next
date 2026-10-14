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

// Tests for the policy document model: the same canonical form and fail-closed rules as the qbit

import { describe, expect, it } from 'vitest'

import { generatePolicy, parsePolicy, roundTrips, splitPermission } from './policy-document'

const FORMAT = { spec: 'qqq-iam', version: '1.0.0' }

describe('generatePolicy', () => {
  it('writes the canonical form the qbit writes (byte for byte)', () => {
    const doc = generatePolicy(['cms_page.edit', 'contentApp.hasAccess', 'cms_page.read', 'cms_media.read', 'bad', 'x.bad-action'], FORMAT)
    expect(doc.compact).toBe('{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":['
      + '{"Effect":"Allow","Action":["hasAccess"],"Resource":["contentApp"]},'
      + '{"Effect":"Allow","Action":["read"],"Resource":["cms_media","cms_page"]},'
      + '{"Effect":"Allow","Action":["edit"],"Resource":["cms_page"]}]}')
    expect(doc.pretty).toBe([
      '{',
      '  "PolicySpec": "qqq-iam",',
      '  "PolicyVersion": "1.0.0",',
      '  "Statement": [',
      '    {',
      '      "Effect": "Allow",',
      '      "Action": ["hasAccess"],',
      '      "Resource": [',
      '        "contentApp"',
      '      ]',
      '    },',
      '    {',
      '      "Effect": "Allow",',
      '      "Action": ["read"],',
      '      "Resource": [',
      '        "cms_media",',
      '        "cms_page"',
      '      ]',
      '    },',
      '    {',
      '      "Effect": "Allow",',
      '      "Action": ["edit"],',
      '      "Resource": [',
      '        "cms_page"',
      '      ]',
      '    }',
      '  ]',
      '}',
      '',
    ].join('\n'))
    expect(doc.statementCount).toBe(3)
  })

  it('writes an empty document', () => {
    const doc = generatePolicy([], FORMAT)
    expect(doc.compact).toBe('{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[]}')
    expect(doc.pretty).toBe('{\n  "PolicySpec": "qqq-iam",\n  "PolicyVersion": "1.0.0",\n  "Statement": []\n}\n')
  })

  it('orders named features after standard actions and preserves unknown names', () => {
    const permissions = new Set(['person.write', 'person.comment', 'person.analyze', 'person.read', 'other.analyze', 'person.retiredFeature'])
    const doc = generatePolicy(permissions, FORMAT)
    expect(JSON.parse(doc.compact).Statement).toEqual([
      { Effect: 'Allow', Action: ['read'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['analyze'], Resource: ['other', 'person'] },
      { Effect: 'Allow', Action: ['comment'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['retiredFeature'], Resource: ['person'] },
      { Effect: 'Allow', Action: ['write'], Resource: ['person'] },
    ])
    expect(roundTrips(permissions, FORMAT)).toBe(true)
  })

  it('sorts resources like Java (UTF-16 code units: upper case first)', () => {
    expect(generatePolicy(['b.read', 'B.read', 'a_1.read', 'a.read'], FORMAT).compact).toContain('["B","a","a_1","b"]')
  })

  it('round-trips random sets', () => {
    const resources = ['a', 'B_2', 'cms_page', 'contentApp', 'x9']
    const actions = ['hasAccess', 'read', 'insert', 'edit', 'delete', 'analyze', 'comment', 'write', 'Export_2']
    let seed = 7
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 3
    for (let run = 0; run < 200; run++) {
      const set = new Set<string>()
      resources.forEach((r) => actions.forEach((a) => next() === 0 && set.add(`${r}.${a}`)))
      expect(roundTrips(set, FORMAT)).toBe(true)
      const parsed = parsePolicy(generatePolicy(set, FORMAT).pretty, FORMAT)
      expect(parsed.ok && [...parsed.permissions].sort()).toEqual([...set].sort())
    }
  })
})

describe('parsePolicy', () => {
  it('grants resource.action, with * as all five', () => {
    const parsed = parsePolicy({ PolicySpec: 'qqq-iam', PolicyVersion: '1.0.0', Statement: [{ Effect: 'Allow', Action: ['*'], Resource: ['p'] }, { Effect: 'Allow', Action: ['read'], Resource: ['q', 'p'] }] }, FORMAT)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect([...parsed.permissions].sort()).toEqual(['p.delete', 'p.edit', 'p.hasAccess', 'p.insert', 'p.read', 'q.read'])
      expect(parsed.resources).toEqual(['p', 'q'])
    }
  })

  it('accepts a missing Statement', () => {
    expect(parsePolicy('{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0"}', FORMAT)).toMatchObject({ ok: true })
  })

  it.each([
    ['', 'empty'],
    ['nope', 'not a JSON object'],
    ['[]', 'not a JSON object'],
    ['{"PolicySpec":"x","PolicyVersion":"1.0.0"}', 'PolicySpec must be'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"2.0.0"}', 'PolicyVersion must be'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":{}}', 'Statement must be an array'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[1]}', 'must be an object'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Deny","Action":["read"],"Resource":["a"]}]}', 'Deny is not supported'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":"read","Resource":["a"]}]}', 'Action must be an array'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["bad-action"],"Resource":["a"]}]}', 'invalid action "bad-action"'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["read"],"Resource":[2]}]}', 'Resource must be an array'],
    ['{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[{"Effect":"Allow","Action":["read"],"Resource":["a.b"]}]}', 'must match'],
  ])('fails closed on %s', (text, message) => {
    const parsed = parsePolicy(text, FORMAT)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain(message)
  })

  it('rejects non-objects', () => {
    expect(parsePolicy(null, FORMAT).ok).toBe(false)
    expect(parsePolicy(42, FORMAT).ok).toBe(false)
  })
})

describe('splitPermission', () => {
  it('splits valid policy permissions only', () => {
    expect(splitPermission('cms_page.read')).toEqual({ resource: 'cms_page', action: 'read' })
    expect(splitPermission('a.write')).toEqual({ resource: 'a', action: 'write' })
    expect(splitPermission('a.2bad')).toBeNull()
    expect(splitPermission('a.bad-action')).toBeNull()
    expect(splitPermission('.read')).toBeNull()
    expect(splitPermission('a.')).toBeNull()
    expect(splitPermission('authentik.users.read')).toBeNull()
  })
})
