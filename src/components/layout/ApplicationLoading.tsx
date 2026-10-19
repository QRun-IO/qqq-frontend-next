/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Neutral application startup screen. */

/**
 * Shows progress until authentication and application metadata are ready.
 * @returns A neutral, accessible loading screen.
 */
export function ApplicationLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600" data-qqq-id="application-loading">
      <div role="status" aria-label="Loading" aria-live="polite" className="flex flex-col items-center gap-4 p-6">
        <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-600 motion-safe:animate-spin" />
        <p className="text-sm">Loading your workspace…</p>
      </div>
    </div>
  )
}
