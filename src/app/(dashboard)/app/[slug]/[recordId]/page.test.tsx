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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deserializeFilter } from '@/lib/utils/filter-utils'
import apiClient from '@/lib/api/client'
import { QContextProvider } from '@/lib/context/q-context'
import { qInstance } from '@/mocks/fixtures/q-instance'
import { server } from '@/mocks/node'
import RecordViewPage from './page'

const navigation = vi.hoisted(() => ({ search: 'tab=related' }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'person', recordId: '1' }),
  usePathname: () => '/app/person/1',
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

const baseRecord = { tableName: 'person', values: { id: 1, firstName: 'Avery' }, recordLabel: 'Avery Sample' }

function fixture(childRead = false) {
  const person = structuredClone(qInstance.tables.person)
  const pet = { ...structuredClone(qInstance.tables.company), name: 'pet', label: 'Pet', readPermission: childRead, insertPermission: true }
  pet.fields.personId = { ...person.fields.id, name: 'personId', label: 'Person', isEditable: true, isHidden: false }
  person.exposedJoins = []
  person.associations = [{ name: 'pets', associatedTableName: 'pet', join: {
    name: 'personJoinPet', type: 'ONE_TO_MANY', leftTable: 'person', rightTable: 'pet',
    joinOns: [{ leftField: 'id', rightField: 'personId' }],
  } }]
  const registry = { ...qInstance, widgets: { ...qInstance.widgets }, tables: { person: { name: 'person', label: 'Person', readPermission: true }, pet: { name: 'pet', readPermission: childRead, insertPermission: true } } }
  server.use(
    http.get('/qqq/v1/metaData', () => HttpResponse.json(registry)),
    http.get('/qqq/v1/metaData/table/person', () => HttpResponse.json(person)),
    http.get('/qqq/v1/metaData/table/pet', () => HttpResponse.json(pet)),
  )
  return { person, pet, registry }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><QContextProvider><RecordViewPage /></QContextProvider></QueryClientProvider>)
}

describe('RecordViewPage independent association loading', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); navigation.search = 'tab=related' })

  it('keeps the base and child Add, and requests no expansion, when the child table is listed without read permission (QRun-IO/qqq#671)', async () => {
    fixture()
    const requests: string[] = []
    server.use(http.get('/data/person/1', ({ request }) => {
      requests.push(new URL(request.url).searchParams.get('includeAssociations') ?? '')
      return HttpResponse.json(baseRecord)
    }))
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    expect(await screen.findByText('Related records are unavailable.')).toBeVisible()
    expect(screen.getByRole('button', { name: '+ Add Pet' })).toBeEnabled()
    expect(screen.queryByText('No Pets records')).not.toBeInTheDocument()
    expect(requests).toEqual(['false'])
  })

  it('keeps the readable base and child Add when whole association expansion is denied', async () => {
    const { person: metadata, pet } = fixture(true)
    pet.readPermission = false
    const before = structuredClone(metadata)
    const requests: string[] = []
    server.use(http.get('/data/person/1', ({ request }) => {
      const mode = new URL(request.url).searchParams.get('includeAssociations') ?? ''
      requests.push(mode)
      return mode === 'true'
        ? HttpResponse.json({ error: 'Pet read denied' }, { status: 403 })
        : HttpResponse.json(baseRecord)
    }))
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    expect(await screen.findByText('Related records could not be loaded.')).toBeVisible()
    const add = screen.getByRole('button', { name: '+ Add Pet' })
    expect(add).toBeEnabled()
    expect(screen.queryByText('No Pets records')).not.toBeInTheDocument()
    expect(screen.getByText('Related records are unavailable.')).toBeVisible()
    fireEvent.click(add)
    expect(await screen.findByRole('dialog', { name: 'Add Pet' })).toBeVisible()
    expect(requests).toEqual(['false', 'true'])
    expect(metadata).toEqual(before)
  })

  it('neither requests nor shows an association whose table is hidden from the user (QRun-IO/qqq#671)', async () => {
    const { registry } = fixture()
    const { pet: _hidden, ...visibleTables } = registry.tables
    void _hidden
    const requests: string[] = []
    server.use(
      http.get('/qqq/v1/metaData', () => HttpResponse.json({ ...registry, tables: visibleTables })),
      http.get('/qqq/v1/metaData/table/pet', () => { requests.push('pet metadata'); return HttpResponse.json({ error: 'not found' }, { status: 404 }) }),
      http.get('/data/person/1', ({ request }) => {
        requests.push(`includeAssociations=${new URL(request.url).searchParams.get('includeAssociations')}`)
        return HttpResponse.json(baseRecord)
      }),
    )
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    await waitFor(() => expect(requests).toContain('includeAssociations=false'))
    expect(requests).toEqual(['includeAssociations=false'])
    expect(screen.queryByRole('button', { name: '+ Add Pet' })).not.toBeInTheDocument()
    expect(screen.queryByText('Related records could not be loaded.')).not.toBeInTheDocument()
  })

  it('does not rename association keys or present an unmatched association as empty', async () => {
    fixture(true)
    server.use(http.get('/data/person/1', ({ request }) => HttpResponse.json({
      ...baseRecord,
      ...(new URL(request.url).searchParams.get('includeAssociations') === 'true' ? {
        associatedRecords: { pet: [{ tableName: 'pet', values: { id: 2, name: 'Actual pet' }, recordLabel: 'Actual pet' }] },
      } : {}),
    })))
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Loading related records...')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '+ Add Pet' })).toBeEnabled()
    expect(screen.queryByText('No Pets records')).not.toBeInTheDocument()
    expect(screen.getByText('Related records are unavailable.')).toBeVisible()
  })
  it('retains explicitly keyed related records when the response binding is available', async () => {
    fixture(true)
    server.use(http.get('/data/person/1', ({ request }) => HttpResponse.json({
      ...baseRecord,
      ...(new URL(request.url).searchParams.get('includeAssociations') === 'true' ? {
        associatedRecords: { pets: [{ tableName: 'pet', values: { id: 2, name: 'Mapped pet' }, recordLabel: 'Mapped pet' }] },
      } : {}),
    })))
    renderPage()
    expect(await screen.findByText('Mapped pet')).toBeVisible()
    expect(screen.queryByText('Related records are unavailable.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Pet' })).toBeEnabled()
  })

  it('keeps arbitrary aliases distinct and deduplicates target metadata loads', async () => {
    const { person, pet } = fixture(true)
    person.associations = ['care / primary', 'scheduled reviews'].map((name) => ({ ...person.associations![0], name }))
    const metadataCalls: string[] = []
    let releaseMetadata!: () => void
    const ready = new Promise<void>((resolve) => { releaseMetadata = resolve })
    server.use(
      http.get('/qqq/v1/metaData/table/pet', async () => { metadataCalls.push('pet'); await ready; return HttpResponse.json(pet) }),
      http.get('/data/person/1', ({ request }) => HttpResponse.json({ ...baseRecord,
        ...(new URL(request.url).searchParams.get('includeAssociations') === 'true'
          ? { associatedRecords: { 'care / primary': [], 'scheduled reviews': [{ tableName: 'pet', values: { id: 4, name: 'Review pet' } }] } } : {}),
      })),
    )
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    await waitFor(() => expect(screen.getAllByText('Loading related metadata...')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: '+ Add Pet' })).not.toBeInTheDocument()
    releaseMetadata()
    expect(await screen.findByText('No care / primary records')).toBeVisible()
    expect(await screen.findByText('Review pet')).toBeVisible()
    expect(metadataCalls).toEqual(['pet'])
    expect(screen.getAllByRole('button', { name: '+ Add Pet' })).toHaveLength(2)
  })

  it.each(['tab=overview', 'view=list'])('places explicitly bound groups in their sections (%s)', async (view) => {
    navigation.search = view
    const { person, registry } = fixture(true)
    person.associations = [{ ...person.associations![0], name: 'care / primary' }, { ...person.associations![0], name: 'scheduled reviews' }]
    person.sections = [
      { name: 'fieldGuide', label: 'Companions', tier: 'T2', isHidden: false, fieldNames: [], widgetName: 'companionPanel' },
      { name: 'reviewSchedule', label: 'Reviews', tier: 'T2', isHidden: false, fieldNames: [], widgetName: 'reviewEditor' },
    ]
    registry.widgets.companionPanel = { name: 'companionPanel', label: 'Different widget title', type: 'childRecordList', hasPermission: true, defaultValues: { manageAssociationName: 'care / primary' } }
    registry.widgets.reviewEditor = { name: 'reviewEditor', label: 'Another title', type: 'rowBuilder', hasPermission: true, defaultValues: { associationName: 'scheduled reviews' } }
    server.use(http.get('/data/person/1', () => HttpResponse.json({ ...baseRecord, associatedRecords: { 'care / primary': [], 'scheduled reviews': [] } })))
    const { container } = renderPage()
    const byId = (id: string) => Array.from(container.querySelectorAll('[data-qqq-id]')).find((element) => element.getAttribute('data-qqq-id') === id)
    await waitFor(() => expect(byId('button-create-association-care%20%2F%20primary')).toBeEnabled())
    expect(byId('associated-records-care%20%2F%20primary')).toHaveTextContent('Companions')
    expect(byId('associated-records-scheduled%20reviews')).toHaveTextContent('Reviews')
    expect(screen.queryByRole('tab', { name: 'Related' })).not.toBeInTheDocument()
  })

  it('localizes target metadata failure without hiding the base or claiming an empty group', async () => {
    fixture(true)
    server.use(
      http.get('/qqq/v1/metaData/table/pet', () => HttpResponse.json({ error: 'Unavailable' }, { status: 500 })),
      http.get('/data/person/1', () => HttpResponse.json({ ...baseRecord, associatedRecords: { pets: [] } })),
    )
    renderPage()
    expect(await screen.findByText('Avery Sample')).toBeVisible()
    expect(await screen.findByText('Related table metadata is unavailable.')).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Add Pet' })).not.toBeInTheDocument()
    expect(screen.queryByText('No pets records')).not.toBeInTheDocument()
  })

  it('submits every composite non-PK relationship field despite their exclusion from editable inputs', async () => {
    const { person, pet } = fixture(false)
    person.fields.schedule = { ...person.fields.id, name: 'schedule' }
    person.fields.visitDate = { ...person.fields.firstName, name: 'visitDate', type: 'DATE' }
    pet.fields.birthDate = { ...person.fields.visitDate, name: 'birthDate', isEditable: true }
    pet.fields.personId.possibleValueSourceName = undefined
    person.associations![0].join.joinOns = [{ leftField: 'schedule', rightField: 'personId' }, { leftField: 'visitDate', rightField: 'birthDate' }]
    server.use(http.get('/data/person/1', ({ request }) => new URL(request.url).searchParams.get('includeAssociations') === 'true'
      ? HttpResponse.json({ error: 'Denied' }, { status: 403 })
      : HttpResponse.json({ ...baseRecord, values: { ...baseRecord.values, schedule: 2, visitDate: '1990-01-15' } })))
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ records: [{ tableName: 'pet', values: { id: 8, personId: 2, birthDate: '1990-01-15' } }] })
    const before = structuredClone({ person, pet })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add Pet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Pet' })
    expect(within(dialog).getAllByRole('heading', { name: 'Add Pet' })).toHaveLength(1)
    expect(within(dialog).queryByLabelText('Person')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Created child' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).toBe('/data/pet')
    const values = post.mock.calls[0][1] as FormData
    expect(values.get('personId')).toBe('2')
    expect(values.get('birthDate')).toBe('1990-01-15')
    expect(values.get('name')).toBe('Created child')
    expect(values.has('associations')).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect({ person, pet }).toEqual(before)
  })

  it('round-trips Unicode and plus-bearing base64 View All filters through URLSearchParams', async () => {
    const { person, pet } = fixture(true)
    person.associations![0].join.joinOns = [{ leftField: 'firstName', rightField: 'personId' }]
    pet.fields.personId.type = 'STRING'
    const value = '>>>漢'
    server.use(http.get('/data/person/1', () => HttpResponse.json({ ...baseRecord, values: { id: 1, firstName: value }, associatedRecords: { pets: [] } })))
    renderPage()
    const link = await screen.findByRole('link', { name: 'View All' })
    const url = new URL(link.getAttribute('href')!, 'http://localhost')
    expect(url.search).toContain('%2B')
    expect(deserializeFilter(url.searchParams.get('filter')!)).toMatchObject({ criteria: [{ fieldName: 'personId', operator: 'EQUALS', values: [value] }], booleanOperator: 'AND' })
  })

  it('allows correctly oriented direct Add for reverse joins without claiming expanded absence', async () => {
    const { person } = fixture(true)
    person.associations![0].join = { ...person.associations![0].join, leftTable: 'pet', rightTable: 'person', type: 'MANY_TO_ONE', joinOns: [{ leftField: 'personId', rightField: 'id' }] }
    server.use(http.get('/data/person/1', () => HttpResponse.json({ ...baseRecord, associatedRecords: { pets: [] } })))
    renderPage()
    expect(await screen.findByText('Related record loading for reverse associations is not supported.')).toBeVisible()
    expect(screen.queryByText('No pets records')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Pet' })).toBeEnabled()
  })

  it('retains a panel with no visible columns while denying an unavailable relationship write', async () => {
    const { person, pet } = fixture(false)
    Object.values(pet.fields).forEach((field) => { field.isHidden = true })
    delete person.fields.id
    server.use(http.get('/data/person/1', () => HttpResponse.json(baseRecord)))
    renderPage()
    expect(await screen.findByText('Relationship values are unavailable; this record cannot be linked.')).toBeVisible()
    expect(screen.getByText('Related records are unavailable.')).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Add Pet' })).not.toBeInTheDocument()
  })

  it('keeps permitted Add available when there are no visible child columns', async () => {
    const { pet } = fixture(false)
    Object.values(pet.fields).forEach((field) => { field.isHidden = true })
    server.use(http.get('/data/person/1', () => HttpResponse.json(baseRecord)))
    renderPage()
    expect(await screen.findByRole('button', { name: '+ Add Pet' })).toBeEnabled()
    expect(screen.getByText('Related records are unavailable.')).toBeVisible()
  })

  it('keeps readable data and View All when INSERT alone is denied', async () => {
    const { pet } = fixture(true)
    pet.insertPermission = false
    server.use(http.get('/data/person/1', () => HttpResponse.json({ ...baseRecord, associatedRecords: { pets: [{ tableName: 'pet', values: { id: 'one/two?', name: 'Readable pet' } }] } })))
    renderPage()
    const recordLinks = await screen.findAllByRole('link', { name: 'View Pet record one/two?' })
    for (const link of recordLinks) expect(link.getAttribute('href')).toContain('/app/pet/one%2Ftwo%3F?')
    expect(screen.getByRole('link', { name: 'View All' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Add Pet' })).not.toBeInTheDocument()
  })

})
