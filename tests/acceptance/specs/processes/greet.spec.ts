/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, recordRows, viewValue } from './process-helpers'

test('[PRC-001] selected records flow through edit, backend work and mixed results @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openProcess(page, 'greetInteractive', { recordIds: [1, 2] })
  const setup = await expectScreen(page, 'setup', 'Setup')
  await setup.getByLabel('Greeting Prefix').fill('Hello')
  await setup.getByLabel('Greeting Suffix').fill('!')
  await advance(page, 'Submit')

  const results = await expectScreen(page, 'results', 'Results')
  await expect(viewValue(results, 'noOfPeopleGreeted')).toHaveText('2')
  await expect(viewValue(results, 'outputMessage')).toHaveText('Hello X !')
  await expect.poll(() => recordRows(results)).toEqual([
    ['1', 'Avery', 'Hello Avery !'],
    ['2', 'Blair', 'Hello Blair !'],
  ])
})
