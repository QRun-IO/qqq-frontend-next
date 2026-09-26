/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, open, test } from '../../support/fixtures'
import { v1MetaData, waitForShell } from './nav-helpers'

/** Version of an installed package, read from its package.json. */
function installedVersion(name: string): string {
  return JSON.parse(readFileSync(path.resolve('node_modules', name, 'package.json'), 'utf8')).version
}

/** The React build Next.js bundles for the App Router (the one the page actually runs). */
function bundledReactVersion(): string {
  const source = readFileSync(path.resolve('node_modules/next/dist/compiled/react/cjs/react.production.js'), 'utf8')
  return /exports\.version = "([^"]+)"/.exec(source)![1]
}

test.describe('developer page', () => {
  test('[NAV-027] shows the backend metadata counts and the running framework versions @mobile', async ({ page, backend, diagnostics }) => {
    const meta = await v1MetaData(backend)
    const full = await (await backend.api.get('/metaData')).json()

    await open(page, '/app/developer')
    await waitForShell(page)
    await expect(page).toHaveTitle('Developer | QQQ Sample')
    const stats = page.locator('[data-qqq-id="developer-section-metadata"]')
    const value = (key: string) => stats.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${key}$`) }) }).locator('dd')
    await expect(value('apps')).toHaveText(String(Object.keys(meta.apps).length))
    await expect(value('tables')).toHaveText(String(Object.keys(meta.tables).length))
    await expect(value('processes')).toHaveText(String(Object.keys(meta.processes).length))
    await expect(value('widgets')).toHaveText(String(Object.keys(full.widgets).length))

    const build = page.locator('[data-qqq-id="developer-section-build"]')
    const buildValue = (key: string) => build.locator('dl > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${key}$`) }) }).locator('dd')
    await expect(buildValue('framework')).toHaveText(`Next.js ${installedVersion('next')}`)
    await expect(buildValue('react')).toHaveText(bundledReactVersion())
  })
})
