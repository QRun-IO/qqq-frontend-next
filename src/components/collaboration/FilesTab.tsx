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
import Link from 'next/link'
import type { Attachment, CollaborationRecord, RecordFeaturesV1 } from '@/types/collaboration'
import type { FilePreviewKind } from '@/lib/utils/file-preview'
import { formatBytes } from '@/lib/utils/file-preview'
import { attachmentUrl } from '@/lib/api/collaboration'
import { saveAttachmentDownload } from '@/lib/api/attachment-download'
import { useAttachmentPreview } from '@/lib/hooks/use-attachment-preview'
import { attachmentRecoveryView } from '@/lib/utils/attachment-recovery-view'
import {
  useAttachments,
  useAttachmentActions,
} from '@/lib/hooks/use-collaboration-record'
import { FileKindIcon } from '@/components/preview/FileKindIcon'
import { INPUT_CLASS, LABEL_CLASS, buttonClass } from '@/components/ui/controls'
/** Standard in-text link: themed color, underline on hover, visible keyboard focus. */
const LINK_CLASS =
  'inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const ROW_ACTION = buttonClass('secondary', 'sm')
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
  const [downloading, setDownloading] = useState(false)
  const kind = kindFor(file.contentType)
  const canEdit = Object.prototype.hasOwnProperty.call(file, 'canEdit') ? file.canEdit === true : file.canDelete === true
  const url = useAttachmentPreview(file.id, kind === 'image' || preview)
  const download = async () => {
    setError('')
    setDownloading(true)
    try {
      const result = await attachmentUrl(file.id, 'download')
      await saveAttachmentDownload(result, file.fileName ?? 'Attachment')
    } catch {
      // Backend/storage diagnostics are not display messages. The lightbox and
      // direct action share this safe error and the same verified download path.
      throw new Error('Download unavailable. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  const open = async () => {
    setError('')
    try {
      if (kind === 'other') {
        await download()
      } else {
        setPreview(true)
        void url.refetch()
      }
    } catch {
      setError('Download unavailable. Please try again.')
    }
  }
  return (
    <li
      className="space-y-2 rounded-lg border border-border p-3"
      data-qqq-id={`attachment-${file.id}`}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {formatBytes(file.sizeBytes ?? 0)} · {file.createdByDisplayName ?? file.createdByUserId ?? 'Unknown'}
          </span>
          <time className="text-xs text-muted-foreground" dateTime={file.createDate ?? undefined}>
            {file.createDate ? new Date(file.createDate).toLocaleDateString() : ''}
          </time>
        </span>
      </button>
      {file.description && !editing && (
        <p className="break-words text-xs text-muted-foreground">{file.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {kind !== 'other' && <button
          type="button"
          className={ROW_ACTION}
          data-qqq-id={`attachment-preview-${file.id}`}
          onClick={() => void open()}
        >
          Preview
        </button>}
        <button
          type="button"
          className={ROW_ACTION}
          data-qqq-id={`attachment-open-action-${file.id}`}
          disabled={downloading}
          onClick={() => void open()}
        >
          Open
        </button>
        <button
          type="button"
          className={ROW_ACTION}
          data-qqq-id={`attachment-download-${file.id}`}
          disabled={downloading}
          onClick={() => void download().catch(() => setError('Download unavailable. Please try again.'))}
        >
          {downloading ? 'Downloading…' : 'Download'}
        </button>
      </div>
      {(canEdit || file.canDelete) && (
        <div className="flex flex-wrap gap-2">
          {canEdit && <button
            type="button"
          className={ROW_ACTION}
          data-qqq-id={`attachment-edit-${file.id}`}
            onClick={() => {
              setName(file.fileName ?? '')
              setDescription(file.description ?? '')
              setEditing(!editing)
            }}
          >
            Rename / describe
          </button>}
          {file.canDelete && <button
            type="button"
            className={buttonClass('destructive', 'sm')}
            data-qqq-id={`attachment-delete-${file.id}`}
            disabled={actions.remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete ${file.fileName ?? 'this file'}?`))
                actions.remove.mutate(file.id)
            }}
          >
            Delete
          </button>}
        </div>
      )}
      {editing && canEdit && (
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
          <label className={`block ${LABEL_CLASS}`}>
            File name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`mt-1 ${INPUT_CLASS}`}
              data-qqq-id="attachment-name"
            />
          </label>
          <label className={`block ${LABEL_CLASS}`}>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`mt-1 ${INPUT_CLASS}`}
              data-qqq-id="attachment-description"
            />
          </label>
          <button
            disabled={actions.patch.isPending || !name.trim()}
            className={buttonClass('primary', 'md')}
            data-qqq-id="attachment-save"
          >
            Save file details
          </button>
        </form>
      )}
      {url.isError && <p role="alert" className="text-sm text-destructive">Preview unavailable. Try again or use Download.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {actions.patch.isError && <p role="alert" className="text-sm text-destructive">Could not save file details. Please try again.</p>}
      {actions.remove.isError && <p role="alert" className="text-sm text-destructive">Could not delete this file. Please try again.</p>}
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
          onDownload={download}
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
  const recovery = attachmentRecoveryView(features.settings?.ATTACHMENTS?.recoveryView, record)
  const relatedSettings = features.settings?.ATTACHMENTS?.relatedViews
  const relatedViews = Array.isArray(relatedSettings) && relatedSettings.length <= 10
    ? relatedSettings.map((value) => attachmentRecoveryView(value, record)).filter((value) => value !== null)
    : []
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
      {relatedViews.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm" data-qqq-id="files-related-views">
          {relatedViews.map((view, index) => (
            <Link key={index} href={view.href} className={LINK_CLASS} data-qqq-id={`files-related-view-${index}`}>
              {view.label}
            </Link>
          ))}
        </div>
      )}
      {recovery && (
        <div className="space-y-1 text-sm">
          <Link href={recovery.href} className={LINK_CLASS} data-qqq-id="files-upload-recovery">
            {recovery.label}
          </Link>
          {uploads.some((item) => item.error) && (
            <p className="text-xs text-muted-foreground">
              An interrupted upload may have saved the file. Review it before uploading again.
            </p>
          )}
        </div>
      )}
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
          <label className={`mt-3 min-h-11 cursor-pointer focus-within:ring-2 focus-within:ring-ring ${buttonClass('secondary', 'md')}`}>
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
          <button type="button" className={buttonClass('secondary', 'sm')} data-qqq-id="files-retry" onClick={() => void query.refetch()}>
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
          type="button"
          data-qqq-id="files-more"
          disabled={query.isFetchingNextPage}
          className={`w-full ${buttonClass('secondary', 'md')}`}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </div>
  )
}
