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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apiClient from '@/lib/api/client'
import { QContextProvider } from '@/lib/context/q-context'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import EntityCreatePage from './create/page'
import EntityEditPage from './[recordId]/edit/page'
import EntityCopyPage from './[recordId]/copy/page'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'person', recordId: '1' }),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

function fixture() {
  const person = structuredClone(qInstance.tables.person)
  person.fields = Object.fromEntries(['id', 'firstName', 'lastName', 'email'].map((name) => [name, person.fields[name]]))
  person.fields.firstName.label = 'Preferred given name'
  person.sections = [{ name: 'basic', label: 'Person', isHidden: false, fieldNames: ['firstName', 'lastName', 'email'] }]
  const registry = { ...qInstance, tables: { person: { name: 'person', label: 'Person', readPermission: true, insertPermission: true, editPermission: true } } }
  server.use(
    http.get('/qqq/v1/metaData', () => HttpResponse.json(registry)),
    http.get('/qqq/v1/metaData/table/person', () => HttpResponse.json(person)),
  )
  return person
}

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><QContextProvider>{page}</QContextProvider></QueryClientProvider>)
}

describe('Create and base edit use full metadata and actual write contracts', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear(); fixture() })

  it('edits the base without requesting denied children or replacing associations', async () => {
    const reads: string[] = []
    server.use(
      http.get('/data/person/1', ({ request }) => {
        const mode = new URL(request.url).searchParams.get('includeAssociations') ?? ''
        reads.push(mode)
        return mode === 'false' ? HttpResponse.json({ tableName: 'person', values: {
          id: 1, firstName: 'Avery', lastName: 'Sample', email: 'avery@example.invalid', unknown: 'must not echo',
        } }) : HttpResponse.json({ error: 'Children denied' }, { status: 403 })
      }),
    )
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 1, firstName: 'Updated' } }] })
    renderPage(<EntityEditPage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Updated' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Email/ }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/1'))
    expect(reads.length).toBeGreaterThan(0)
    expect(new Set(reads)).toEqual(new Set(['false']))
    expect(put.mock.calls[0][0]).toBe('/data/person/1')
    const submitted = put.mock.calls[0][1] as FormData
    expect(submitted?.get('firstName')).toBe('Updated')
    expect(submitted?.get('email')).toBe('')
    expect(submitted?.has('associations')).toBe(false)
    expect(submitted?.has('unknown')).toBe(false)
  })

  it('creates from full fields and unwraps the legacy envelope before navigating', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 7 } }] })
    renderPage(<EntityCreatePage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Created' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Sample' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/7'))
    expect(post.mock.calls[0][0]).toBe('/data/person')
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted?.get('firstName')).toBe('Created')
    expect(submitted?.has('associations')).toBe(false)
  })

  it('copies only base fields after full metadata is ready, without requiring child READ', async () => {
    const person = fixture()
    const source = { tableName: 'person', values: {
      id: 1, firstName: 'Avery', lastName: 'Sample', email: 'avery@example.invalid', unknown: 'must not echo',
    } }
    const sourceSnapshot = structuredClone(source)
    let releaseMetadata: () => void = () => {}
    const pendingMetadata = new Promise<void>((resolve) => { releaseMetadata = resolve })
    let requestedMetadata = false
    const reads: string[] = []
    server.use(
      http.get('/qqq/v1/metaData/table/person', async () => {
        requestedMetadata = true
        await pendingMetadata
        return HttpResponse.json(person)
      }),
      http.get('/data/person/1', ({ request }) => {
        const mode = new URL(request.url).searchParams.get('includeAssociations') ?? ''
        reads.push(mode)
        return mode === 'false' ? HttpResponse.json(source) : HttpResponse.json({ error: 'Children denied' }, { status: 403 })
      }),
    )
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 8 } }] })
    renderPage(<EntityCopyPage />)
    await waitFor(() => expect(requestedMetadata).toBe(true))
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(reads).toEqual([])
    await act(async () => { releaseMetadata() })
    expect(await screen.findByLabelText(/Preferred given name/)).toHaveValue('Avery')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/8'))
    expect(new Set(reads)).toEqual(new Set(['false']))
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted.get('firstName')).toBe('Avery')
    expect(submitted.has('id')).toBe(false)
    expect(submitted.has('associations')).toBe(false)
    expect(submitted.has('unknown')).toBe(false)
    expect(source).toEqual(sourceSnapshot)
  })

  it('retains the populated form after a failed save without an unhandled rejection', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Write denied'))
    renderPage(<EntityCreatePage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Keep input' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Sample' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Write denied')
    expect(screen.getByLabelText(/Preferred given name/)).toHaveValue('Keep input')
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('submits untouched optional numeric inputs as blanks and preserves typed zero', async () => {
    const person = fixture()
    for (const [name, type] of [['quantity', 'INTEGER'], ['price', 'DECIMAL'], ['total', 'LONG']] as const) {
      person.fields[name] = { ...person.fields.firstName, name, label: name, type, isRequired: false }
      person.sections[0].fieldNames.push(name)
    }
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 9 } }] })
    renderPage(<EntityCreatePage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Numeric' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Sample' } })
    fireEvent.change(screen.getByLabelText('total'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/9'))
    const submitted = post.mock.calls[0][1] as FormData
    expect(submitted.get('quantity')).toBe('')
    expect(submitted.get('price')).toBe('')
    expect(submitted.get('total')).toBe('0')
  })

  it('keeps the form disabled for the complete pending mutation', async () => {
    let finish: (response: unknown) => void = () => {}
    const pending = new Promise((resolve) => { finish = resolve })
    const post = vi.spyOn(apiClient, 'post').mockReturnValue(pending)
    renderPage(<EntityCreatePage />)
    const firstName = await screen.findByLabelText(/Preferred given name/)
    fireEvent.change(firstName, { target: { value: 'Pending' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Save' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saving = await screen.findByRole('button', { name: 'Saving...' })
    expect(saving).toBeDisabled()
    expect(screen.getByLabelText(/Preferred given name/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.click(saving)
    expect(post).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ records: [{ tableName: 'person', values: { id: 8 } }] }) })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/8'))
  })

  it('navigates with the metadata-defined string primary key as one encoded segment', async () => {
    const person = fixture()
    person.primaryKeyField = 'recordCode'
    person.fields.recordCode = { ...person.fields.firstName, name: 'recordCode', label: 'Code', isEditable: false }
    vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { recordCode: 'A/B#1' } }] })
    renderPage(<EntityCreatePage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Natural' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/person/A%2FB%231'))
  })

  it('does not announce a saved record when the response has no usable primary key', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: {} }] })
    renderPage(<EntityCreatePage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Keep input' } })
    fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Sample' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The server did not return a valid record identifier.')
    expect(push).not.toHaveBeenCalled()
  })

  it.each(['create', 'edit', 'copy'])('shows a full-metadata failure for %s without rendering an unusable form', async (mode) => {
    server.use(http.get('/qqq/v1/metaData/table/person', () => HttpResponse.json({ error: 'Metadata failed' }, { status: 500 })))
    renderPage(mode === 'create' ? <EntityCreatePage /> : mode === 'edit' ? <EntityEditPage /> : <EntityCopyPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Table metadata is unavailable.')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it.each(['missing', 'error'])('shows unavailable copy registry metadata for %s', async (mode) => {
    server.use(http.get('/qqq/v1/metaData', () => mode === 'missing'
      ? HttpResponse.json({ ...qInstance, tables: {} }) : HttpResponse.json({ error: 'Unavailable' }, { status: 500 })))
    renderPage(<EntityCopyPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Table metadata is unavailable.')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it.each(['readPermission', 'insertPermission'] as const)('does not load a copy source without %s', async (permission) => {
    const person = fixture()
    person[permission] = false
    const read = vi.fn()
    server.use(http.get('/data/person/1', () => {
      read()
      return HttpResponse.json({ tableName: 'person', values: { id: 1, firstName: 'Must not load' } })
    }))
    renderPage(<EntityCopyPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(permission === 'readPermission'
      ? 'You do not have permission to read the source People record.' : 'You do not have permission to create People records.')
    expect(read).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('shows a failed base-copy source read without offering a blank create form', async () => {
    server.use(http.get('/data/person/1', () => HttpResponse.json({ error: 'Source denied' }, { status: 403 })))
    renderPage(<EntityCopyPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('403')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})


describe('Explicit full copy', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear(); fixture() })
  it('keeps child edits in one root submission with exact names and fresh manual keys', async () => {
    const parent = fixture()
    parent.associations = [{ name: 'care / primary', associatedTableName: 'child', join: {
      name: 'personToChild', leftTable: 'person', rightTable: 'child', type: 'ONE_TO_MANY', joinOns: [{ leftField: 'id', rightField: 'owner' }],
    } }]
    const child = { ...structuredClone(parent), name: 'child', label: 'Child', primaryKeyField: 'manualKey', associations: [], fields: {
      manualKey: { ...parent.fields.firstName, name: 'manualKey', label: 'New child key', isRequired: true },
      owner: { ...parent.fields.id, name: 'owner', isEditable: true, isRequired: true },
      firstName: { ...parent.fields.firstName, label: 'Child name' },
    }, sections: [] }
    const values = { id: 1, firstName: 'Parent', lastName: 'Source', email: 'copy@example.invalid' }
    const originalChild = { tableName: 'child', values: { manualKey: 'old-child', owner: 1, firstName: 'Original child' } }
    const reads: string[] = []
    server.use(
      http.get('/qqq/v1/metaData/table/person', () => HttpResponse.json(parent)),
      http.get('/qqq/v1/metaData/table/child', () => HttpResponse.json(child)),
      http.get('/data/person/1', ({ request }) => {
        const expanded = new URL(request.url).searchParams.get('includeAssociations') === 'true'; reads.push(String(expanded))
        return HttpResponse.json({ tableName: 'person', values, ...(expanded ? { associatedRecords: { 'care / primary': [originalChild] } } : {}) })
      }),
    )
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 9 }, associatedRecords: { 'care / primary': [{ tableName: 'child', values: { manualKey: 'fresh-child', owner: 9 } }] } }] })
    const view = renderPage(<EntityCopyPage />)
    fireEvent.change(await screen.findByLabelText(/Preferred given name/), { target: { value: 'Edited parent' } })
    expect(reads).toEqual(['false'])
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    const key = await screen.findByLabelText(/New child key/)
    expect(key).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(key, { target: { value: 'fresh-child' } })
    fireEvent.change(screen.getByLabelText(/Child name/), { target: { value: 'Edited child' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Base copy' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    expect(screen.getByLabelText(/New child key/)).toHaveValue('fresh-child')
    expect(screen.getByLabelText(/Preferred given name/)).toHaveValue('Edited parent')
    expect(view.container.querySelectorAll('form')).toHaveLength(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const body = post.mock.calls[0][1] as FormData
    expect(body.get('firstName')).toBe('Edited parent')
    expect(body.has('id')).toBe(false)
    expect(JSON.parse(body.get('associations') as string)).toEqual({ 'care / primary': [{ values: { manualKey: 'fresh-child', firstName: 'Edited child' } }] })
    expect(originalChild.values).toEqual({ manualKey: 'old-child', owner: 1, firstName: 'Original child' })
  })
})


describe('Full copy failures stay visible and cannot save a base-only fallback', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.clear(); fixture() })
  function sources(problem: string) {
    const parent = fixture()
    parent.associations = [{ name: 'children', associatedTableName: 'child', join: { name: 'join', leftTable: 'person', rightTable: 'child', type: 'ONE_TO_MANY', joinOns: [{ leftField: 'id', rightField: 'owner' }] } }]
    const child = { ...structuredClone(parent), name: 'child', label: 'Child', associations: [], fields: { id: parent.fields.id, firstName: problem === 'numeric' ? { ...parent.fields.firstName, type: 'INTEGER' as const, label: 'Child amount' } : parent.fields.firstName, owner: { ...parent.fields.id, name: 'owner' } }, sections: [] }
    const values = { id: 1, firstName: 'Parent', lastName: 'Source', email: 'copy@example.invalid' }
    server.use(
      http.get('/qqq/v1/metaData/table/person', () => HttpResponse.json(parent)),
      http.get('/qqq/v1/metaData/table/child', () => problem.startsWith('metadata') ? HttpResponse.json({ error: 'Metadata unavailable' }, { status: problem === 'metadata-server' ? 500 : 403 }) : HttpResponse.json(child)),
      http.get('/data/person/1', ({ request }) => {
        if (new URL(request.url).searchParams.get('includeAssociations') !== 'true') return HttpResponse.json({ tableName: 'person', values })
        if (problem.startsWith('read')) return HttpResponse.json({ error: 'Read unavailable' }, { status: problem === 'read-server' ? 500 : 403 })
        return HttpResponse.json({ tableName: 'person', values, ...(problem === 'group' ? {} : { associatedRecords: { children: [{ tableName: 'child', values: { id: 2, owner: 1, ...(problem === 'value' ? {} : { firstName: problem === 'numeric' ? 5 : 'Child' }) } }] } }) })
      }),
    )
  }
  it.each(['read', 'metadata', 'group', 'value'])('blocks %s failure even on forced form submit', async problem => {
    sources(problem)
    const post = vi.spyOn(apiClient, 'post')
    const view = renderPage(<EntityCopyPage />)
    await screen.findByLabelText(/Preferred given name/)
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    await waitFor(() => expect(screen.getByRole('alert')).not.toHaveTextContent('Loading full copy'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(view.container.querySelector('form')!)
    expect(post).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
  it('does not announce success when a saved response omits a nonempty requested group', async () => {
    sources('none')
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 9 } }] })
    renderPage(<EntityCopyPage />)
    await screen.findByLabelText(/Preferred given name/)
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('did not confirm every copied association')
    expect(push).not.toHaveBeenCalled()
  })
  it('ignores a disabled hidden numeric child draft in Base mode while Full still checks it', async () => {
    sources('numeric')
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 9 } }] })
    const view = renderPage(<EntityCopyPage />)
    await screen.findByLabelText(/Preferred given name/)
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    const amount = await screen.findByRole('spinbutton', { name: /Child amount/ }) as HTMLInputElement
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    // jsdom does not implement partial numeric entry; supply the browser's validity result.
    Object.defineProperty(amount, 'validity', { configurable: true, value: { badInput: true } })
    const report = vi.spyOn(amount, 'reportValidity')
    fireEvent.submit(view.container.querySelector('form')!)
    expect(report).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Base copy' }))
    expect(amount.disabled).toBe(false)
    expect(amount.matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect((post.mock.calls[0][1] as FormData).has('associations')).toBe(false)
    expect(report).toHaveBeenCalledTimes(1)
  })

  it.each(['read', 'metadata'])('explains %s denial and lets the user explicitly save a Base Copy', async problem => {
    sources(problem)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'person', values: { id: 9 } }] })
    const view = renderPage(<EntityCopyPage />)
    await screen.findByLabelText(/Preferred given name/)
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('You do not have access to all the information needed for Full Copy. Choose Base Copy to copy this record only.'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('status code')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(view.container.querySelector('form')!)
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Base copy' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const body = post.mock.calls[0][1] as FormData
    expect(body.has('associations')).toBe(false)
    expect(body.get('firstName')).toBe('Parent')
  })
  it.each(['read-server', 'metadata-server'])('offers a retry for %s failure without claiming permission denial or silently saving', async problem => {
    sources(problem)
    const post = vi.spyOn(apiClient, 'post')
    const view = renderPage(<EntityCopyPage />)
    await screen.findByLabelText(/Preferred given name/)
    fireEvent.click(screen.getByRole('radio', { name: 'Full copy' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Full Copy could not load all required information. Reload to try again, or choose Base Copy.'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('do not have access')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(view.container.querySelector('form')!)
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Base copy' })).toBeEnabled()
  })

})
