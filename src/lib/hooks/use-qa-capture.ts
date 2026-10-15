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

/**
 * @file Observes the QA capture capability that `QaCaptureLoader` (root providers) loads. This
 * hook never fetches by itself, so menus and the header can read it without knowing whether the
 * extension is installed or the user is signed in.
 */

import { useQuery } from '@tanstack/react-query'
import type { QaCaptureCapabilityV1 } from '@/types/qa-capture'
import { getQaCaptureCapability } from '@/lib/api/qa-capture'
import { queryKeys } from '@/lib/query-client'

/**
 * The capability, once the loader has fetched it.
 *
 * @returns The capability, or undefined (not loaded, not installed, or signed out).
 */
export function useQaCaptureCapability(): QaCaptureCapabilityV1 | undefined {
  const { data } = useQuery({ queryKey: queryKeys.qaCaptureCapability(), queryFn: getQaCaptureCapability, enabled: false })
  return data
}
