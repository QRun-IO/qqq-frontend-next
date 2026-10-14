/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Session-scoped EDI extension discovery. */
import { useQuery } from '@tanstack/react-query'
import { getUiApiVersion } from '@/lib/api/ui-api-version'
import { queryKeys } from '@/lib/query-client'

/** Checks presence before making any EDI requests.
 * @returns Extension availability query.
 */
export function useEdiAvailable() {
  return useQuery({
    queryKey: queryKeys.ediAvailable(),
    queryFn: async () =>
      (await getUiApiVersion()).extensions.some((extension) => extension.name === 'edi'),
    staleTime: Infinity,
  })
}
