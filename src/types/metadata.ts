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
 * @file QQQ backend metadata shapes used to drive all dynamic UI rendering.
 */

// QQQ Metadata Types - ported from qqq-frontend-core

import type { QFieldType, Capability, QComponentType, QAppNodeType, AdornmentType } from './enums'

/**
 * Top-level QQQ instance descriptor returned by the `/metaData/instance` endpoint.
 *
 * Contains the full set of apps, tables, processes, reports, widgets, and branding
 * that the frontend uses to render all pages dynamically.
 */
export interface QInstance {
  /** Map of app name → app metadata for every app in this instance. */
  apps: Record<string, QAppMetaData>
  /** Ordered tree of top-level app nodes used to build the sidebar navigation. */
  appTree: QAppTreeNode[]
  /** Map of table name → table metadata for every table in this instance. */
  tables: Record<string, QTableMetaData>
  /** Map of process name → process metadata for every process in this instance. */
  processes: Record<string, QProcessMetaData>
  /** Map of report name → report metadata for every report in this instance. */
  reports: Record<string, QReportMetaData>
  /** Map of widget name → widget metadata for every widget in this instance. */
  widgets: Record<string, QWidgetMetaData>
  /** Branding configuration (logos, colors, banners, custom CSS). */
  branding: QBrandingMetaData
  /** Map of help content key → help content used for contextual documentation. */
  helpContents: Record<string, QHelpContent>
  /** Arbitrary key/value pairs the backend exposes to the frontend environment. */
  environmentValues: Record<string, string>
  /** Optional plugin-specific supplemental metadata not covered by the core schema. */
  supplementalInstanceMetaData?: Record<string, unknown>
  /** Optional theme overrides for colors and display mode. */
  theme?: QThemeMetaData
}

/**
 * Authentication configuration returned alongside instance metadata.
 *
 * Describes the auth provider type and any values (client IDs, base URLs) needed
 * to initialize the corresponding auth flow in the frontend.
 */
export interface QAuthenticationMetaData {
  /** Unique name for this authentication configuration. */
  name: string
  /** The authentication strategy this instance uses. */
  type: 'AUTH_0' | 'OAUTH2' | 'FULLY_ANONYMOUS' | 'MOCK' | 'TABLE_BASED'
  /** Provider-specific values (client ID, base URL, audience); absent for MOCK and FULLY_ANONYMOUS. */
  values?: {
    /** OAuth2 / Auth0 client ID registered with the identity provider. */
    clientId?: string
    /** Base URL for the identity provider (used by OAUTH2 and AUTH_0 flows). */
    baseUrl?: string
    /** API audience identifier passed in Auth0 token requests. */
    audience?: string
    /** Space-separated scopes to request from an OAUTH2 provider. */
    scopes?: string
  }
  /**
   * Branding that is safe to show before sign-in (QRun-IO/qqq#703): the login page's
   * logo, app name and accent. Absent when the backend declares no branding or predates it.
   */
  branding?: QLoginBranding
}

/**
 * The subset of {@link QBrandingMetaData} the backend exposes before a session exists.
 * Banners and custom CSS are never included.
 */
export type QLoginBranding = Pick<QBrandingMetaData, 'companyName' | 'appName' | 'logo' | 'icon' | 'accentColor' | 'accentColorLight'>

/**
 * Branding configuration that controls the visual identity of the application.
 *
 * Applied globally via the theme provider and injected `<style>` tag.
 */
export interface QBrandingMetaData {
  /** Human-readable company name; optional in QQQ branding. */
  companyName?: string
  /** URL of the company website; optional in QQQ branding. */
  companyUrl?: string
  /** Display name for this specific application. */
  appName?: string
  /** URL or path to the application logo image (shown at the top of the sidebar). */
  logo?: string
  /** URL or path to the favicon / small app icon. */
  icon?: string
  /** Hex or CSS color string used as the primary accent color. */
  accentColor?: string
  /** Light variant of the accent color. */
  accentColorLight?: string
  /** Banners keyed by display slot (for example `QFMD_TOP_OF_SITE`). */
  banners?: Record<string, Banner>
  /** Custom CSS string injected into a <style> tag via data-qqq-id selectors */
  customCss?: string
}

/**
 * Theme token overrides that allow the backend to adjust color mode and palette.
 *
 * These values are applied on top of the default Tailwind CSS custom properties.
 */
export interface QThemeMetaData {
  /** Primary brand color (hex or CSS value). */
  primaryColor?: string
  /** Accent color (hex or CSS value). */
  accentColor?: string
  /** Preferred color scheme; defaults to the OS preference when omitted. */
  mode?: 'light' | 'dark'
  /** Additional arbitrary CSS custom property overrides keyed by token name. */
  customTokens?: Record<string, string>
}

/**
 * Full metadata descriptor for a QQQ table.
 *
 * Drives all rendering of record query, view, create, and edit pages, including
 * field display, permissions, sections layout, and join relationships.
 */
export interface QTableMetaData {
  /** Unique backend name for this table (used in API calls). */
  name: string
  /** Named record groups, present only in full table metadata. */
  associations?: QAssociation[]
  /** Human-readable label shown in the UI. */
  label: string
  /** When true, this table is excluded from navigation and search. */
  isHidden: boolean
  /** Structured icon definition from table metadata. */
  icon?: QIcon
  /** The field name whose value uniquely identifies each record. */
  primaryKeyField: string
  /** Map of field name → field metadata for every column in this table. */
  fields: Record<string, QFieldMetaData>
  /** Ordered list of field-grouping sections shown on the record view/edit pages. */
  sections: QTableSection[]
  /** Joins that have been explicitly exposed for use in queries and views. */
  exposedJoins: QExposedJoin[]
  /** Backend capabilities (query, get, insert, update, delete) enabled for this table. */
  capabilities: Capability[]
  /** Whether the current user may read records from this table. */
  readPermission: boolean
  /** Whether the current user may create new records in this table. */
  insertPermission: boolean
  /** Whether the current user may update existing records in this table. */
  editPermission: boolean
  /** Whether the current user may delete records from this table. */
  deletePermission: boolean
  /** When true, this table uses the variants system (multi-tenant / scoped data). */
  usesVariants: boolean
  /** Human-readable label for the variant dimension (e.g. "Client"). */
  variantTableLabel: string
  /** Optional contextual help content shown on this table's pages. */
  helpContent?: QHelpContent
  /** Table help content by slot name, as the backend declares it. */
  helpContents?: Record<string, QHelpContent[]>
  /** Optional plugin-specific supplemental metadata not covered by the core schema. */
  supplementalTableMetaData?: Record<string, unknown>
  /** Optional sharing configuration for this table. */
  shareableTableMetaData?: Record<string, unknown>
}

/**
 * Metadata for a single field (column) within a QQQ table.
 *
 * Controls rendering, validation, editability, and display format for a field
 * across query, view, and edit contexts.
 */
export interface QFieldMetaData {
  /** Backend name for this field (used as the key in record value maps). */
  name: string
  /** Human-readable label shown as the column header or form label. */
  label: string
  /** The QQQ field data type, which determines the renderer and validator used. */
  type: QFieldType
  /** When true, a non-null value is required to save the record. */
  isRequired: boolean
  /** When false, the field is rendered read-only in edit forms. */
  isEditable: boolean
  /**
   * When true, the field value is not fetched in list/query responses and
   * must be loaded separately (e.g. large blobs).
   */
  isHeavy: boolean
  /** When true, the field is excluded from grids and detail views. */
  isHidden: boolean
  /** Value pre-populated in new-record forms if the user provides no input. */
  defaultValue?: unknown
  /** Name of the possible-value source used to populate autocomplete options. */
  possibleValueSourceName?: string
  /** A printf-style or date-format string used when rendering the field value. */
  displayFormat?: string
  /** Maximum character length enforced during validation (for STRING/TEXT fields). */
  maxLength?: number
  /** Minimum numeric value enforced during validation (for INTEGER/LONG/DECIMAL fields). */
  minValue?: number | string | null
  /** Maximum numeric value enforced during validation (for INTEGER/LONG/DECIMAL fields). */
  maxValue?: number | string | null
  /** Number of grid columns this field should occupy in the form layout. */
  gridColumns?: number
  /** List of visual/behavioral adornments applied when rendering this field. */
  adornments: FieldAdornment[]
  /** Contextual help items associated with this field. */
  helpContents?: QHelpContent[]
  /** Named behaviors (backend extension hooks) attached to this field. */
  behaviors?: string[]
}

/**
 * Metadata for a QQQ backend process.
 *
 * A process is a multi-step, wizard-style workflow executed by the backend.
 * This shape describes the process's identity, permissions, and the ordered
 * list of frontend steps to render.
 */
export interface QProcessMetaData {
  /** Unique backend name for this process (used in API calls). */
  name: string
  /** Human-readable label shown in navigation and page headings. */
  label: string
  /** Name of the table this process is associated with (may be empty). */
  tableName: string
  /** When true, this process is excluded from navigation and search. */
  isHidden: boolean
  /** Material Icon or custom icon name used in navigation. */
  iconName: string
  /** Structured icon definition from process metadata. */
  icon?: QIcon
  /** Whether the current user is permitted to run this process. */
  hasPermission: boolean
  /** The step execution model — currently only LINEAR is supported. */
  stepFlow: 'LINEAR'
  /** Minimum number of input records required to start this process. */
  minInputRecords: number
  /** Maximum number of input records allowed; omitted means unlimited. */
  maxInputRecords?: number
  /** Ordered list of frontend step descriptors to render in the wizard. */
  frontendSteps: QFrontendStepMetaData[]
}

/**
 * Metadata for a single step in a process wizard.
 *
 * Describes the components to render, along with any form, view, or record-list
 * fields that the step requires.
 */
export interface QFrontendStepMetaData {
  /** Unique name for this step (used to identify next/back navigation targets). */
  name: string
  /** Human-readable label shown in the step header and breadcrumbs. */
  label: string
  /** Optional display format hint (e.g. 'fullWidth'). */
  format?: string
  /** Ordered list of UI components to render inside this step. */
  components: QFrontendComponent[]
  /** Fields included in editable form components within this step. */
  formFields?: QFieldMetaData[]
  /** Fields included in read-only view components within this step. */
  viewFields?: QFieldMetaData[]
  /** Fields used as columns in record list components within this step. */
  recordListFields?: QFieldMetaData[]
  /** Contextual help content associated with this step. */
  helpContents?: QHelpContent[]
  /** Step (frontend or backend) the process restarts at when the user goes Back from this screen. */
  backStepName?: string
}

/**
 * A single UI component descriptor within a process frontend step.
 *
 * The `type` determines which React component is rendered; `values` carries
 * any additional configuration specific to that component type.
 */
export interface QFrontendComponent {
  /** The component type, matched to a registered renderer in the process wizard. */
  type: QComponentType
  /** Arbitrary key/value pairs passed as props to the component renderer. */
  values?: Record<string, unknown>
}

/**
 * Metadata for a top-level QQQ application node.
 *
 * An app groups related tables, processes, reports, and widgets under a shared
 * navigation section in the sidebar.
 */
export interface QAppMetaData {
  /** Unique backend name for this app. */
  name: string
  /** Human-readable label shown in the sidebar and app home page heading. */
  label: string
  /** Ordered list of child nodes (tables, processes, sub-apps); omitted when empty. */
  children?: QAppTreeNode[]
  /** Child nodes keyed by name (labels and icons for section entries). */
  childMap?: Record<string, QAppTreeNode>
  /** Legacy Material Icon name used in navigation. */
  iconName?: string
  /** Structured icon definition (overrides `iconName` when present). */
  icon?: QIcon
  /** Names of widgets displayed on this app's home dashboard page; omitted when empty. */
  widgets?: string[]
  /** Ordered sections that group tables, processes, and reports on the app home; omitted when empty. */
  sections?: QAppSection[]
}

/**
 * A node in the global app navigation tree.
 *
 * Used to build the sidebar recursively; each node may be a table, process,
 * report, or nested app grouping.
 */
export interface QAppTreeNode {
  /** Unique backend name for this node. */
  name: string
  /** Human-readable label shown in the sidebar. */
  label: string
  /** The kind of entity this node represents, used to determine the route. */
  type: QAppNodeType
  /** Child nodes for app-type nodes (creates nested navigation groups). */
  children?: QAppTreeNode[]
  /** Material Icon name shown next to this node in the sidebar. */
  iconName?: string
  /** Structured icon definition (overrides `iconName` when present). */
  icon?: QIcon
}

/**
 * A named grouping of tables, processes, and reports within an app home page.
 *
 * Sections are rendered as labeled card groups on the app dashboard.
 */
export interface QAppSection {
  /** Unique name for this section within its parent app. */
  name: string
  /** Human-readable label displayed as the section heading. */
  label: string
  /** Optional icon shown beside the section heading. */
  icon?: QIcon
  /** Names of tables included in this section; omitted when empty. */
  tables?: string[]
  /** Names of processes included in this section; omitted when empty. */
  processes?: string[]
  /** Names of reports included in this section; omitted when empty. */
  reports?: string[]
}

/**
 * Definition for a dropdown filter control that appears in a widget's toolbar.
 *
 * The selected value is passed as a query parameter when fetching widget data,
 * allowing the backend to scope results accordingly.
 */
export interface QWidgetDropdown {
  /** Unique name for this dropdown (used as the query parameter key). */
  name: string
  /** Human-readable label shown above or beside the dropdown. */
  label: string
  /** Name of the possible-value source that populates the dropdown options. */
  possibleValueSourceName?: string
  /** Pre-selected value used when the user has not made an explicit selection. */
  defaultValue?: string
  /** `POSSIBLE_VALUE_SOURCE` (default) or `DATE_PICKER`. */
  type?: 'POSSIBLE_VALUE_SOURCE' | 'DATE_PICKER'
  /** When true the widget waits for a selection before showing content. */
  isRequired?: boolean
  /** Label of an explicit "no selection" option. */
  labelForNullValue?: string
  /** Preferred control width in pixels. */
  width?: number
}

/** An icon placed in a widget header, keyed by role (e.g. `topRightInsideCard`). */
export interface QWidgetIcon {
  /** Material Icons name. */
  name?: string
  /** CSS color. */
  color?: string
  /** Image path used instead of a named icon. */
  path?: string
}

/** One help-content entry as served by the full widget metadata route. */
export interface QWidgetHelpContent {
  content?: string
  format?: 'TEXT' | 'HTML' | 'MARKDOWN'
  roles?: string[]
}

/**
 * Metadata for a QQQ widget that can be placed on an app dashboard.
 *
 * Widgets are self-contained data display units — charts, statistics, record
 * grids, HTML blocks, etc. — whose data is fetched independently.
 */
export interface QWidgetMetaData {
  /** Frontend widget defaults, including explicit association bindings. */
  defaultValues?: Record<string, unknown>
  /** Unique backend name for this widget (used in data-fetch API calls). */
  name: string
  /** Human-readable label shown in the widget header. */
  label: string
  /** Widget renderer type (e.g. 'chart', 'statistics', 'recordGrid'). */
  type?: string
  /** Whether the current user is permitted to view this widget's data. */
  hasPermission: boolean
  /** Number of grid columns this widget occupies in the dashboard layout. */
  gridColumns?: number
  /** When true, a reload button is shown in the widget toolbar. */
  showReloadButton?: boolean
  /** When true, an export (download) button is shown in the widget toolbar. */
  showExportButton?: boolean
  /** Filter dropdown controls available in this widget's toolbar. */
  dropdowns?: QWidgetDropdown[]
  /**
   * Optional contextual help content associated with this widget. The full
   * metadata route serves a map of slot name (e.g. `label`) to entries.
   */
  helpContent?: QHelpContent | Record<string, QWidgetHelpContent[]>
  /** When false the widget renders without card chrome. Defaults to true. */
  isCard?: boolean
  /** Tooltip shown on the widget label. */
  tooltip?: string
  /** Header icons keyed by role (`topLeftInsideCard`, `topRightInsideCard`). */
  icons?: Record<string, QWidgetIcon>
  /** When true, dropdown selections persist in local storage. */
  storeDropdownSelections?: boolean
  /** Minimum body height (CSS length). */
  minHeight?: string
  /** Static footer HTML declared in metadata. */
  footerHTML?: string
}

/**
 * A grouping of fields shown as a collapsible card section on record view/edit pages.
 *
 * Sections can optionally embed a widget instead of raw field values, allowing
 * rich related-data panels within a record detail page.
 */
export interface QTableSection {
  /** Unique name for this section within its parent table. */
  name: string
  /** Human-readable label displayed as the section card heading. */
  label: string
  /**
   * Display tier that controls card prominence.
   * Typically 'T1' (main), 'T2' (secondary), or 'T3' (tertiary).
   */
  tier?: string
  /** Material Icon or custom icon name shown beside the section heading. */
  iconName?: string
  /** Structured icon definition (overrides `iconName` when present). */
  icon?: QIcon
  /** Ordered list of field names to display in this section. */
  fieldNames: string[]
  /** When set, renders a named widget in place of raw field values. */
  widgetName?: string
  /** When true, this section is collapsed / hidden from view by default. */
  isHidden: boolean
  /** The v1 metadata spelling of `isHidden`. */
  hidden?: boolean
  /** Help content shown with the section heading, per each entry's screen roles. */
  helpContents?: QHelpContent[]
  /** Number of grid columns this section occupies in the record layout. */
  gridColumns?: number
}

/**
 * Describes a join relationship that the backend has explicitly exposed for use
 * in queries and record views.
 *
 * Exposed joins allow the frontend to include joined-table fields in filters,
 * column selectors, and record detail sections.
 */
export interface QExposedJoin {
  /** Human-readable label for this join relationship. */
  label: string
  /** When true, joining this table may return multiple rows per base record. */
  isMany: boolean
  /** Full metadata for the joined table (used for field lookups). */
  joinTable?: QTableMetaData
  /** Ordered list of join steps from the base table to the joined table. */
  joinPath?: QJoinMetaData[]
}

/** A named record group and the exact join that relates its records. */
export interface QAssociation {
  name: string
  associatedTableName: string
  join: QJoinMetaData & { joinOns: Array<{ leftField: string; rightField: string }> }
}

/**
 * A single join hop in a join path, describing the cardinality and tables involved.
 */
export interface QJoinMetaData {
  /** Unique backend name for this join definition. */
  name: string
  /** Cardinality of the relationship between left and right tables. */
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE'
  /** Name of the table on the left (source) side of the join. */
  leftTable: string
  /** Name of the table on the right (target) side of the join. */
  rightTable: string
}

/**
 * Metadata for a QQQ report, which represents a pre-defined backend data export.
 */
export interface QReportMetaData {
  /** Unique backend name for this report. */
  name: string
  /** Human-readable label shown in navigation and page headings. */
  label: string
  /** When true, this report is excluded from navigation and search. */
  isHidden: boolean
  /** Whether the current user is permitted to run this report. */
  hasPermission: boolean
  /** Process that runs this report (e.g. the basic report process). */
  processName?: string
  /** Material Icons name for navigation. */
  iconName?: string
}

/**
 * Contextual help content that can be attached to tables, fields, processes, and widgets.
 *
 * Rendered as a popover or inline section near the element it annotates.
 */
export interface QHelpContent {
  /** Optional heading text shown at the top of the help panel. */
  title?: string
  /** Main help body, in `format`. */
  content?: string
  /** How `content` is written: `TEXT` (default), `HTML` or `MARKDOWN`. */
  format?: 'TEXT' | 'HTML' | 'MARKDOWN'
  /** Backend-rendered HTML for `content` (MARKDOWN converted; TEXT and HTML as-is). */
  contentAsHtml?: string
  /** Optional list of external documentation links. */
  links?: Array<{ label: string; url: string }>
  /** Screens this entry applies to (for example `READ_SCREENS`, `EDIT_SCREEN`); none means every screen. */
  roles?: string[]
}

/**
 * A named icon used in navigation, sections, and app tree nodes.
 *
 * Supports both Material Icons (by name) and custom SVG paths.
 */
export interface QIcon {
  /** Material Icon name or custom icon identifier; omitted when only `path` is set. */
  name?: string
  /** Optional SVG path or image URL for custom icons. */
  path?: string
  /** Optional CSS color value applied to the icon. */
  color?: string
}

/**
 * Represents a single variant option for tables that use the QQQ variants system.
 *
 * Variants scope table data to a specific tenant, client, or configuration context.
 */
export interface QTableVariant {
  /** Unique backend name for this variant. */
  name: string
  /** Human-readable label shown in the variant selector. */
  label: string
  /** Optional longer description of what this variant represents. */
  description?: string
}

/**
 * A notification banner displayed at the top of the application.
 *
 * Banners are defined in branding metadata and rendered by the dashboard layout.
 */
export interface Banner {
  /** Severity that selects the default colors and icon. */
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
  /** Text color override, as a CSS color value. */
  textColor?: string
  /** Background color override, as a CSS color value. */
  backgroundColor?: string
  /** Plain-text message. */
  messageText?: string
  /** HTML message, used instead of the plain-text message when set (sanitized before rendering). */
  messageHTML?: string
  /** Additional CSS style properties for the banner, keyed by camelCase property name. */
  additionalStyles?: Record<string, string | number>
}

/**
 * A field adornment exactly as the backend declares it (`FieldAdornment.java`).
 *
 * Adornments modify how a field value is rendered — as a hyperlink, chip badge,
 * tooltip, error indicator, downloadable file, code editor or widget. `values`
 * uses the backend's keys, for example `toRecordFromTable` / `target` (LINK),
 * `color.<value>` / `icon.<value>` (CHIP), `width` (SIZE), `languageMode`
 * (CODE_EDITOR), `fileNameField` / `defaultMimeType` (FILE_DOWNLOAD), `format`
 * (FILE_UPLOAD), `staticText` / `tooltipDynamic` (TOOLTIP) and `widgetName` (WIDGET).
 * Read them with the helpers in `@/lib/utils/adornment-utils`.
 */
export interface FieldAdornment {
  /** Which adornment this is. */
  type: AdornmentType
  /** Adornment settings keyed as the backend declares them. */
  values?: Record<string, unknown>
}
