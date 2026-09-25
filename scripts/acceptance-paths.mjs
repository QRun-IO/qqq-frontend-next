/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { existsSync, readdirSync } from 'node:fs'
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

export const BUILD_MARKER = path.resolve('.next/acceptance-backend.txt')

/** Classpath folder holding a copy of out/ as next-dashboard/, ahead of the sample jar. */
export const EXPORT_CLASSPATH = path.resolve('test-results/acceptance/export-classpath')

export const ACCEPTANCE_MODE = process.env.QQQ_ACCEPTANCE_MODE === 'standalone' ? 'standalone' : 'javalin'
