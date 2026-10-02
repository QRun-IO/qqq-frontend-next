/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
export interface FontRequestOutcome { url: string; at: number; document: number; outcome: string }

/** Identifies a font abort only when request and document lifecycle evidence agree. */
export function interruptedLegacyFont({ text, at, origin, currentDocument, navigations, requests }: {
  text: string; at: number; origin: string; currentDocument: number; navigations: number[]; requests: FontRequestOutcome[]
}): string | null {
  const source = /^\[JavaScript Error: "downloadable font: download failed \(font-family: "QQQ Legacy Material Icons".*\): status=2152398850 source: (https?:\/\/[^"\s]+)"\]$/.exec(text)?.[1]
  if (!source) return null
  const url = new URL(source)
  if (url.origin !== origin || url.pathname !== '/fonts/material-icons/MaterialIcons-Regular.ttf') return null
  const oldDocumentRequest = requests.some((request) => request.url === source && ['NS_BINDING_ABORTED', 'HTTP 200'].includes(request.outcome)
    && request.document < currentDocument && Math.abs(request.at - at) < 1000)
  return oldDocumentRequest && navigations.some((navigation) => Math.abs(navigation - at) < 1000) ? source : null
}
