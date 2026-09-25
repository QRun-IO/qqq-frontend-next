/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { describe, expect, it } from 'vitest'
import { resolveRouteParams } from './use-route-params'

describe('resolveRouteParams', () => {
  it('keeps concrete params from the router', () => {
    expect(resolveRouteParams({ slug: 'person', recordId: '1' }, '/app/person/1')).toEqual({ slug: 'person', recordId: '1' })
  })

  it('reads export placeholders from the browser path', () => {
    expect(resolveRouteParams({ slug: '_', recordId: '_' }, '/app/pet/42/edit')).toEqual({ slug: 'pet', recordId: '42' })
    expect(resolveRouteParams({ slug: '_', viewId: '_' }, '/app/person/savedView/7')).toEqual({ slug: 'person', viewId: '7' })
  })

  it('decodes encoded segments and leaves unknown paths alone', () => {
    expect(resolveRouteParams({ slug: '_', recordId: '_' }, '/app/person/a%20b')).toEqual({ slug: 'person', recordId: 'a b' })
    expect(resolveRouteParams({ slug: '_' }, '/login')).toEqual({ slug: '_' })
  })
})
