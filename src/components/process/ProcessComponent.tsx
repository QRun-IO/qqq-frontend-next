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
 * @file ProcessComponent — renders one declared frontend component of a process
 * screen by its `QComponentType`. A screen renders every component, in order.
 */

'use client'

import React from 'react'

import type { QFrontendComponent } from '@/types'

import { BulkEditFormComponent } from './BulkEditFormComponent'
import { BulkLoadFileMappingComponent } from './BulkLoadFileMappingComponent'
import { BulkLoadProfileComponent } from './BulkLoadProfileComponent'
import { BulkLoadValueMappingComponent } from './BulkLoadValueMappingComponent'
import { DownloadFormComponent } from './DownloadFormComponent'
import { EditFormComponent } from './EditFormComponent'
import { GoogleDriveFolderComponent } from './GoogleDriveFolderComponent'
import { HelpTextComponent } from './HelpTextComponent'
import { HtmlComponent } from './HtmlComponent'
import { ProcessSummaryResultsComponent } from './ProcessSummaryResultsComponent'
import { RecordListComponent } from './RecordListComponent'
import { ValidationReviewComponent } from './ValidationReviewComponent'
import { ViewFormComponent } from './ViewFormComponent'
import { WidgetComponent } from './WidgetComponent'

/** Props for {@link ProcessComponent}. */
export interface ProcessComponentProps {
  component: QFrontendComponent
  /** Position of the component on its screen. */
  index: number
}

/**
 * Render a process screen component.
 * @param props - {@link ProcessComponentProps}
 * @returns The component's content.
 */
export function ProcessComponent({ component, index }: ProcessComponentProps) {
  switch (component.type) {
    case 'HELP_TEXT': return <HelpTextComponent component={component} index={index} />
    case 'EDIT_FORM': return <EditFormComponent component={component} index={index} />
    case 'VIEW_FORM': return <ViewFormComponent index={index} />
    case 'RECORD_LIST': return <RecordListComponent index={index} />
    case 'VALIDATION_REVIEW_SCREEN': return <ValidationReviewComponent index={index} />
    case 'PROCESS_SUMMARY_RESULTS': return <ProcessSummaryResultsComponent index={index} />
    case 'DOWNLOAD_FORM': return <DownloadFormComponent index={index} />
    case 'HTML': return <HtmlComponent index={index} />
    case 'WIDGET': return <WidgetComponent component={component} index={index} />
    case 'BULK_EDIT_FORM': return <BulkEditFormComponent index={index} />
    case 'BULK_LOAD_FILE_MAPPING_FORM': return <BulkLoadFileMappingComponent index={index} />
    case 'BULK_LOAD_VALUE_MAPPING_FORM': return <BulkLoadValueMappingComponent index={index} />
    case 'BULK_LOAD_PROFILE_FORM': return <BulkLoadProfileComponent index={index} />
    case 'GOOGLE_DRIVE_SELECT_FOLDER': return <GoogleDriveFolderComponent index={index} />
    default:
      return (
        <p role="alert" className="text-sm text-destructive" data-qqq-id={`process-unknown-component-${index}`}>
          {`Unsupported process component: ${String((component as { type?: unknown }).type)}`}
        </p>
      )
  }
}
