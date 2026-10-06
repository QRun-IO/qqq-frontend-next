/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect } from '../../support/fixtures'
import { sampleDashboardReady } from './sample-dashboard-readiness'

/** Wait for this fixed fixture's actual request and renderer outputs before leaving it. */
export async function waitForSampleDashboard(page: Page) {
  await expect.poll(() => page.evaluate(sampleDashboardReady), { message: 'Sample dashboard widgets and renderers complete before departure' }).toBe(true)
}
