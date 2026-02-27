/**
 * Types — canonical re-export point for all QQQ TypeScript type definitions.
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
  QWidgetMetaData,
  QTableSection,
  QExposedJoin,
  QJoinMetaData,
  QReportMetaData,
  QHelpContent,
  QIcon,
  QTableVariant,
  Banner,
  FieldAdornment,
} from './metadata'

export type { QRecord, QPossibleValue, QAuditFieldChange, QAuditRecord } from './records'

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
