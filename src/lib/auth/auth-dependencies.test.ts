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

import { describe, expect, it } from 'vitest'
import packageJson from '../../../package.json'

// The sign-in flows are implemented once, in src/lib/auth (oidc.ts: PKCE, discovery,
// the Auth0 code exchange). Unused browser auth SDKs and cookie/crypto helpers were
// removed in the QRun-IO/qqq#696 review: they looked like a second auth stack to
// reviewers and scanners without being part of the product.
describe('auth dependencies (QRun-IO/qqq#696)', () => {
  it.each(['@auth0/auth0-react', '@auth0/auth0-spa-js', 'oidc-client-ts', 'universal-cookie', 'ts-md5'])('does not depend on %s', (name) => {
    const dependencies: Record<string, string> = { ...packageJson.dependencies, ...packageJson.devDependencies }
    expect(Object.keys(dependencies)).not.toContain(name)
  })
})
