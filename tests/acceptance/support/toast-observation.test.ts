/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { afterEach, describe, expect, it } from 'vitest'
import { visibleToastObservation } from './toast-observation'

function element(html: string, top: number, height: number) {
  const parent = document.createElement('div')
  parent.innerHTML = html
  const node = parent.firstElementChild as HTMLElement
  node.getBoundingClientRect = () => ({ x: 0, y: top, top, bottom: top + height, left: 0, right: 100, width: 100, height, toJSON: () => ({}) })
  document.body.append(node)
  return node
}

afterEach(() => { document.body.innerHTML = '' })

describe('browser-side toast observation', () => {
  it('requires the exact visible message', () => {
    expect(visibleToastObservation({ message: 'Saved', belowHeader: false })).toBeNull()
    const toast = element('<li data-sonner-toast>Not saved</li>', 140, 50)
    expect(visibleToastObservation({ message: 'Saved', belowHeader: false })).toBeNull()
    toast.textContent = 'Saved'
    toast.style.visibility = 'hidden'
    expect(visibleToastObservation({ message: 'Saved', belowHeader: false })).toBeNull()
    toast.style.visibility = 'visible'
    expect(visibleToastObservation({ message: 'Saved', belowHeader: false })).toEqual(['Saved'])
  })

  it('waits for a toast to sit below the header and returns duplicate messages for the count assertion', () => {
    element('<header data-qqq-id="header"></header>', 0, 117)
    const toast = element('<li data-sonner-toast>Created</li>', 20, 50)
    expect(visibleToastObservation({ message: 'Created', belowHeader: true })).toBeNull()
    toast.getBoundingClientRect = () => ({ x: 0, y: 140, top: 140, bottom: 190, left: 0, right: 100, width: 100, height: 50, toJSON: () => ({}) })
    element('<li data-sonner-toast>Something went wrong</li>', 200, 50)
    expect(visibleToastObservation({ message: 'Created', belowHeader: true })).toEqual(['Created', 'Something went wrong'])
  })
})
