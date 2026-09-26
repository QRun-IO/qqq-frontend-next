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
 * @file Create-child route — `/app/{table}/{id}/createChild/{childTable}`, the Material Dashboard
 * path that opens a create form for a child record over the parent record. It opens the record
 * view with the equivalent `#/createChild={childTable}` link, which shows that dialog.
 */

'use client'

import React from 'react'

import { useRouteParams } from '@/lib/hooks/use-route-params'
import { createChildLinkHref } from '@/lib/utils/material-links'
import { RouteRedirect } from '@/components/layout/RouteRedirect'

/**
 * Replaces the path form of a create-child link with the record view and its hash form.
 *
 * @returns A redirect status while the record view opens.
 */
export default function CreateChildPathPage() {
  const { slug, recordId, childTable } = useRouteParams<{ slug: string; recordId: string; childTable: string }>()
  return <RouteRedirect href={createChildLinkHref(slug, recordId, childTable)} label="the create form" />
}
