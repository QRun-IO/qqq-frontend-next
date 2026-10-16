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
 * @file widget-context — the metadata of the widget whose body is rendering.
 */
'use client'

import { createContext, useContext } from 'react'

import type { QWidgetMetaData } from '@/types'

/**
 * The metadata of the widget whose body is rendering (provided by `WidgetBlock`), for content
 * that reads the widget's help slots: block slots fall back to their help content as a
 * tooltip, as Material's `BlockElementWrapper` does.
 */
export const WidgetMetaDataContext = createContext<QWidgetMetaData | null>(null)

/** Heading levels a widget title can render at. */
export type WidgetHeadingLevel = 2 | 3

/**
 * The heading level of the title of the next widget chrome. An app home provides 2 (widget titles sit
 * directly under the page's h1); a widget's own body resets it to 3, so a nested widget (a parent
 * widget's tab, a record-view widget) stays one level below its container. Defaults to 3.
 */
export const WidgetHeadingLevelContext = createContext<WidgetHeadingLevel>(3)

/**
 * Reads the heading level the next widget title renders at.
 *
 * @returns 2 on an app home, else 3.
 */
export function useWidgetHeadingLevel(): WidgetHeadingLevel {
  return useContext(WidgetHeadingLevelContext)
}
