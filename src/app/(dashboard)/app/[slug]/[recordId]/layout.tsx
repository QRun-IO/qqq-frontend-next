/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * @file Prerenders this dynamic segment once for the Javalin-served static export.
 * The server returns that page for every concrete value; see use-route-params.
 */

import type { ReactNode } from 'react'
import { EXPORT_PLACEHOLDER } from '@/lib/utils/export-placeholder'

/**
 * Static export placeholder params for this segment.
 *
 * @returns One placeholder entry.
 */
export function generateStaticParams() {
  return [{ recordId: EXPORT_PLACEHOLDER }]
}

/**
 * Pass-through layout that exists to carry generateStaticParams.
 *
 * @param props - Layout props.
 * @param props.children - Route content.
 * @returns The children unchanged.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return children
}
