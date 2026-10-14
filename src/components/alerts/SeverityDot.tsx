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
 * @file SeverityDot — a small colored dot for an alert's severity, with its name for screen
 * readers.
 */

import React from 'react'

import type { AlertSeverity } from '@/types/alerts'

// mid-tone colors that read on light and dark cards; inline so the dot adds no CSS
const COLORS: Record<AlertSeverity, string> = {
  CRITICAL: '#dc2626',
  ERROR: '#ef4444',
  WARNING: '#d97706',
  INFO: '#2563eb',
}

const LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Critical',
  ERROR: 'Error',
  WARNING: 'Warning',
  INFO: 'Info',
}

/**
 * The dot.
 *
 * @param props - The severity.
 * @returns A dot with a screen-reader label.
 */
export function SeverityDot({ severity }: { severity: AlertSeverity }) {
  return (
    <span className="flex shrink-0 items-center" style={{ marginTop: '0.375rem' }} data-qqq-id={`alerts-severity-${severity}`}>
      <span className="rounded-full" style={{ width: '0.625rem', height: '0.625rem', backgroundColor: COLORS[severity] ?? COLORS.INFO }} aria-hidden="true" />
      <span className="sr-only">{LABELS[severity] ?? severity}</span>
    </span>
  )
}
