// Tests for cn (class name utility)

import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should resolve conflicts
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('handles conditional object syntax', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})
