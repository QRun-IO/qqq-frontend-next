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

/** @file Help beside record and table action menu items. */
'use client'

import React from 'react'

import type { QProcessMetaData } from '@/types'

import { TABLE_ACTION_MENU_HELP_ROLES } from '@/lib/utils/help-utils'

import { HelpIcon } from './HelpIcon'

/**
 * Displays process help without invoking the adjacent action.
 * @param props - Process and whether its menu uses Radix roving focus.
 * @returns The shared help icon.
 */
export function ProcessActionHelp({
  process,
  menuItem,
}: {
  process: QProcessMetaData
  menuItem?: boolean
}) {
  return (
    <HelpIcon
      label={process.label}
      helpContents={process.helpContents?.help}
      roles={TABLE_ACTION_MENU_HELP_ROLES}
      helpKey={`process:${process.name};slot:help`}
      data-qqq-id={`action-help-${process.name}`}
      menuItem={menuItem}
    />
  )
}
