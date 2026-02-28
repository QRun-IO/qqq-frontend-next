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

'use client'

// RecordViewByUniqueKey — view a record by unique key
// Full implementation in Package 3

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQContext } from '@/lib/context/q-context'

export default function RecordViewByKeyPage() {
  const params = useParams<{ slug: string }>()
  const { setPageHeader } = useQContext()
  const slug = params.slug

  useEffect(() => {
    setPageHeader(`View ${slug} by Key`)
  }, [slug, setPageHeader])

  return (
    <div data-qqq-id={`record-view-key-${slug}`}>
      <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
        <p className="text-muted-foreground">Record view by key -- implemented in Package 3</p>
      </div>
    </div>
  )
}
