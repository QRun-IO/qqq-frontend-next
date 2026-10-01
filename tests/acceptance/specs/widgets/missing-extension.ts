/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** Whether Firefox's failed script is the gallery's deliberate HTTP 404. */
export function expectedMissingExtensionFailure(request: {
  url: string
  method: string
  resourceType: string
  status: number | undefined
  errorText: string
}): boolean {
  const url = new URL(request.url)
  return url.protocol === 'http:' && url.hostname === '127.0.0.1'
    && url.pathname === '/missing-extension.js' && !url.search
    && request.method === 'GET' && request.resourceType === 'script'
    && request.status === 404 && request.errorText === 'NS_ERROR_DOM_NETWORK_ERR'
}
