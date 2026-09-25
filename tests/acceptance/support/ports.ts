/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** Fixed loopback ports; the production build bakes the backend origin into its rewrites. */
export const ACCEPTANCE_BACKEND_PORT = Number(process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? 18765)
export const ACCEPTANCE_FRONTEND_PORT = Number(process.env.QQQ_ACCEPTANCE_FRONTEND_PORT ?? 13765)
export const ACCEPTANCE_BACKEND_URL = `http://127.0.0.1:${ACCEPTANCE_BACKEND_PORT}`

/**
 * `javalin` (default): the export served by the QQQ server itself, as a fresh application gets it.
 * `standalone`: the Node standalone build with same-origin rewrites, as in the container image.
 */
export const ACCEPTANCE_MODE = process.env.QQQ_ACCEPTANCE_MODE === 'standalone' ? 'standalone' : 'javalin'
export const ACCEPTANCE_UI_URL = ACCEPTANCE_MODE === 'javalin' ? ACCEPTANCE_BACKEND_URL : `http://127.0.0.1:${ACCEPTANCE_FRONTEND_PORT}`
