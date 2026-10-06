/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

export interface ChartLabelBox {
  left: number
  right: number
  width: number
  height: number
}

/** Returns one complete rendered sample; overlap remains the caller's strict assertion. */
export function readChartLabelBoxes(nodes: Element[], expectedLabels: string[]): ChartLabelBox[] | null {
  if (expectedLabels.length === 0 || nodes.length !== expectedLabels.length) return null
  const boxes: ChartLabelBox[] = []
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.textContent?.replace(/\s+/g, ' ').trim() !== expectedLabels[index].replace(/\s+/g, ' ').trim()) return null
    const { left, right, width, height } = node.getBoundingClientRect()
    if (![left, right, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
    boxes.push({ left, right, width, height })
  }
  return boxes
}
