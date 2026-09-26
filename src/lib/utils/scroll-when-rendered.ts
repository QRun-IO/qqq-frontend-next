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
 * @file Scrolls to an element once it is rendered. A record section anchor on a phone opens an
 * accordion item whose section content renders only after the link selected it (QRun-IO/qqq#708).
 */

/** Options for {@link scrollIntoViewWhenRendered}. */
export interface ScrollWhenRenderedOptions {
  /** Animation frames to wait for the element before giving up (default 120, about two seconds). */
  maxFrames?: number
  /** Vertical alignment passed to `scrollIntoView` (default `start`). */
  block?: ScrollLogicalPosition
}

/**
 * Scrolls the first element matching a selector into view as soon as it is in the document,
 * checking once per animation frame.
 *
 * @param selector - CSS selector of the element.
 * @param options - Frame budget and alignment.
 * @returns A function that stops waiting (for an effect cleanup).
 */
export function scrollIntoViewWhenRendered(selector: string, options: ScrollWhenRenderedOptions = {}): () => void {
  const { maxFrames = 120, block = 'start' } = options
  let remaining = maxFrames
  let frame = 0
  const attempt = () => {
    const target = document.querySelector(selector)
    if (target) {
      target.scrollIntoView({ block })
      return
    }
    remaining -= 1
    if (remaining > 0) frame = window.requestAnimationFrame(attempt)
  }
  frame = window.requestAnimationFrame(attempt)
  return () => window.cancelAnimationFrame(frame)
}
