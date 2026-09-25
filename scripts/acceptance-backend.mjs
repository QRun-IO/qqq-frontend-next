/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Compiles the owned acceptance fixture against the sample JAR and runs it on loopback.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { ACCEPTANCE_MODE, EXPORT_CLASSPATH, resolveSampleJar } from './acceptance-paths.mjs'

const port = process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? '18765'
const jar = resolveSampleJar()
const classes = path.resolve('test-results/acceptance/fixture-classes')
rmSync(classes, { recursive: true, force: true })
mkdirSync(classes, { recursive: true })
const fixtureDirectory = path.resolve('tests/acceptance/fixture')
const sources = readdirSync(fixtureDirectory).filter((name) => name.endsWith('.java')).map((name) => path.join(fixtureDirectory, name))
const javac = spawnSync('javac', ['-proc:none', '-encoding', 'UTF-8', '-cp', jar, '-d', classes, ...sources], { stdio: 'inherit' })
if (javac.status !== 0) {
  console.error('Acceptance fixture compilation failed.')
  process.exit(1)
}
if (!existsSync(path.join(classes, 'AcceptanceSampleServer.class'))) process.exit(1)

const server = spawn('java', [
  '-Dqqq.sample.mockAuthentication=true',
  `-Dqqq.sample.port=${port}`,
  '-Duser.timezone=UTC',
  // javalin mode: the fresh export shadows any dashboard bundled in the sample jar
  '-cp', [...(ACCEPTANCE_MODE === 'javalin' ? [EXPORT_CLASSPATH] : []), classes, jar].join(path.delimiter),
  ...(ACCEPTANCE_MODE === 'javalin' ? ['-Dqqq.javalin.frontend=next'] : ['-Dqqq.javalin.frontend=none']),
  'AcceptanceSampleServer',
], { stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill('SIGTERM'))
server.on('exit', (code) => process.exit(code ?? 1))
