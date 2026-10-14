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

/** @file Ref-counted realtime client with BroadcastChannel leases and deterministic leader election. */
import type { SseEvent } from '@/lib/api/sse-parser'
import { readRealtimeStream, updateRealtimeSubscriptions } from '@/lib/api/realtime'

export type RealtimeChannel = `record:${string}:${string}` | `table:${string}` | 'user:me'
export interface RealtimeEvent {
  event: string
  data: Record<string, unknown>
}
interface Peer {
  seen: number
  channels: RealtimeChannel[]
}
interface BusMessage {
  from: string
  kind: 'lease' | 'bye' | 'event'
  channels?: RealtimeChannel[]
  event?: SseEvent
}
interface Options {
  id?: string
  bus?: BroadcastChannel | null
  read?: typeof readRealtimeStream
  update?: typeof updateRealtimeSubscriptions
}

/** One client per tab/session. Peers exchange only active channels and server events. */
export class RealtimeClient {
  readonly id: string
  private bus: BroadcastChannel | null
  private read: typeof readRealtimeStream
  private update: typeof updateRealtimeSubscriptions
  private refs = new Map<RealtimeChannel, number>()
  private peers = new Map<string, Peer>()
  private listeners = new Set<(event: RealtimeEvent) => void>()
  private clock?: ReturnType<typeof setInterval>
  private election?: ReturnType<typeof setTimeout>
  private retry?: ReturnType<typeof setTimeout>
  private controller?: AbortController
  private leader = false
  private ended = false
  private cursor = ''
  private connection = ''
  private active = new Set<string>()
  private refused = new Set<string>()
  private syncing = false
  private delay = 1000
  private hide?: () => void

  constructor(scope: string, options: Options = {}) {
    this.id = options.id ?? crypto.randomUUID()
    this.read = options.read ?? readRealtimeStream
    this.update = options.update ?? updateRealtimeSubscriptions
    try {
      this.bus =
        options.bus !== undefined
          ? options.bus
          : typeof BroadcastChannel === 'undefined'
            ? null
            : new BroadcastChannel(`qqq-realtime:${scope}`)
    } catch {
      this.bus = null
    }
    if (this.bus)
      this.bus.onmessage = ({ data }: MessageEvent<BusMessage>) => {
        if (this.ended || !data || data.from === this.id) return
        if (data.kind === 'event' && data.event) this.receive(data.event, false)
        if (data.kind === 'bye') {
          this.peers.delete(data.from)
          this.elect()
        }
        if (data.kind === 'lease' && Array.isArray(data.channels)) {
          const fresh = !this.peers.has(data.from)
          this.peers.set(data.from, { seen: Date.now(), channels: data.channels })
          if (fresh) this.announce()
          this.elect()
        }
      }
    if (typeof window !== 'undefined') {
      // A closing (or bfcache-frozen) tab never runs React cleanups, so the leader hands over
      // at once instead of after the lease expires. Its interval re-elects if it comes back.
      this.hide = () => {
        if (this.ended) return
        this.bus?.postMessage({ from: this.id, kind: 'bye' } satisfies BusMessage)
        this.disconnect()
        this.leader = false
      }
      window.addEventListener('pagehide', this.hide)
    }
  }
  /** Whether the session ended or the client was disposed; such a client never reconnects.
   * @returns True once ended.
   */
  get isEnded() {
    return this.ended
  }
  /** Retains a channel until the returned release function runs.
   * @param channel - Permission-checked subscription.
   * @returns Idempotent release.
   */
  subscribe(channel: RealtimeChannel) {
    this.refs.set(channel, (this.refs.get(channel) ?? 0) + 1)
    if (!this.clock && !this.ended) {
      this.clock = setInterval(() => {
        this.announce()
        this.elect()
      }, 2000)
      this.election = setTimeout(() => this.elect(), this.bus ? 150 : 0)
    }
    this.announce()
    void this.sync()
    let released = false
    return () => {
      if (released) return
      released = true
      const count = (this.refs.get(channel) ?? 1) - 1
      if (count) this.refs.set(channel, count)
      else {
        this.refs.delete(channel)
        this.refused.delete(channel)
      }
      this.announce()
      void this.sync()
      if (!this.refs.size) this.idle()
    }
  }
  /** Observes parsed events.
   * @param listener - Consumer.
   * @returns Cleanup.
   */
  onEvent(listener: (event: RealtimeEvent) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  /** Releases timers, stream and channel on session disposal. */
  close() {
    this.ended = true
    this.idle()
    if (this.hide) window.removeEventListener('pagehide', this.hide)
    this.bus?.close()
    this.bus = null
    this.listeners.clear()
  }
  /** Announces tab interest; the smallest live interested tab is leader. */
  private announce() {
    // An ended tab must not keep claiming leadership for channels it will never serve.
    if (this.ended) return
    this.bus?.postMessage({
      from: this.id,
      kind: 'lease',
      channels: [...this.refs.keys()],
    } satisfies BusMessage)
  }
  /** Stops a tab with no local consumers, allowing another tab to take over. */
  private idle() {
    this.bus?.postMessage({ from: this.id, kind: 'bye' } satisfies BusMessage)
    clearInterval(this.clock)
    clearTimeout(this.election)
    this.clock = undefined
    this.disconnect()
    this.leader = false
  }
  /** Elects a leader after expiring missing peers. */
  private elect() {
    if (this.ended || !this.refs.size) return
    for (const [id, peer] of this.peers) if (Date.now() - peer.seen > 6500) this.peers.delete(id)
    const winner = [
      this.id,
      ...[...this.peers].filter(([, p]) => p.channels.length).map(([id]) => id),
    ].sort()[0]
    if (winner !== this.id) {
      if (this.leader) this.disconnect()
      this.leader = false
      return
    }
    this.leader = true
    if (!this.controller && !this.retry) void this.connect()
    void this.sync()
  }
  /** Desired union across tabs.
   * @returns Deduplicated channel names.
   */
  private desired() {
    return new Set([...this.refs.keys(), ...[...this.peers.values()].flatMap((p) => p.channels)])
  }
  /** Cancels the current connection and outstanding retry. */
  private disconnect() {
    clearTimeout(this.retry)
    this.retry = undefined
    this.controller?.abort()
    this.controller = undefined
    this.connection = ''
    this.active.clear()
    this.refused.clear()
  }
  /** Connects and retries transient failures with capped exponential backoff. */
  private async connect() {
    const controller = new AbortController()
    this.controller = controller
    try {
      await this.read(controller.signal, this.cursor, (event) => this.receive(event, true))
    } catch {
      /* Retry transient transport failures. */
    }
    if (controller.signal.aborted || this.ended || !this.leader) return
    this.controller = undefined
    this.connection = ''
    this.active.clear()
    this.refused.clear()
    this.retry = setTimeout(() => {
      this.retry = undefined
      void this.connect()
    }, this.delay)
    this.delay = Math.min(this.delay * 2, 30000)
  }
  /** Applies an SSE event locally and forwards leader events to followers.
   * @param raw - Parsed SSE event.
   * @param broadcast - Received from our stream.
   */
  private receive(raw: SseEvent, broadcast: boolean) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw.data)
      if (!data || typeof data !== 'object' || Array.isArray(data)) return
    } catch {
      return
    }
    if (raw.id !== undefined) this.cursor = raw.id
    if (broadcast)
      this.bus?.postMessage({ from: this.id, kind: 'event', event: raw } satisfies BusMessage)
    if (raw.event === 'hello' && broadcast && typeof data.connectionId === 'string') {
      this.connection = data.connectionId
      this.active.clear()
      this.refused.clear()
      void this.sync()
    }
    if (raw.event !== 'hello') this.delay = 1000
    if (raw.event === 'channel-revoked' && typeof data.channel === 'string') {
      this.active.delete(data.channel)
      this.refused.add(data.channel)
    }
    for (const listener of this.listeners) listener({ event: raw.event, data })
    if (raw.event === 'session-ended') {
      this.ended = true
      this.idle()
    }
  }
  /** Serializes subscription updates so rapid retain/release cannot reorder requests. */
  private async sync() {
    if (this.syncing || !this.leader || !this.connection) return
    this.syncing = true
    try {
      while (this.leader && this.connection) {
        const desired = this.desired()
        const add = [...desired].filter((c) => !this.active.has(c) && !this.refused.has(c))
        const remove = [...this.active].filter((c) => !desired.has(c as RealtimeChannel))
        if (!add.length && !remove.length) break
        const connection = this.connection
        const result = await this.update(connection, add, remove)
        if (connection !== this.connection) break
        this.active = new Set(result.active ?? [])
        for (const channel of result.refused ?? []) this.refused.add(channel)
        // A channel the server neither activated nor refused would be re-added forever in this
        // loop (no await ever yields to the event loop); treat it as refused until reconnect.
        for (const channel of add) if (!this.active.has(channel)) this.refused.add(channel)
      }
    } catch {
      /* The next lease tick retries; a reconnect also restores all channels. */
    } finally {
      this.syncing = false
    }
  }
}
let singleton: { scope: string; client: RealtimeClient } | undefined
/** Returns the session's lazy singleton and disposes previous-session state. A client whose
 * session ended is replaced on the next subscription (after sign-in), never reconnected.
 * @param userId - Session user identity.
 * @returns Tab client.
 */
export function realtimeClient(userId: string) {
  const scope = `${process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'}:${userId}`
  if (singleton?.scope !== scope || singleton.client.isEnded) {
    singleton?.client.close()
    singleton = { scope, client: new RealtimeClient(scope) }
  }
  return singleton.client
}
/** Closes and forgets the tab singleton, so the next {@link realtimeClient} call starts a fresh
 * stream with no resume cursor. The test setup calls it after each case: a singleton kept
 * across cases resumes the next case's stream with `Last-Event-ID`, and the replay-miss
 * `resync` that answers it invalidates every active query in that case's cache.
 */
export function resetRealtimeClient() {
  singleton?.client.close()
  singleton = undefined
}
