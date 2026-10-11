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
 * @file FileKindIcon — the file-type icon shown for a FILE_PREVIEW value that has no image thumbnail.
 */

import React from 'react'
import { File, FileAudio, FileImage, FileText, FileVideo } from 'lucide-react'

import type { FilePreviewKind } from '@/lib/utils/file-preview'

const ICONS: Record<FilePreviewKind, typeof File> = {
  image: FileImage,
  pdf: FileText,
  video: FileVideo,
  audio: FileAudio,
  other: File,
}

/**
 * A decorative icon for a kind of file.
 *
 * @param props - The kind and classes.
 * @returns The icon (hidden from assistive technology).
 */
export function FileKindIcon({ kind, className }: { kind: FilePreviewKind; className?: string }) {
  const Icon = ICONS[kind]
  return <Icon className={className} aria-hidden="true" data-file-kind={kind} />
}
