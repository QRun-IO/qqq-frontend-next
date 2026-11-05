/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file The tracked workflow-editor bundle is staged only when its bytes match the committed lock. */

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { stageDynamicComponents } from '../../scripts/stage-dynamic-components.mjs'

const bytes = Buffer.from('window.QSequentialWorkflow={QSequentialWorkflow:function(){}}')
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const lock = { files: { 'q-sequential-workflow.bundle.js': sha(bytes) } }

describe('stageDynamicComponents', () => {
  it('copies a bundle whose sha256 matches the lock to the served path name', async () => {
    const assets = await mkdtemp(path.join(tmpdir(), 'dyn-assets-')); const out = await mkdtemp(path.join(tmpdir(), 'dyn-out-'))
    await writeFile(path.join(assets, 'q-sequential-workflow.bundle.js'), bytes)
    expect(await stageDynamicComponents({ assetDir: assets, lock, outDir: out })).toEqual(['q-sequential-workflow.bundle.js'])
    expect(await readFile(path.join(out, 'q-sequential-workflow.bundle.js'))).toEqual(bytes)
  })
  it('refuses a bundle that differs from the lock, a missing one and a lock without a hash', async () => {
    const assets = await mkdtemp(path.join(tmpdir(), 'dyn-assets-')); const out = await mkdtemp(path.join(tmpdir(), 'dyn-out-'))
    await expect(stageDynamicComponents({ assetDir: assets, lock, outDir: out })).rejects.toThrow(/Missing/)
    await writeFile(path.join(assets, 'q-sequential-workflow.bundle.js'), 'tampered')
    await expect(stageDynamicComponents({ assetDir: assets, lock, outDir: out })).rejects.toThrow(/does not match the lock/)
    await expect(stageDynamicComponents({ assetDir: assets, lock: { files: { 'q-sequential-workflow.bundle.js': null } }, outDir: out })).rejects.toThrow(/no sha256/)
  })
  it('the tracked canonical assets match the committed lock', async () => {
    const real = JSON.parse(await readFile(path.join(process.cwd(), 'scripts/dynamic-components.lock.json'), 'utf8'))
    expect(real.component.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
    for (const [name, hash] of Object.entries(real.files)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
      expect(sha(await readFile(path.join(process.cwd(), real.assetDirectory, name)))).toBe(hash)
    }
  })
})
