/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Compiles the owned acceptance fixture against the sample JAR and runs it on loopback.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { ACCEPTANCE_MODE, EXPORT_CLASSPATH, resolveSampleJar } from './acceptance-paths.mjs'

const port = process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? '18765'
const jar = resolveSampleJar()
const sampleVersion = path.basename(jar).match(/^qqq-sample-project-(.+)-jar-with-dependencies\.jar$/)?.[1]
if (!sampleVersion) throw new Error(`Cannot determine QQQ version from sample JAR: ${jar}`)
const apiJar = process.env.QQQ_MIDDLEWARE_API_JAR ?? path.join(homedir(), '.m2', 'repository', 'com', 'kingsrook', 'qqq',
  'qqq-middleware-api', sampleVersion, `qqq-middleware-api-${sampleVersion}.jar`)
if (!existsSync(apiJar)) throw new Error(`QQQ middleware API JAR does not exist: ${apiJar}`)
const fixtureClasspath = [jar, apiJar].join(path.delimiter)
const classes = path.resolve('test-results/acceptance/fixture-classes')
rmSync(classes, { recursive: true, force: true })
mkdirSync(classes, { recursive: true })
const fixtureDirectory = path.resolve('tests/acceptance/fixture')
const sources = readdirSync(fixtureDirectory).filter((name) => name.endsWith('.java')).map((name) => path.join(fixtureDirectory, name))
const javac = spawnSync('javac', ['-proc:none', '-encoding', 'UTF-8', '-cp', fixtureClasspath, '-d', classes, ...sources], { stdio: 'inherit' })
if (javac.status !== 0) {
  console.error('Acceptance fixture compilation failed.')
  process.exit(1)
}
if (!existsSync(path.join(classes, 'AcceptanceSampleServer.class'))) process.exit(1)

const server = spawn('java', [
  '-Dqqq.sample.mockAuthentication=true',
  '-Dqqq.sample.sharing=true',
  `-Dqqq.sample.port=${port}`,
  '-Duser.timezone=UTC',
  // javalin mode: the fresh export shadows any dashboard bundled in the sample jar
  '-cp', [...(ACCEPTANCE_MODE === 'javalin' ? [EXPORT_CLASSPATH] : []), classes, fixtureClasspath].join(path.delimiter),
  ...(ACCEPTANCE_MODE === 'javalin' ? ['-Dqqq.javalin.frontend=next'] : ['-Dqqq.javalin.frontend=none']),
  'AcceptanceSampleServer',
], { stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill('SIGTERM'))
server.on('exit', (code) => process.exit(code ?? 1))
