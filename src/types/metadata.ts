// QQQ Metadata Types - ported from qqq-frontend-core

import type { QFieldType, Capability, AdornmentType, QComponentType, QAppNodeType } from './enums'

export interface QInstance {
  apps: Record<string, QAppMetaData>
  appTree: QAppTreeNode[]
  tables: Record<string, QTableMetaData>
  processes: Record<string, QProcessMetaData>
  reports: Record<string, QReportMetaData>
  widgets: Record<string, QWidgetMetaData>
  branding: QBrandingMetaData
  helpContents: Record<string, QHelpContent>
  environmentValues: Record<string, string>
  supplementalInstanceMetaData?: Record<string, unknown>
  theme?: QThemeMetaData
}

export interface QAuthenticationMetaData {
  name: string
  type: 'AUTH_0' | 'OAUTH2' | 'FULLY_ANONYMOUS' | 'MOCK'
  values: {
    clientId?: string
    baseUrl?: string
    audience?: string
  }
}

export interface QBrandingMetaData {
  companyName: string
  companyUrl: string
  appName: string
  logo?: string
  icon?: string
  accentColor?: string
  banners?: Record<string, Banner>
  /** Custom CSS string injected into a <style> tag via data-qqq-id selectors */
  customCss?: string
}

export interface QThemeMetaData {
  primaryColor?: string
  accentColor?: string
  mode?: 'light' | 'dark'
  customTokens?: Record<string, string>
}

export interface QTableMetaData {
  name: string
  label: string
  isHidden: boolean
  primaryKeyField: string
  fields: Record<string, QFieldMetaData>
  sections: QTableSection[]
  exposedJoins: QExposedJoin[]
  capabilities: Capability[]
  readPermission: boolean
  insertPermission: boolean
  editPermission: boolean
  deletePermission: boolean
  usesVariants: boolean
  variantTableLabel: string
  helpContent?: QHelpContent
  supplementalTableMetaData?: Record<string, unknown>
  shareableTableMetaData?: Record<string, unknown>
}

export interface QFieldMetaData {
  name: string
  label: string
  type: QFieldType
  isRequired: boolean
  isEditable: boolean
  isHeavy: boolean
  isHidden: boolean
  defaultValue?: unknown
  possibleValueSourceName?: string
  displayFormat?: string
  maxLength?: number
  gridColumns?: number
  adornments: FieldAdornment[]
  helpContents?: QHelpContent[]
  behaviors?: string[]
}

export interface QProcessMetaData {
  name: string
  label: string
  tableName: string
  isHidden: boolean
  iconName: string
  hasPermission: boolean
  stepFlow: 'LINEAR'
  minInputRecords: number
  maxInputRecords?: number
  frontendSteps: QFrontendStepMetaData[]
}

export interface QFrontendStepMetaData {
  name: string
  label: string
  format?: string
  components: QFrontendComponent[]
  formFields?: QFieldMetaData[]
  viewFields?: QFieldMetaData[]
  recordListFields?: QFieldMetaData[]
  helpContents?: QHelpContent[]
}

export interface QFrontendComponent {
  type: QComponentType
  values?: Record<string, unknown>
}

export interface QAppMetaData {
  name: string
  label: string
  children: QAppTreeNode[]
  iconName: string
  widgets: string[]
  sections: QAppSection[]
}

export interface QAppTreeNode {
  name: string
  label: string
  type: QAppNodeType
  children?: QAppTreeNode[]
  iconName?: string
  icon?: QIcon
}

export interface QAppSection {
  name: string
  label: string
  icon?: QIcon
  tables: string[]
  processes: string[]
  reports: string[]
}

export interface QWidgetDropdown {
  name: string
  label: string
  possibleValueSourceName?: string
  defaultValue?: string
}

export interface QWidgetMetaData {
  name: string
  label: string
  type?: string
  hasPermission: boolean
  gridColumns?: number
  showReloadButton?: boolean
  showExportButton?: boolean
  dropdowns?: QWidgetDropdown[]
  helpContent?: QHelpContent
}

export interface QTableSection {
  name: string
  label: string
  tier?: string
  iconName?: string
  fieldNames: string[]
  widgetName?: string
  isHidden: boolean
  gridColumns?: number
}

export interface QExposedJoin {
  label: string
  isMany: boolean
  joinTable?: QTableMetaData
  joinPath?: QJoinMetaData[]
}

export interface QJoinMetaData {
  name: string
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE'
  leftTable: string
  rightTable: string
}

export interface QReportMetaData {
  name: string
  label: string
  isHidden: boolean
  hasPermission: boolean
}

export interface QHelpContent {
  title?: string
  content?: string
  links?: Array<{ label: string; url: string }>
  roles?: string[]
}

export interface QIcon {
  name: string
  path?: string
  color?: string
}

export interface QTableVariant {
  name: string
  label: string
  description?: string
}

export interface Banner {
  text: string
  severity: 'info' | 'warning' | 'error'
  color?: string
  dismissible: boolean
}

export interface FieldAdornment {
  type: AdornmentType
  values?: Record<string, unknown>
}
