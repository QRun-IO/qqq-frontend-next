/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Widgets housing a process, and widget-level permissions.
import { expect, open, test } from '../../support/fixtures'
import { expectLoaded, sqlRows, widget, widgetBody } from './widget-support'

test('[WID-021] a process widget runs the interactive greeting inline and shows its result', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const payload = await (await backend.api.get('/widget/accProcess')).json()
  expect(payload.processMetaData.name).toBe('greetInteractive')
  const [person] = await sqlRows(backend, 'select first_name, last_name from person where id = 1')
  await open(page, '/app/widgetProcess?recordIds=1')
  await expectLoaded(page, 'accProcess')
  const card = widget(page, 'accProcess')
  await card.getByLabel('Greeting Prefix').fill('Widget')
  await card.getByLabel('Greeting Suffix').fill('checked')
  // The setup step is the last frontend step before the backend runs, so it submits (Material parity, #649 processes)
  await card.getByRole('button', { name: 'Submit' }).click()
  await expect(card).toContainText(`Widget ${person.first_name} checked`)
  await expect(widgetBody(page, 'accHealthy')).toHaveText('Healthy neighbor content')
})

test.describe('without process permission', () => {
  test.use({ persona: 'noProcesses' })

  test('[WID-061] a process widget is contained when the user may not run its process', async ({ page, backend, diagnostics }) => {
    // process metadata comes from the registered /metaData/process route, which refuses the denied process
    diagnostics.allow('/metaData/process/greetInteractive 403')
    diagnostics.allow('Failed to load resource: the server responded with a status of 403')
    expect((await backend.api.post('/qqq/v1/processes/greetInteractive/init', { multipart: { values: '{}' } })).status()).toBe(403)
    await open(page, '/app/widgetProcess?recordIds=1')
    await expectLoaded(page, 'accProcess')
    await expect(page.locator('[data-qqq-id="widget-empty-accProcess"]')).toHaveText('This process is not available.')
    await expect(widget(page, 'accProcess').getByLabel('Greeting Prefix')).toHaveCount(0)
    await expect(widgetBody(page, 'accHealthy')).toHaveText('Healthy neighbor content')
  })
})

test.describe('widget permission', () => {
  test('[WID-054] an administrator sees the restricted widget', async ({ page, diagnostics }) => {
    void diagnostics
    await open(page, '/app/widgetPermissions')
    await expectLoaded(page, 'accDenied')
    await expect(widgetBody(page, 'accDenied')).toContainText('Restricted widget content')
  })

  test.describe('denied', () => {
    test.use({ persona: 'noPets' })

    test('[WID-054] a denied widget is absent, not requested, and refused by the server without rendering', async ({ page, backend, diagnostics }) => {
      void diagnostics
      const renders = async () => Number(/renders=(\d+)/.exec((await (await backend.api.get('/widget/accDenied')).json()).html)![1])
      await backend.setPersona('admin')
      const before = await renders()
      await backend.setPersona('noPets')
      const meta = await (await backend.api.get('/metaData')).json()
      expect(Object.keys(meta.widgets)).not.toContain('accDenied')
      expect(Object.keys(meta.widgets)).toContain('accHealthy')
      expect((await backend.api.get('/widget/accDenied')).status()).toBe(403)
      expect((await backend.api.post('/widget/accDenied')).status()).toBe(403)
      const requested: string[] = []
      page.on('request', (request) => { if (request.url().includes('/widget/')) requested.push(new URL(request.url()).pathname) })
      await open(page, '/app/widgetPermissions')
      await expectLoaded(page, 'accHealthy')
      await expect(widget(page, 'accDenied')).toHaveCount(0)
      await expect(page.getByText('Restricted widget content')).toHaveCount(0)
      expect(requested).not.toContain('/widget/accDenied')
      // none of the denied attempts reached the renderer
      await backend.setPersona('admin')
      expect(await renders()).toBe(before + 1)
    })
  })
})
