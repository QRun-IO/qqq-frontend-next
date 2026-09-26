/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { afterEach, describe, expect, it } from 'vitest'

import { MAIN_CONTENT_ID, scrollPageToTop } from './scroll-to-top'

afterEach(() => {
  document.getElementById(MAIN_CONTENT_ID)?.remove()
  Reflect.deleteProperty(document, 'scrollingElement')
})

describe('dashboard scrolling', () => {
  it('resets both the independently scrolling content and the document', () => {
    const main = document.createElement('main')
    main.id = MAIN_CONTENT_ID
    main.scrollTop = 320
    document.body.appendChild(main)
    document.documentElement.scrollTop = 400
    Object.defineProperty(document, 'scrollingElement', { configurable: true, value: document.documentElement })
    scrollPageToTop()
    expect(main.scrollTop).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
  })

  it('remains safe when a route has no dashboard content region', () => {
    Object.defineProperty(document, 'scrollingElement', { configurable: true, value: null })
    expect(() => scrollPageToTop()).not.toThrow()
  })
})
