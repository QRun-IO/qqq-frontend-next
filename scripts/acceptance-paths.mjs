/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

/** Sample JAR from QQQ_SAMPLE_JAR, else the newest jar-with-dependencies in a sibling qqq checkout. */
export function resolveSampleJar() {
  const explicit = process.env.QQQ_SAMPLE_JAR
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`QQQ_SAMPLE_JAR does not exist: ${explicit}`)
    return path.resolve(explicit)
  }
  const target = path.resolve('../qqq/qqq-sample-project/target')
  const jars = existsSync(target) ? readdirSync(target).filter((name) => name.endsWith('-jar-with-dependencies.jar')) : []
  if (jars.length !== 1) {
    throw new Error('Set QQQ_SAMPLE_JAR to the qqq-sample-project jar-with-dependencies (see tests/acceptance/README.md).')
  }
  return path.join(target, jars[0])
}

/** Java dependencies shared by the main and authentication-variant fixtures. */
export function resolveFixtureClasspath(jar = resolveSampleJar()) {
  const sampleVersion = path.basename(jar).match(/^qqq-sample-project-(.+)-jar-with-dependencies\.jar$/)?.[1]
  if (!sampleVersion) throw new Error(`Cannot determine QQQ version from sample JAR: ${jar}`)
  const apiJar = process.env.QQQ_MIDDLEWARE_API_JAR ?? path.join(homedir(), '.m2', 'repository', 'com', 'kingsrook', 'qqq',
    'qqq-middleware-api', sampleVersion, `qqq-middleware-api-${sampleVersion}.jar`)
  if (!existsSync(apiJar)) throw new Error(`QQQ middleware API JAR does not exist: ${apiJar}`)
  return [jar, apiJar].join(path.delimiter)
}

export const BUILD_MARKER = path.resolve('.next/acceptance-backend.txt')

/** Classpath folder holding a copy of out/ as next-dashboard/, ahead of the sample jar. */
export const EXPORT_CLASSPATH = path.resolve('test-results/acceptance/export-classpath')

export const ACCEPTANCE_MODE = process.env.QQQ_ACCEPTANCE_MODE === 'standalone' ? 'standalone' : 'javalin'

/** Separate backend, browser and provider origins for authentication variants. */
export const SECURITY_BACKEND_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_BACKEND_PORT ?? Number(process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? 18765) + 10)
export const SECURITY_FRONTEND_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_FRONTEND_PORT ?? Number(process.env.QQQ_ACCEPTANCE_FRONTEND_PORT ?? 13765) + 20)
export const SECURITY_IDP_PORT = Number(process.env.QQQ_ACCEPTANCE_SECURITY_IDP_PORT ?? Number(process.env.QQQ_ACCEPTANCE_FRONTEND_PORT ?? 13765) + 10)
export const SECURITY_BACKEND_URL = `http://127.0.0.1:${SECURITY_BACKEND_PORT}`
export const SECURITY_UI_URL = ACCEPTANCE_MODE === 'standalone' ? `http://127.0.0.1:${SECURITY_FRONTEND_PORT}` : SECURITY_BACKEND_URL
export const SECURITY_STANDALONE = path.resolve('test-results/acceptance/security-standalone')
