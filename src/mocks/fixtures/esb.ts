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

/**
 * @file ESB fixture data — `GET /qqq/v1/esb/table/order` for the demo `order` table: a topic
 * without broker management data, a managed queue, and one trigger on each.
 */

import type { EsbCapabilities, EsbCounter, EsbDestination, EsbTableResponse } from '@/types'

/**
 * Builds a counter snapshot with every count at zero.
 *
 * @param overrides - Counts that differ from zero.
 * @returns A complete counter snapshot.
 */
function counter(overrides: Partial<EsbCounter> = {}): EsbCounter {
  return {
    published: 0,
    publishFailures: 0,
    consumed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    inFlight: 0,
    lastActivity: null,
    avgMs: 0,
    maxMs: 0,
    lastError: null,
    ...overrides,
  }
}

const artemisCapabilities: EsbCapabilities = {
  browse: true,
  pauseQueue: true,
  purge: true,
  deleteSelected: true,
  deleteOlderThan: true,
  move: true,
}

const orderEvents: EsbDestination = {
  name: 'orderEvents',
  type: 'TOPIC',
  provider: 'artemis',
  brokerName: 'orderEvents',
  counters: counter({ published: 128, publishFailures: 2, lastActivity: '2026-09-25T12:00:00Z' }),
  queueInfo: null,
  capabilities: artemisCapabilities,
}

const orderFulfillment: EsbDestination = {
  name: 'orderFulfillment',
  type: 'QUEUE',
  provider: 'artemis',
  brokerName: 'orderFulfillment',
  counters: counter({ published: 40, lastActivity: '2026-09-25T11:58:30Z' }),
  queueInfo: { messageCount: 7, consumerCount: 2, paused: false },
  capabilities: artemisCapabilities,
}

export const orderEsb: EsbTableResponse = {
  table: 'order',
  publications: [
    { destination: orderEvents, events: ['INSERT', 'UPDATE', 'DELETE'] },
    { destination: orderFulfillment, events: ['INSERT'] },
  ],
  subscribers: [
    {
      name: 'fulfillOrder.orderFulfillment',
      processName: 'fulfillOrder',
      processLabel: 'Fulfill Order',
      destination: orderFulfillment,
      mode: 'SINGLE',
      concurrency: 2,
      maxAttempts: 3,
      state: 'RUNNING',
      counters: counter({
        consumed: 33,
        succeeded: 30,
        failed: 3,
        retried: 4,
        deadLettered: 1,
        inFlight: 1,
        lastActivity: '2026-09-25T11:58:31Z',
        avgMs: 120,
        maxMs: 950,
        lastError: 'Warehouse API timed out',
      }),
      deadLetter: { brokerName: 'orderFulfillment.dlq', messageCount: 1 },
    },
    {
      name: 'cancelOrder.orderEvents',
      processName: 'cancelOrder',
      processLabel: 'Cancel Order',
      destination: orderEvents,
      mode: 'BATCH',
      concurrency: 1,
      maxAttempts: 5,
      state: 'PAUSED',
      counters: counter({
        consumed: 12,
        succeeded: 12,
        lastActivity: '2026-09-25T10:15:00Z',
        avgMs: 45,
        maxMs: 80,
      }),
      deadLetter: { brokerName: 'orderEvents.cancelOrder.orderEvents.dlq', messageCount: null },
    },
  ],
  permissions: { canOperate: false, canDelete: false },
}
