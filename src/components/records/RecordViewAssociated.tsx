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

/** @file RecordViewAssociated — unbound named groups in the Related area. */

'use client'

import type { ReactNode } from 'react'
import type { QAssociation } from '@/types'

/**
 * Keep each declared group distinct even when targets and joins are shared.
 * @param props - Unbound association descriptors and the shared panel renderer.
 * @returns One separate card for each exact association name.
 */
export function RecordViewAssociated({ associations, renderAssociation }: {
  associations: QAssociation[]
  renderAssociation: (name: string, label?: string) => ReactNode
}) {
  return <>{associations.map((association) => (
    <div key={association.name} className="rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
      {renderAssociation(association.name)}
    </div>
  ))}</>
}
