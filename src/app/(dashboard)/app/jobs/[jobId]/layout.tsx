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

/** @file Static export placeholder for job detail routes. */
import type { ReactNode } from 'react'
import { EXPORT_PLACEHOLDER } from '@/lib/utils/export-placeholder'

/** Generates the export placeholder.
 * @returns One job path.
 */
export function generateStaticParams() { return [{ jobId: EXPORT_PLACEHOLDER }] }

/** Pass-through layout.
 * @param props - Children.
 * @returns Children unchanged.
 */
export default function Layout({ children }: { children: ReactNode }) { return children }
