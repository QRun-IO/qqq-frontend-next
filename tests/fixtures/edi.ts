import type { EdiGuideTreeV1, EdiTargetV1, EdiPreviewV1 } from '../../src/types/edi'
import type { QRecord } from '../../src/types'

export const ediMap: QRecord = {
  tableName: 'edi_map',
  values: { id: 7, name: 'Purchase orders', status: 'DRAFT', guideId: 2 },
}
export const ediGuide: EdiGuideTreeV1 = {
  segments: [
    {
      id: 'BEG',
      name: 'Beginning',
      usage: 'R',
      elements: [
        { id: '324', position: 3, name: 'Purchase order number', usage: 'R', codes: ['PO', 'RE'] },
      ],
    },
  ],
  loops: [
    {
      id: 'PO1',
      repeat: 999,
      segments: [
        {
          id: 'PO1',
          name: 'Line item',
          usage: 'S',
          elements: [{ position: 2, name: 'Quantity', usage: 'R' }],
        },
      ],
      loops: [
        {
          id: 'PID',
          segments: [
            {
              id: 'PID',
              name: 'Description',
              usage: 'N',
              elements: [{ position: 5, name: 'Description', usage: 'S' }],
            },
          ],
        },
      ],
    },
  ],
}
export const ediTarget: EdiTargetV1 = {
  table: 'order',
  fields: [{ name: 'poNumber', label: 'Order number', required: true, type: 'STRING' }],
  associations: [
    {
      name: 'lines',
      label: 'Order lines',
      table: 'orderLine',
      fields: [{ name: 'quantity', label: 'Quantity', type: 'DECIMAL' }],
    },
  ],
  rules: [],
  transforms: [
    {
      name: 'TRIM',
      argumentSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'CONSTANT',
      argumentSchema: {
        type: 'object',
        properties: { value: { type: 'string', description: 'Constant value' } },
        required: ['value'],
        additionalProperties: false,
      },
    },
  ],
}
export const ediPreview: EdiPreviewV1 = {
  parse: { interchanges: 1, groups: 1, documents: 1 },
  findings: [
    {
      snipLevel: 2,
      severity: 'WARNING',
      code: 'REQUIRED',
      message: 'Required element missing',
      segmentId: 'BEG',
      elementPosition: 3,
    },
  ],
  ack: { type: '997', text: 'ST*997*0001~AK1*PO*1~' },
  phiSuppressed: false,
  result: {
    records: [
      { values: { poNumber: 'PO-123' }, associations: { lines: [{ values: { quantity: 3 } }] } },
    ],
  },
  diff: {
    againstExpected: [
      { documentIndex: 0, before: { poNumber: 'OLD' }, after: { poNumber: 'PO-123' } },
    ],
    againstPreviousRevision: [],
  },
}
