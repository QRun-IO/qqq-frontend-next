/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Lightweight record action; the mapper itself is loaded only on its route. */
'use client'
import Link from 'next/link'
import { useEdiAvailable } from '@/lib/hooks/use-edi'
import { buttonClass } from '@/components/ui/controls'

/** Opens an already read, permitted EDI map.
 * @param props - Map identifier.
 * @returns A link only when the extension is registered.
 */
export function OpenMapperAction({ mapId }: { mapId: string | number }) {
  const available = useEdiAvailable()
  if (!available.data) return null
  return (
    <Link
      data-qqq-id="button-open-mapper"
      className={buttonClass()}
      href={`/app/edi_map/${encodeURIComponent(String(mapId))}/mapper`}
    >
      Open Mapper
    </Link>
  )
}
