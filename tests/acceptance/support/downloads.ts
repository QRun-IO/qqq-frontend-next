/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'

/**
 * Linux WebKit's pinned libsoup 3.6.6 replaces filename spaces with underscores.
 * Assert the application's original name separately; only the browser suggestion changes.
 * https://github.com/GNOME/libsoup/commit/9e1570c914fa6638913cec4e9dbd8aff11b8dab4
 */
export function expectedDownloadFilename(filename: string, browserName: string): string {
  return process.platform === 'linux' && browserName === 'webkit' ? filename.replace(/ /g, '_') : filename
}

/** Reads the application's transient download attribute without changing the click. */
export function nextDownloadAttribute(page: Page): Promise<string> {
  return page.evaluate(() => new Promise<string>((resolve) => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[download]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      document.removeEventListener('click', onClick, true)
      resolve(target.download)
    }
    document.addEventListener('click', onClick, true)
  }))
}
