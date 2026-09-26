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
 * @file ESB types — mirror the `/qqq/v1/esb` endpoint contract served by the `qqq-esb` module
 * (QRun-IO/qqq#739). Field names and shapes match the JSON exactly.
 */

/** Per-node activity counters for a destination or trigger. */
export interface EsbCounter {
  published: number
  publishFailures: number
  consumed: number
  succeeded: number
  failed: number
  retried: number
  deadLettered: number
  inFlight: number
  /** ISO-8601 instant of the last activity, or `null` when there has been none. */
  lastActivity: string | null
  avgMs: number
  maxMs: number
  lastError: string | null
}

/** Whether a destination is a point-to-point queue or a publish/subscribe topic. */
export type EsbDestinationType = 'QUEUE' | 'TOPIC'

/** Broker-reported queue state, available when the provider has a management URL. */
export interface EsbQueueInfo {
  messageCount: number
  consumerCount: number
  paused: boolean
}

/** Management actions the destination's broker adapter supports. */
export interface EsbCapabilities {
  browse: boolean
  pauseQueue: boolean
  purge: boolean
  deleteSelected: boolean
  deleteOlderThan: boolean
  move: boolean
}

/** A queue or topic configured in QQQ metadata. */
export interface EsbDestination {
  name: string
  type: EsbDestinationType
  /** Name of the ESB provider the destination lives on. */
  provider: string
  /** Broker-side destination name. */
  brokerName: string
  counters: EsbCounter
  /** Broker queue state, or `null` when the broker has no management API configured. */
  queueInfo: EsbQueueInfo | null
  capabilities: EsbCapabilities
}

/** How a trigger hands messages to its process. */
export type EsbTriggerMode = 'SINGLE' | 'BATCH'

/** Runtime state of a trigger's consumers on this node. */
export type EsbTriggerState = 'RUNNING' | 'PAUSED' | 'CONNECTING' | 'STOPPED'

/** A trigger's dead-letter queue. */
export interface EsbDeadLetter {
  brokerName: string
  /** Messages waiting in the dead-letter queue, or `null` when the broker cannot report it. */
  messageCount: number | null
}

/** A process triggered by messages on a destination. */
export interface EsbTrigger {
  /** `<processName>.<destinationName>`. */
  name: string
  processName: string
  processLabel: string
  destination: EsbDestination
  mode: EsbTriggerMode
  concurrency: number
  maxAttempts: number
  state: EsbTriggerState
  counters: EsbCounter
  deadLetter: EsbDeadLetter
}

/** What the current user may do with the ESB objects in a response. */
export interface EsbPermissions {
  canOperate: boolean
  canDelete: boolean
}

/** Record events a table can publish. */
export type EsbTableEvent = 'INSERT' | 'UPDATE' | 'DELETE'

/** Lifecycle events a process can publish. */
export type EsbProcessEvent = 'STARTED' | 'COMPLETED' | 'FAILED'

/** A destination a table or process publishes to, and the events it sends there. */
export interface EsbPublication<E extends string = string> {
  destination: EsbDestination
  events: E[]
}

/** `GET /qqq/v1/esb/table/{table}`. */
export interface EsbTableResponse {
  table: string
  publications: EsbPublication<EsbTableEvent>[]
  /** Triggers consuming this table's destinations, limited to processes the user can access. */
  subscribers: EsbTrigger[]
  permissions: EsbPermissions
}

/** `GET /qqq/v1/esb/process/{process}`. */
export interface EsbProcessResponse {
  process: string
  publications: EsbPublication<EsbProcessEvent>[]
  triggers: EsbTrigger[]
  permissions: EsbPermissions
}

/** Supported broker types. */
export type EsbProviderType = 'ACTIVEMQ_ARTEMIS' | 'RABBITMQ'

/** A configured broker connection. */
export interface EsbProvider {
  name: string
  type: EsbProviderType
  connected: boolean
  managementEnabled: boolean
}

/** A table or process that publishes to a destination. */
export interface EsbPublisher {
  kind: 'TABLE' | 'PROCESS'
  name: string
  events: string[]
}

/** A destination with everything that publishes to and consumes from it. */
export interface EsbOverviewDestination extends EsbDestination {
  publishers: EsbPublisher[]
  triggers: EsbTrigger[]
}

/** `GET /qqq/v1/esb/overview`. */
export interface EsbOverviewResponse {
  providers: EsbProvider[]
  destinations: EsbOverviewDestination[]
  permissions: EsbPermissions
}

/** A CloudEvents 1.0 structured event as QQQ publishes it. */
export interface EsbCloudEvent {
  specversion: string
  id: string
  source: string
  type: string
  time?: string
  subject?: string
  datacontenttype?: string
  data?: unknown
  /** Extension attribute: `id` of the event whose triggered run produced this one. */
  qqqcausationid?: string
}

/** One message browsed from a queue or dead-letter queue. */
export interface EsbMessage {
  messageId: string
  timestamp: string
  deliveryCount: number
  /** The parsed CloudEvent, or `null` when the body is not one. */
  event: EsbCloudEvent | null
  /** The message body, truncated to 10,000 characters. */
  rawBody: string
  /** JMS properties, including `qqqError` and related properties on dead letters. */
  properties: Record<string, unknown>
}

/** `GET /qqq/v1/esb/deadLetters/{trigger}` and `GET /qqq/v1/esb/messages/{destination}`. */
export interface EsbMessagePage {
  messages: EsbMessage[]
  hasMore: boolean
}
