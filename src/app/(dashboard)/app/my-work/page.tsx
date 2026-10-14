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

/** @file Static My work route, loaded like the notifications page. */
'use client'
import dynamic from 'next/dynamic'
const MyWork = dynamic(() => import('@/components/collaboration/MyWork').then((m) => m.MyWork), {
  ssr: false,
})
/** Renders personal work.
 * @returns Lazy page.
 */
export default function MyWorkRoute() {
  return <MyWork />
}
