/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, it, vi } from 'vitest'
import { readChartLabelBoxes, type ChartLabelBox } from './chart-label-geometry'

const labels = ['January', 'February', 'March', 'April', 'May']
const complete = labels.map((_, index) => ({ left: 80 + index * 60, right: 122 + index * 60, width: 42, height: 13 }))
const zero = { left: 0, right: 0, width: 0, height: 0 }

function ticks(boxes: ChartLabelBox[], texts = labels) {
  return boxes.map((box, index) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    node.textContent = texts[index]
    // Explicit fields also represent invalid measurements without relying on DOMRect normalization.
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ ...box, x: box.left, y: 0, top: 0, bottom: box.height, toJSON: () => box })
    return node
  })
}

it('keeps all expected text with zero geometry unready', () => {
  const nodes = ticks(labels.map(() => zero))
  expect(nodes.map(node => node.textContent)).toEqual(labels)
  expect(readChartLabelBoxes(nodes, labels)).toBeNull()
})

it('keeps the retained one-real/four-zero geometry pattern unready', () => {
  const nodes = ticks([{ left: 80.140625, right: 121.859375, width: 41.71875, height: 12.515625 }, zero, zero, zero, zero])
  expect(nodes.map(node => node.textContent)).toEqual(labels)
  expect(readChartLabelBoxes(nodes, labels)).toBeNull()
})

it('does not treat empty expected labels and no nodes as ready', () => {
  expect(readChartLabelBoxes([], [])).toBeNull()
})

it('requires the complete expected label count', () => {
  expect(readChartLabelBoxes(ticks(complete.slice(0, -1)), labels)).toBeNull()
})

it('requires expected text in the original order in the same geometry sample', () => {
  expect(readChartLabelBoxes(ticks(complete, [...labels].reverse()), labels)).toBeNull()
})

it.each(['left', 'right', 'width', 'height'] as const)('rejects a non-finite %s', (field) => {
  expect(readChartLabelBoxes(ticks([{ ...complete[0], [field]: Number.NaN }, ...complete.slice(1)]), labels)).toBeNull()
})

it.each(['width', 'height'] as const)('rejects zero %s even when the other dimensions are positive', (field) => {
  expect(readChartLabelBoxes(ticks([{ ...complete[0], [field]: 0 }, ...complete.slice(1)]), labels)).toBeNull()
})

it('returns the complete measured sample for the original strict overlap check', () => {
  const nodes = ticks(complete)
  const boxes = readChartLabelBoxes(nodes, labels)!
  expect(boxes).toEqual(complete)
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].right)
  for (const node of nodes) expect(node.getBoundingClientRect).toHaveBeenCalledTimes(1)
})

it('returns complete overlapping geometry immediately so the original assertion fails', () => {
  const overlap = [{ ...complete[0], right: complete[1].left + 1, width: 61 }, ...complete.slice(1)]
  const nodes = ticks(overlap)
  const boxes = readChartLabelBoxes(nodes, labels)!
  expect(boxes).toEqual(overlap)
  expect(() => {
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].right)
  }).toThrow()
  for (const node of nodes) expect(node.getBoundingClientRect).toHaveBeenCalledTimes(1)
})
