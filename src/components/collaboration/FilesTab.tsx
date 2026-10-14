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

/** @file Attachment uploads with per-file progress and the shared media preview. */
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Attachment, CollaborationRecord, RecordFeaturesV1 } from '@/types/collaboration'
import type { FilePreviewKind } from '@/lib/utils/file-preview'
import { formatBytes } from '@/lib/utils/file-preview'
import { attachmentUrl } from '@/lib/api/collaboration'
import {
  useAttachments,
  useAttachmentActions,
  useAttachmentUrl,
} from '@/lib/hooks/use-collaboration-record'
import { FileKindIcon } from '@/components/preview/FileKindIcon'
const Lightbox = dynamic(
  () => import('@/components/preview/FilePreviewLightbox').then((m) => m.FilePreviewLightbox),
  { ssr: false }
)

/** Maps MIME types to existing media preview kinds.
 * @param type - MIME type.
 * @returns Preview kind.
 */
function kindFor(type?: string | null): FilePreviewKind {
  if (type?.startsWith('image/')) return 'image'
  if (type?.startsWith('video/')) return 'video'
  if (type?.startsWith('audio/')) return 'audio'
  return type === 'application/pdf' ? 'pdf' : 'other'
}
/** One attachment, with authorized metadata changes and a fresh preview URL.
 * @param props - Attachment and parent identity.
 * @returns File row.
 */
function AttachmentRow({ file, record }: { file: Attachment; record: CollaborationRecord }) {
  const actions = useAttachmentActions(record)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(file.fileName ?? '')
  const [description, setDescription] = useState(file.description ?? '')
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const kind = kindFor(file.contentType)
  const url = useAttachmentUrl(file.id, 'preview', kind === 'image' || preview)
  const open = async () => {
    setError('')
    try {
      if (kind === 'other') {
        const result = await attachmentUrl(file.id, 'download')
        window.location.assign(result.url)
      } else {
        setPreview(true)
        void url.refetch()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open file.')
    }
  }
  return (
    <li
      className="space-y-2 rounded-lg border border-border p-3"
      data-qqq-id={`attachment-${file.id}`}
    >
      <button
        className="flex w-full min-w-0 items-start gap-3 text-left"
        data-qqq-id={`attachment-open-${file.id}`}
        onClick={() => void open()}
      >
        {kind === 'image' &&
        url.data /* Backend-authorized short-lived preview, no image optimizer. */ ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url.data.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
        ) : (
          <FileKindIcon kind={kind} className="h-9 w-9 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 break-words">
          <span className="block text-sm font-medium">{file.fileName ?? 'Attachment'}</span>
          <span className="block text-xs text-muted-foreground">
            {formatBytes(file.sizeBytes ?? 0)} · {file.createdByUserId ?? 'Unknown'}
          </span>
          <time className="text-xs text-muted-foreground" dateTime={file.createDate ?? undefined}>
            {file.createDate ? new Date(file.createDate).toLocaleDateString() : ''}
          </time>
        </span>
      </button>
      {file.description && !editing && (
        <p className="break-words text-xs text-muted-foreground">{file.description}</p>
      )}
      {file.canDelete && (
        <div className="flex gap-3 text-xs">
          <button
            data-qqq-id={`attachment-edit-${file.id}`}
            onClick={() => {
              setName(file.fileName ?? '')
              setDescription(file.description ?? '')
              setEditing(!editing)
            }}
          >
            Rename / describe
          </button>
          <button
            data-qqq-id={`attachment-delete-${file.id}`}
            disabled={actions.remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete ${file.fileName ?? 'this file'}?`))
                actions.remove.mutate(file.id)
            }}
          >
            Delete
          </button>
        </div>
      )}
      {editing && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            actions.patch.mutate(
              { id: file.id, patch: { fileName: name, description } },
              { onSuccess: () => setEditing(false) }
            )
          }}
        >
          <label className="block text-xs">
            File name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-2"
              data-qqq-id="attachment-name"
            />
          </label>
          <label className="block text-xs">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-2"
              data-qqq-id="attachment-description"
            />
          </label>
          <button
            disabled={actions.patch.isPending || !name.trim()}
            className="rounded border border-border px-3 py-2 text-xs"
            data-qqq-id="attachment-save"
          >
            Save file details
          </button>
        </form>
      )}
      {(error || actions.patch.isError || actions.remove.isError || (preview && url.isError)) && (
        <p role="alert" className="text-sm text-destructive">
          {error || 'Could not update or open this file. Please try again.'}
        </p>
      )}
      {preview && url.data && (
        <Lightbox
          items={[
            {
              url: url.data.url,
              fileName: file.fileName ?? 'Attachment',
              mimeType: file.contentType ?? undefined,
              kind,
              alt: file.description ?? file.fileName ?? 'Attachment',
              sizeBytes: file.sizeBytes ?? undefined,
              previewable: true,
              thumbnailSize: 48,
            },
          ]}
          index={0}
          onIndexChange={() => undefined}
          onClose={() => setPreview(false)}
        />
      )}
    </li>
  )
}
/** Drag-and-drop uploads queue one multipart request per file.
 * @param props - Record and metadata limits/capabilities.
 * @returns Files tab.
 */
export function FilesTab({
  record,
  features,
}: {
  record: CollaborationRecord
  features: RecordFeaturesV1
}) {
  const query = useAttachments(record)
  const actions = useAttachmentActions(record)
  const [uploads, setUploads] = useState<
    Array<{ id: string; name: string; progress: number; error?: string; done?: boolean }>
  >([])
  const [dragging, setDragging] = useState(false)
  const canAttach = features.capabilities?.attach === true
  const setting = features.settings?.ATTACHMENTS?.maxBytes
  const maxBytes = typeof setting === 'number' && setting > 0 ? setting : 100 * 1024 * 1024
  const files = query.data?.pages.flatMap((page) => page.items) ?? []
  const upload = async (selection: File[]) => {
    if (!canAttach) return
    for (const file of selection) {
      const id = crypto.randomUUID()
      const error =
        file.size > maxBytes
          ? `${file.name} is too large. Maximum file size is ${formatBytes(maxBytes)}.`
          : undefined
      setUploads((items) => [...items, { id, name: file.name, progress: 0, error }])
      if (error) continue
      try {
        await actions.upload.mutateAsync({
          file,
          onProgress: (progress) =>
            setUploads((items) =>
              items.map((item) => (item.id === id ? { ...item, progress } : item))
            ),
        })
        setUploads((items) =>
          items.map((item) => (item.id === id ? { ...item, progress: 100, done: true } : item))
        )
      } catch (error) {
        setUploads((items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Upload failed. Choose the file again to retry.',
                }
              : item
          )
        )
      }
    }
  }
  return (
    <div className="space-y-4" data-qqq-id="collaboration-files">
      {canAttach ? (
        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center ${dragging ? 'border-primary bg-accent' : 'border-border'}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void upload(Array.from(event.dataTransfer.files))
          }}
          data-qqq-id="files-dropzone"
        >
          <p className="text-sm font-medium">Drop files here</p>
          {/* the native picker's "Choose Files / No file chosen" text ignores the theme; a styled label opens it */}
          <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            Choose files
            <input
              type="file"
              multiple
              className="sr-only"
              data-qqq-id="files-picker"
              onChange={(event) => {
                void upload(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Up to {formatBytes(maxBytes)} per file
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to attach files to this record.
        </p>
      )}
      {!!uploads.length && (
        <ul aria-label="Uploads" className="space-y-2">
          {uploads.map((item) => (
            <li key={item.id} className="break-words text-xs">
              <p>
                {item.name} {item.done ? 'Uploaded' : item.error ? '' : `${item.progress}%`}
              </p>
              {item.error ? (
                <p role="alert" className="text-destructive">
                  {item.error}
                </p>
              ) : (
                <progress
                  aria-label={`Upload ${item.name}`}
                  value={item.progress}
                  max={100}
                  className="w-full"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {query.isPending && <p role="status">Loading files…</p>}
      {query.isError && (
        <p role="alert">
          Could not load files.{' '}
          <button data-qqq-id="files-retry" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {query.isSuccess && !files.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">No files yet.</p>
      )}
      <ul className="space-y-3">
        {files.map((file) => (
          <AttachmentRow key={file.id} file={file} record={record} />
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          data-qqq-id="files-more"
          disabled={query.isFetchingNextPage}
          className="w-full rounded border border-border py-2 text-sm"
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </div>
  )
}
