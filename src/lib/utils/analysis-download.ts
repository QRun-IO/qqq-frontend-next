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

/** @file Analysis file delivery and SVG rasterisation, without chart dependencies. */
import { deliverRecordFieldFile } from './record-download'

/** Delivers a generated file through the existing application download helper.
 * @param blob - File contents.
 * @param fileName - Suggested file name.
 */
export function downloadAnalysisFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  deliverRecordFieldFile({ url, fileName, mode: 'download' })
  // Keep the URL alive until the browser has accepted the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Serialises the displayed SVG, resolving theme styles before drawing on canvas.
 * @param svg - Rendered chart SVG.
 * @returns A PNG file.
 */
export async function chartPng(svg: SVGSVGElement): Promise<Blob> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const originals = [svg, ...svg.querySelectorAll('*')]
  const copies = [copy, ...copy.querySelectorAll('*')]
  originals.forEach((element, index) => {
    const style = getComputedStyle(element)
    for (const property of [
      'fill',
      'stroke',
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'opacity',
    ])
      copies[index].setAttribute(property, style.getPropertyValue(property))
  })
  const bounds = svg.getBoundingClientRect()
  const width = bounds.width || svg.viewBox.baseVal?.width || 800
  const height = bounds.height || svg.viewBox.baseVal?.height || 400
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
  )
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render the chart image.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * 2)
    canvas.height = Math.ceil(height * 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG export is unavailable in this browser.')
    context.scale(2, 2)
    context.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not export PNG.'))),
        'image/png'
      )
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
