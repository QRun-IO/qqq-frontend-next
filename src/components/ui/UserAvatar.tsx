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
 * @file The one way a person is drawn: their avatar from the UI API, else their initials. Used by
 * the user menu, presence, comments, mentions, activity and the assistant, so every surface shows
 * the same picture. Decorative by default (the name is next to it); pass `label` when it stands alone.
 */
'use client'

import { useContext, useState } from 'react'
import { avatarSizeFor, isAvatarMiss, recordAvatarMiss, userAvatarUrl, versionedAvatarUrl } from '@/lib/api/avatars'
import { AuthContext } from '@/lib/auth/auth-provider'
import { useMyProfile } from '@/lib/hooks/use-my-profile'
import { cn } from '@/lib/utils/cn'

/**
 * Up to two initials from a name (or an id when there is no name).
 *
 * @param name - A display name, email or id.
 * @returns Upper-case initials, or `?`.
 */
export function initialsOf(name: string | undefined): string {
  const words = (name ?? '').replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean)
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((word) => Array.from(word)[0] ?? '')
  return letters.join('').toUpperCase() || '?'
}

/**
 * A round avatar.
 *
 * @param props - Who, how big, and an optional explicit image URL.
 * @returns The image, or initials when there is none.
 */
export function UserAvatar({
  userId,
  name,
  src,
  size = 32,
  label,
  className,
  'data-qqq-id': dataQqqId,
}: {
  /** The user's id; loads their avatar when the server stores profiles. */
  userId?: string
  /** The name the initials come from. */
  name?: string
  /** A known avatar URL (the signed-in user's own, or a local preview) instead of looking up `userId`. */
  src?: string
  /** Edge in CSS pixels. */
  size?: number
  /** Accessible name when the avatar is not next to the person's name. */
  label?: string
  className?: string
  'data-qqq-id'?: string
}) {
  const { installed } = useMyProfile()
  const serverSize = avatarSizeFor(size)
  const url = src ? versionedAvatarUrl(src, serverSize) : installed && userId ? userAvatarUrl(userId, serverSize) : undefined
  const [failed, setFailed] = useState<string | null>(null)
  const show = url && failed !== url && !isAvatarMiss(url)
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <span
      {...a11y}
      style={style}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-foreground/10 font-semibold leading-none text-foreground',
        className
      )}
      data-qqq-id={dataQqqId}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the UI API with the session cookie, already sized
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => {
            // a blob: preview is never remembered; a server miss is, for the session
            if (!url.startsWith('blob:')) recordAvatarMiss(url)
            setFailed(url)
          }}
        />
      ) : (
        initialsOf(name ?? userId)
      )}
    </span>
  )
}


/**
 * The signed-in user's own avatar (photo, chosen Gravatar, or initials of their chosen name).
 *
 * @param props - Size and classes.
 * @returns The avatar.
 */
export function MyAvatar({ size = 32, className, 'data-qqq-id': dataQqqId }: { size?: number; className?: string; 'data-qqq-id'?: string }) {
  const profile = useMyProfile()
  const user = useContext(AuthContext)?.user
  return <UserAvatar src={profile.avatarUrl} name={profile.displayName ?? user?.name ?? user?.email} size={size} className={className} data-qqq-id={dataQqqId} />
}
