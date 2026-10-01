/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** Reads notification visibility and placement together inside the browser. */
export function visibleToastObservation({ message, belowHeader }: { message: string; belowHeader: boolean }): string[] | null {
  const notifications = [...document.querySelectorAll<HTMLElement>('[data-sonner-toast]')]
  const toast = notifications.find((node) => node.textContent?.trim() === message)
  if (!toast) return null
  const bounds = toast.getBoundingClientRect()
  const style = getComputedStyle(toast)
  if (!bounds.width || !bounds.height || style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return null
  if (belowHeader) {
    const header = document.querySelector('[data-qqq-id="header"]')
    if (!header || bounds.top < header.getBoundingClientRect().bottom) return null
  }
  return notifications.map((node) => node.textContent?.trim() ?? '')
}
