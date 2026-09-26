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
 * @file Dependency-free syntax highlighting and formatting for the code the dashboard shows
 * and edits: CODE_EDITOR fields, script files, data bag JSON and script type docs.
 *
 * Material renders these with the Ace editor. Next keeps a native textarea (or a `<pre>`)
 * and colors a token overlay instead, so no editor library is loaded. The tokenizers are
 * deliberately small: they color keywords, strings, numbers, comments and markup, which
 * is what a reader needs, and they never change the text.
 */

/** Languages the highlighter knows. Anything else is shown as plain text. */
export type CodeLanguage = 'javascript' | 'java' | 'python' | 'json' | 'sql' | 'velocity' | 'html' | 'text'

/** Kinds of token the highlighter colors (`qqq-code-<type>` CSS classes). */
export type CodeTokenType =
  | 'keyword'
  | 'literal'
  | 'string'
  | 'number'
  | 'comment'
  | 'property'
  | 'tag'
  | 'attribute'
  | 'variable'
  | 'directive'
  | 'plain'

/** One run of text of a single token type. */
export interface CodeToken {
  /** The token kind. */
  type: CodeTokenType
  /** The exact source text of the token. */
  text: string
}

/** Code longer than this is shown uncolored, so a huge value never slows typing down. */
export const MAX_HIGHLIGHT_LENGTH = 100_000

/** Display names of the languages, for the editor badge. */
export const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  javascript: 'JavaScript',
  java: 'Java',
  python: 'Python',
  json: 'JSON',
  sql: 'SQL',
  velocity: 'Velocity',
  html: 'HTML',
  text: 'Text',
}

/**
 * Maps an Ace mode name, a CODE_EDITOR `languageMode` or a script file type to a language.
 *
 * @param mode - Mode or file type such as `javascript`, `json`, `sql`, `velocity`, `groovy`.
 * @returns The language, `text` when unknown or empty.
 */
export function languageFor(mode: string | null | undefined): CodeLanguage {
  const normalized = (mode ?? '').trim().toLowerCase()
  switch (normalized) {
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      return 'javascript'
    case 'java':
    case 'groovy':
    case 'kotlin':
      return 'java'
    case 'python':
    case 'py':
      return 'python'
    case 'json':
      return 'json'
    case 'sql':
    case 'mysql':
      return 'sql'
    case 'velocity':
    case 'vm':
      return 'velocity'
    case 'html':
    case 'xml':
    case 'svg':
      return 'html'
    default:
      return 'text'
  }
}

/** One tokenizer rule: a sticky regular expression and the token type (or a classifier). */
interface Rule {
  pattern: RegExp
  type: CodeTokenType | ((text: string) => CodeTokenType)
}

/**
 * Builds a classifier that tells keywords and literals from other words.
 * @param keywords - Keywords of the language.
 * @param literals - Literal words (`true`, `null`, ...).
 * @param caseInsensitive - Whether the language ignores case (SQL).
 * @returns The classifier.
 */
function words(keywords: string[], literals: string[], caseInsensitive = false): (text: string) => CodeTokenType {
  const keywordSet = new Set(caseInsensitive ? keywords.map((word) => word.toLowerCase()) : keywords)
  const literalSet = new Set(caseInsensitive ? literals.map((word) => word.toLowerCase()) : literals)
  return (text) => {
    const key = caseInsensitive ? text.toLowerCase() : text
    if (keywordSet.has(key)) return 'keyword'
    if (literalSet.has(key)) return 'literal'
    return 'plain'
  }
}

const JS_KEYWORDS = [
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
  'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]
const JAVA_KEYWORDS = [
  ...JS_KEYWORDS, 'abstract', 'boolean', 'byte', 'char', 'def', 'double', 'enum', 'final', 'float', 'implements', 'int',
  'interface', 'long', 'package', 'private', 'protected', 'public', 'short', 'synchronized', 'throws', 'transient', 'volatile',
]
const PYTHON_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield',
]
const SQL_KEYWORDS = [
  'add', 'all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'create', 'delete', 'desc', 'distinct', 'drop', 'else',
  'end', 'exists', 'from', 'full', 'group', 'having', 'in', 'index', 'inner', 'insert', 'into', 'is', 'join', 'left', 'like',
  'limit', 'not', 'offset', 'on', 'or', 'order', 'outer', 'right', 'select', 'set', 'table', 'then', 'union', 'update',
  'values', 'when', 'where', 'with',
]

const NUMBER = /(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\b/y
const DOUBLE_QUOTED = /"(?:[^"\\\n]|\\.)*"?/y
const SINGLE_QUOTED = /'(?:[^'\\\n]|\\.)*'?/y
const BACKTICK = /`(?:[^`\\]|\\[\s\S])*`?/y
const BLOCK_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/y
const LINE_COMMENT = /\/\/[^\n]*/y
const IDENTIFIER = /[A-Za-z_$][\w$]*/y

const C_LIKE = (keywords: string[]): Rule[] => [
  { pattern: BLOCK_COMMENT, type: 'comment' },
  { pattern: LINE_COMMENT, type: 'comment' },
  { pattern: DOUBLE_QUOTED, type: 'string' },
  { pattern: SINGLE_QUOTED, type: 'string' },
  { pattern: BACKTICK, type: 'string' },
  { pattern: NUMBER, type: 'number' },
  { pattern: IDENTIFIER, type: words(keywords, ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']) },
]

const HTML_RULES: Rule[] = [
  { pattern: /<!--[\s\S]*?(?:-->|$)/y, type: 'comment' },
  { pattern: /<\/?[A-Za-z][\w:.-]*/y, type: 'tag' },
  { pattern: /\/?>/y, type: 'tag' },
  { pattern: /[A-Za-z_:][\w:.-]*(?==)/y, type: 'attribute' },
  { pattern: DOUBLE_QUOTED, type: 'string' },
  { pattern: SINGLE_QUOTED, type: 'string' },
]

const RULES: Record<Exclude<CodeLanguage, 'text'>, Rule[]> = {
  javascript: C_LIKE(JS_KEYWORDS),
  java: C_LIKE(JAVA_KEYWORDS),
  python: [
    { pattern: /#[^\n]*/y, type: 'comment' },
    { pattern: /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)/y, type: 'string' },
    { pattern: DOUBLE_QUOTED, type: 'string' },
    { pattern: SINGLE_QUOTED, type: 'string' },
    { pattern: NUMBER, type: 'number' },
    { pattern: /[A-Za-z_]\w*/y, type: words(PYTHON_KEYWORDS, ['True', 'False', 'None']) },
  ],
  json: [
    { pattern: /"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, type: 'property' },
    { pattern: DOUBLE_QUOTED, type: 'string' },
    { pattern: NUMBER, type: 'number' },
    { pattern: /[A-Za-z_]\w*/y, type: words([], ['true', 'false', 'null']) },
  ],
  sql: [
    { pattern: /--[^\n]*/y, type: 'comment' },
    { pattern: BLOCK_COMMENT, type: 'comment' },
    { pattern: SINGLE_QUOTED, type: 'string' },
    { pattern: DOUBLE_QUOTED, type: 'property' },
    { pattern: /`[^`\n]*`?/y, type: 'property' },
    { pattern: NUMBER, type: 'number' },
    { pattern: /[A-Za-z_]\w*/y, type: words(SQL_KEYWORDS, ['null', 'true', 'false'], true) },
  ],
  velocity: [
    { pattern: /##[^\n]*/y, type: 'comment' },
    { pattern: /#\*[\s\S]*?(?:\*#|$)/y, type: 'comment' },
    { pattern: /#\{?(?:if|elseif|else|end|foreach|set|macro|parse|include|evaluate|define|break|stop)\b\}?/y, type: 'directive' },
    { pattern: /\$!?\{[^}\n]*\}?|\$!?[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*(?:\([^)\n]*\))?)*/y, type: 'variable' },
    ...HTML_RULES,
  ],
  html: HTML_RULES,
}

/**
 * Splits code into colored tokens. Concatenating the tokens' text always gives back the input.
 *
 * @param code - Source text.
 * @param language - Language to color it as.
 * @returns The tokens (one `plain` token for text, unknown languages, or code over {@link MAX_HIGHLIGHT_LENGTH}).
 */
export function tokenize(code: string, language: CodeLanguage): CodeToken[] {
  if (!code) return []
  if (language === 'text' || code.length > MAX_HIGHLIGHT_LENGTH) return [{ type: 'plain', text: code }]
  const rules = RULES[language]
  const tokens: CodeToken[] = []
  let plain = ''
  let position = 0
  const flushPlain = () => {
    if (plain) tokens.push({ type: 'plain', text: plain })
    plain = ''
  }
  while (position < code.length) {
    let matched = false
    for (const rule of rules) {
      rule.pattern.lastIndex = position
      const match = rule.pattern.exec(code)
      if (!match || match[0].length === 0) continue
      const text = match[0]
      const type = typeof rule.type === 'function' ? rule.type(text) : rule.type
      if (type === 'plain') {
        plain += text
      } else {
        flushPlain()
        tokens.push({ type, text })
      }
      position += text.length
      matched = true
      break
    }
    if (!matched) {
      plain += code[position]
      position += 1
    }
  }
  flushPlain()
  return tokens
}

/**
 * Pretty-prints JSON with two-space indentation.
 * @param code - JSON text.
 * @returns The formatted text.
 * @throws SyntaxError when the text is not valid JSON.
 */
export function formatJson(code: string): string {
  return JSON.stringify(JSON.parse(code), null, 2)
}

/**
 * Lays SQL out one clause per line, as Material's code viewer does: the select list one column
 * per line, a line break before each main clause and each AND / OR.
 *
 * @param code - SQL text.
 * @returns The formatted text (the words themselves are never changed).
 */
export function formatSql(code: string): string {
  let formatted = code
  if (/(^|\s)SELECT\s[\s\S]*\sFROM\s/i.test(formatted)) {
    const fromMatch = /\sFROM\s/i.exec(formatted)
    if (fromMatch) {
      const beforeFrom = formatted.slice(0, fromMatch.index).replace(/,\s*/g, ',\n   ')
      formatted = `${beforeFrom}${formatted.slice(fromMatch.index)}`
    }
  }
  formatted = formatted.replace(/\s*\b(SELECT DISTINCT|SELECT|FROM|WHERE|ORDER BY|GROUP BY|HAVING|INNER JOIN|LEFT JOIN|RIGHT JOIN)\b\s*/gi, '\n$1\n   ')
  formatted = formatted.replace(/\s*\b(AND|OR)\b\s*/gi, '\n   $1 ')
  return formatted.replace(/^\s+/, '')
}
