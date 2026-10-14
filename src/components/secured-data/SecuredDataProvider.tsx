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

/** @file Session-scoped reveal state. Values stay in memory and are discarded at expiry. */
'use client'
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { getUiApiVersion } from '@/lib/api/ui-api-version'
import type { RevealResult, RevealTarget } from '@/lib/api/secured-data'
import { remainingSeconds, securedValueKey } from '@/lib/utils/secured-data'
import { queryKeys } from '@/lib/query-client'

const RevealDialog = dynamic(() => import('./RevealDialog'), { ssr: false })
const BreakGlassBanner = dynamic(() => import('./BreakGlassBanner'), { ssr: false })
type Grant = RevealResult & RevealTarget
type RequestTarget = RevealTarget & { maskedValue: unknown }
const Context = createContext<{
  installed: boolean
  grants: Grant[]
  masks: Record<string, unknown>
  request: (target: RequestTarget) => void
}>({ installed: false, grants: [], masks: {}, request: () => {} })

/**
 * Read secured-data capability and in-memory reveals; safe outside the application shell.
 * @returns The rendered UI or current secured-data context.
 */
export function useSecuredData() {
  return useContext(Context)
}

/**
 * Capability-gated extension UI; unmounting on logout clears all revealed values.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
export function SecuredDataProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const version = useQuery({
    queryKey: queryKeys.uiApiVersion(),
    queryFn: getUiApiVersion,
    enabled,
    staleTime: Infinity,
  })
  const installed =
    enabled &&
    version.data?.extensions.some((extension) => extension.name === 'secured-data') === true
  return installed ? <InstalledSecuredData>{children}</InstalledSecuredData> : children
}

/**
 * Own the sensitive state only while the authenticated extension is available.
 * @param props - Component inputs.
 * @returns The rendered UI or current secured-data context.
 */
function InstalledSecuredData({ children }: { children: ReactNode }) {
  const returnFocus = useRef<HTMLElement | null>(null)
  const [target, setTarget] = useState<RequestTarget | null>(null)
  const [grants, setGrants] = useState<Grant[]>([])
  const [masks, setMasks] = useState<Record<string, unknown>>({})
  useEffect(() => {
    if (!grants.length) return
    const tick = () =>
      setGrants((current) => current.filter((grant) => remainingSeconds(grant.expiresAt) > 0))
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [grants.length])
  return (
    <Context.Provider
      value={{
        installed: true,
        grants,
        masks,
        request: (next) => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          setTarget(next)
        },
      }}
    >
      {children}
      {target && (
        <RevealDialog
          returnFocus={returnFocus.current}
          target={target}
          onClose={() => setTarget(null)}
          onSuccess={(result) => {
            setMasks((current) => ({ ...current, [securedValueKey(target)]: target.maskedValue }))
            setGrants((current) => [
              ...current.filter(
                (grant) =>
                  !(
                    grant.tableName === target.tableName &&
                    String(grant.primaryKey) === String(target.primaryKey) &&
                    grant.fieldName === target.fieldName
                  )
              ),
              { ...target, ...result },
            ])
            setTarget(null)
          }}
        />
      )}
    </Context.Provider>
  )
}

/**
 * Mount the persistent banner inside the application flex shell.
 * @returns The rendered UI or current secured-data context.
 */
export function SecuredDataBannerSlot() {
  return useSecuredData().installed ? <BreakGlassBanner /> : null
}
