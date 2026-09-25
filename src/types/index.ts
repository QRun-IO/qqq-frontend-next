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
 * @file Canonical re-export point for all QQQ TypeScript type definitions.
 *
 * All application code should import types from `@/types` rather than from the
 * individual module files so that internal type organisation can change without
 * affecting import paths throughout the codebase.
 */

// QQQ Type Definitions - canonical re-export point
// All implementations should import from @/types

export type {
  QFieldType,
  QAppNodeType,
  Capability,
  QCriteriaOperator,
  QComponentType,
  AdornmentType,
} from './enums'

export type {
  QInstance,
  QAuthenticationMetaData,
  QBrandingMetaData,
  QThemeMetaData,
  QTableMetaData,
  QFieldMetaData,
  QProcessMetaData,
  QFrontendStepMetaData,
  QFrontendComponent,
  QAppMetaData,
  QAppTreeNode,
  QAppSection,
  QWidgetDropdown,
  QWidgetHelpContent,
  QWidgetIcon,
  QWidgetMetaData,
  QTableSection,
  QExposedJoin,
  QJoinMetaData,
  QAssociation,
  QReportMetaData,
  QHelpContent,
  QIcon,
  QTableVariant,
  Banner,
  FieldAdornment,
} from './metadata'

export type { QRecord, QRecordInput, QPossibleValue, QAuditFieldChange, QAuditRecord } from './records'

export type {
  QQueryFilter,
  QFilterCriteria,
  QFilterOrderBy,
  QueryJoin,
  FilterVariableExpression,
  NowExpression,
  NowWithOffsetExpression,
  ThisOrLastPeriodExpression,
} from './query'

export type {
  QJobStarted,
  QJobRunning,
  QJobComplete,
  QJobError,
  ProcessMetaDataAdjustment,
  QJobResponse,
} from './processes'

export type {
  WidgetData,
  ChartWidgetData,
  ChartDataset,
  StatisticsWidgetData,
  HtmlWidgetData,
  RecordGridWidgetData,
  BlockData,
  BlockWidgetData,
} from './widgets'
