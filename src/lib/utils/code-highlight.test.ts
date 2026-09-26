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

import { describe, expect, it } from 'vitest'

import { MAX_HIGHLIGHT_LENGTH, formatJson, formatSql, languageFor, tokenize, type CodeLanguage, type CodeTokenType } from './code-highlight'

/**
 * The non-plain tokens of some code, as `type:text` pairs.
 * @param code - Source.
 * @param language - Language.
 * @returns The colored tokens.
 */
function colored(code: string, language: CodeLanguage): string[] {
  return tokenize(code, language).filter((token) => token.type !== 'plain').map((token) => `${token.type}:${token.text}`)
}

describe('languageFor', () => {
  it('maps Ace modes, CODE_EDITOR language modes and script file types', () => {
    const cases: [string | undefined, CodeLanguage][] = [
      ['javascript', 'javascript'], ['JS', 'javascript'], ['groovy', 'java'], ['java', 'java'], ['python', 'python'],
      ['json', 'json'], ['SQL', 'sql'], ['velocity', 'velocity'], ['html', 'html'], ['xml', 'html'],
      ['text', 'text'], ['markdown', 'text'], [undefined, 'text'], ['', 'text'],
    ]
    for (const [mode, language] of cases) expect(languageFor(mode)).toBe(language)
  })
})

describe('tokenize', () => {
  const samples: [CodeLanguage, string][] = [
    ['javascript', "// greet\nconst name = input.name ?? 'World';\nreturn `Hello ${name}` + 42; /* done */"],
    ['java', 'public int count = 3; // three'],
    ['python', "def greet(name):\n    return f'Hi {name}'  # hi\nNone"],
    ['json', '{"enabled": true, "limit": 3, "name": "x", "list": [null, -1.5e3]}'],
    ['sql', "SELECT id, name FROM person WHERE name = 'O''Brien' -- people\nAND id > 10"],
    ['velocity', '## heading\n#if($user.isAdmin())<b class="x">$!{user.name}</b>#end'],
    ['html', '<!-- c --><div id="main">Hi & bye</div>'],
    ['text', 'plain words'],
  ]

  it('never changes the text: the tokens join back into the input', () => {
    for (const [language, code] of samples) {
      expect(tokenize(code, language).map((token) => token.text).join('')).toBe(code)
    }
  })

  it('colors JavaScript keywords, strings, numbers, literals and comments', () => {
    expect(colored("// greet\nconst ok = true; return 'x' + 42 /* c */", 'javascript')).toEqual([
      'comment:// greet', 'keyword:const', 'literal:true', 'keyword:return', "string:'x'", 'number:42', 'comment:/* c */',
    ])
  })

  it('colors JSON keys apart from string values', () => {
    expect(colored('{"a": "b", "n": 1, "z": null}', 'json')).toEqual([
      'property:"a"', 'string:"b"', 'property:"n"', 'number:1', 'property:"z"', 'literal:null',
    ])
  })

  it('colors SQL keywords in any case, strings and comments', () => {
    expect(colored("select id From t where x = 'a' -- note", 'sql')).toEqual([
      'keyword:select', 'keyword:From', 'keyword:where', "string:'a'", 'comment:-- note',
    ])
  })

  it('colors Velocity directives and references inside markup', () => {
    const types = new Set<CodeTokenType>(tokenize('#foreach($row in $rows)<td>${row.name}</td>#end', 'velocity').map((token) => token.type))
    expect(types).toEqual(new Set(['directive', 'variable', 'tag', 'plain']))
    expect(colored('#foreach($row in $rows)', 'velocity')).toEqual(['directive:#foreach', 'variable:$row', 'variable:$rows'])
  })

  it('colors HTML tags, attributes and attribute values', () => {
    expect(colored('<a href="/x">go</a>', 'html')).toEqual(['tag:<a', 'attribute:href', 'string:"/x"', 'tag:>', 'tag:</a', 'tag:>'])
  })

  it('leaves text, empty input and very long code uncolored', () => {
    expect(tokenize('', 'javascript')).toEqual([])
    expect(tokenize('const x = 1', 'text')).toEqual([{ type: 'plain', text: 'const x = 1' }])
    const long = 'const x = 1;\n'.repeat(Math.ceil(MAX_HIGHLIGHT_LENGTH / 13) + 1)
    expect(tokenize(long, 'javascript')).toEqual([{ type: 'plain', text: long }])
  })
})

describe('formatJson', () => {
  it('pretty-prints with two spaces and throws on invalid JSON', () => {
    expect(formatJson('{"enabled":true,"limit":3}')).toBe('{\n  "enabled": true,\n  "limit": 3\n}')
    expect(() => formatJson('{not json')).toThrow()
  })
})

describe('formatSql', () => {
  it('puts each clause, select column and condition on its own line (Material layout)', () => {
    expect(formatSql('SELECT id, first_name, last_name FROM person WHERE id > 1 AND last_name = \'Sample\' ORDER BY id')).toBe(
      'SELECT\n   id,\n   first_name,\n   last_name\nFROM\n   person\nWHERE\n   id > 1\n   AND last_name = \'Sample\'\nORDER BY\n   id'
    )
  })

  it('keeps SELECT DISTINCT together and leaves non-query SQL words unchanged', () => {
    expect(formatSql('select distinct name from pet')).toBe('select distinct\n   name\nfrom\n   pet')
    expect(formatSql('UPDATE person SET x = 1')).toBe('UPDATE person SET x = 1')
  })
})
