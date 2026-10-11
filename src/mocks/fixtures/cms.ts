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
 * @file CMS fixture — a site with child domain and blog lists, shaped like a real content
 * app: wide child tables with long text (descriptions, meta tags) and zoned timestamps, so
 * record views, embedded child lists, the query grid and the app home can be checked for
 * readability at every width.
 */

import type { QAppMetaData, QAppTreeNode, QFieldMetaData, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'

/**
 * Field metadata with the defaults the backend sends.
 *
 * @param name - Field name.
 * @param label - Field label.
 * @param type - Field type.
 * @param overrides - Extra metadata.
 * @returns The field.
 */
function field(name: string, label: string, type: QFieldMetaData['type'], overrides: Partial<QFieldMetaData> = {}): QFieldMetaData {
  return { name, label, type, isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [], ...overrides }
}

/**
 * A wire timestamp some hours before now, so "today" values exist whenever the mock runs.
 *
 * @param hours - Hours ago.
 * @returns ISO-8601 instant in UTC.
 */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Capabilities and permissions every CMS table grants in the mock. */
const tableDefaults = {
  exposedJoins: [],
  capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_COUNT', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
  readPermission: true,
  insertPermission: true,
  editPermission: true,
  deletePermission: true,
  usesVariants: false,
  variantTableLabel: '',
} satisfies Partial<QTableMetaData>

const auditFields = {
  createDate: field('createDate', 'Create Date', 'DATE_TIME', { isEditable: false }),
  modifyDate: field('modifyDate', 'Modify Date', 'DATE_TIME', { isEditable: false }),
}

export const siteTable: QTableMetaData = {
  name: 'site',
  label: 'Sites',
  isHidden: false,
  primaryKeyField: 'id',
  ...tableDefaults,
  fields: {
    id: field('id', 'Id', 'INTEGER', { isEditable: false }),
    name: field('name', 'Name', 'STRING', { maxLength: 100 }),
    shortName: field('shortName', 'Short Name', 'STRING', { maxLength: 50 }),
    description: field('description', 'Description', 'STRING', { maxLength: 500 }),
    launchDate: field('launchDate', 'Launch Date', 'DATE'),
    ...auditFields,
  },
  sections: [
    { name: 'identity', label: 'Site', tier: 'T1', iconName: 'language', fieldNames: ['id', 'name', 'shortName', 'description'], isHidden: false },
    { name: 'domains', label: 'Domains', tier: 'T2', iconName: 'dns', fieldNames: [], widgetName: 'siteDomains', isHidden: false },
    { name: 'blogs', label: 'Blogs', tier: 'T2', iconName: 'folder', fieldNames: [], widgetName: 'siteBlogs', isHidden: false },
    { name: 'dates', label: 'Dates', tier: 'T3', iconName: 'calendar_month', fieldNames: ['launchDate', 'createDate', 'modifyDate'], isHidden: false },
  ],
}

export const siteDomainTable: QTableMetaData = {
  name: 'siteDomain',
  label: 'Site Domains',
  isHidden: false,
  primaryKeyField: 'id',
  ...tableDefaults,
  fields: {
    id: field('id', 'Id', 'INTEGER', { isEditable: false }),
    siteId: field('siteId', 'Site', 'INTEGER', { possibleValueSourceName: 'site' }),
    name: field('name', 'Name', 'STRING', { maxLength: 255 }),
    shortName: field('shortName', 'Short Name', 'STRING', { maxLength: 100 }),
    fqdn: field('fqdn', 'Fqdn', 'STRING', { maxLength: 255 }),
    isPrimary: field('isPrimary', 'Is Primary', 'BOOLEAN'),
    description: field('description', 'Description', 'STRING', { maxLength: 500 }),
    ...auditFields,
  },
  sections: [
    { name: 'identity', label: 'Domain', tier: 'T1', iconName: 'dns', fieldNames: ['id', 'siteId', 'name', 'shortName', 'fqdn', 'isPrimary'], isHidden: false },
    { name: 'details', label: 'Details', tier: 'T2', iconName: 'info', fieldNames: ['description'], isHidden: false },
    { name: 'dates', label: 'Dates', tier: 'T3', iconName: 'calendar_month', fieldNames: ['createDate', 'modifyDate'], isHidden: false },
  ],
}

export const siteBlogTable: QTableMetaData = {
  name: 'siteBlog',
  label: 'Site Blogs',
  isHidden: false,
  primaryKeyField: 'id',
  ...tableDefaults,
  fields: {
    id: field('id', 'Id', 'INTEGER', { isEditable: false }),
    siteId: field('siteId', 'Site', 'INTEGER', { possibleValueSourceName: 'site' }),
    name: field('name', 'Name', 'STRING', { maxLength: 255 }),
    shortName: field('shortName', 'Short Name', 'STRING', { maxLength: 100 }),
    slug: field('slug', 'Slug', 'STRING', { maxLength: 100 }),
    blogTypeId: field('blogTypeId', 'Blog Type', 'INTEGER', { possibleValueSourceName: 'blogType' }),
    description: field('description', 'Description', 'STRING', { maxLength: 1000 }),
    metaTitle: field('metaTitle', 'Meta Title', 'STRING', { maxLength: 255 }),
    metaDescription: field('metaDescription', 'Meta Description', 'STRING', { maxLength: 1000 }),
    metaKeywords: field('metaKeywords', 'Meta Keywords', 'STRING', { maxLength: 1000 }),
    publishDate: field('publishDate', 'Publish Date', 'DATE'),
    ...auditFields,
  },
  sections: [
    { name: 'identity', label: 'Blog', tier: 'T1', iconName: 'article', fieldNames: ['id', 'siteId', 'name', 'shortName', 'slug', 'blogTypeId'], isHidden: false },
    { name: 'details', label: 'Details', tier: 'T2', iconName: 'info', fieldNames: ['description', 'publishDate'], isHidden: false },
    { name: 'seo', label: 'SEO', tier: 'T2', iconName: 'search', fieldNames: ['metaTitle', 'metaDescription', 'metaKeywords'], isHidden: false },
    { name: 'dates', label: 'Dates', tier: 'T3', iconName: 'calendar_month', fieldNames: ['createDate', 'modifyDate'], isHidden: false },
  ],
}

export const siteRecords: QRecord[] = [
  {
    tableName: 'site',
    recordLabel: 'Kof22',
    values: {
      id: 1, name: 'Kof22', shortName: 'KofTwentyTwo Personal Site', description: 'Kof22 Personal Website for James Maes',
      launchDate: '2026-07-05', createDate: '2026-07-05T23:33:29Z', modifyDate: hoursAgo(3),
    },
    displayValues: { id: '1' },
  },
]

/**
 * A site domain record.
 *
 * @param id - Key.
 * @param name - Host name.
 * @param isPrimary - Primary domain flag.
 * @param description - Description.
 * @param createDate - Created instant.
 * @param modifyDate - Modified instant.
 * @returns The record.
 */
function domain(id: number, name: string, isPrimary: boolean, description: string, createDate: string, modifyDate: string): QRecord {
  return {
    tableName: 'siteDomain',
    recordLabel: name,
    values: { id, siteId: 1, name, shortName: name, fqdn: name, isPrimary, description, createDate, modifyDate },
    displayValues: { id: String(id), siteId: 'Kof22', isPrimary: isPrimary ? 'Yes' : 'No' },
  }
}

export const siteDomainRecords: QRecord[] = [
  domain(1, 'www.kof22.com', true, 'Primary base domain', '2026-07-05T23:33:29Z', '2026-07-05T23:33:29Z'),
  domain(2, 'kof22.com', false, 'Naked domain, redirect to www', '2026-07-05T23:33:29Z', '2025-11-02T15:04:00Z'),
  domain(3, 'koftwentytwo.com', false, 'Naked domain, redirect to www', hoursAgo(5), hoursAgo(5)),
  domain(4, 'www.koftwentytwo.com', false, 'Naked domain, redirect to www', hoursAgo(4.8), hoursAgo(1)),
]

const fieldNotes = 'Notes from the work of building systems, making decisions and understanding what changes along the way.'
const ideas = 'A CTO\'s perspective on how technical ideas become systems, and what those decisions mean for the people building and depending on them.'

export const siteBlogRecords: QRecord[] = [
  {
    tableName: 'siteBlog',
    recordLabel: 'Field Notes',
    values: {
      id: 1, siteId: 1, name: 'Field Notes', shortName: 'Field Notes', slug: 'quick-bits', blogTypeId: 1, description: fieldNotes,
      metaTitle: 'Field Notes - Engineering & Leadership', metaDescription: fieldNotes, metaKeywords: 'engineering, leadership, observations, systems',
      publishDate: '2026-07-06', createDate: '2026-07-05T23:33:29Z', modifyDate: '2026-10-10T11:01:39Z',
    },
    displayValues: { id: '1', siteId: 'Kof22', blogTypeId: 'Site Blog' },
  },
  {
    tableName: 'siteBlog',
    recordLabel: 'Ideas Into Systems',
    values: {
      id: 2, siteId: 1, name: 'Ideas Into Systems', shortName: 'Ideas Into Systems', slug: 'ideas-into-systems', blogTypeId: 1, description: ideas,
      metaTitle: 'Ideas Into Systems - A CTO\'s Perspective', metaDescription: ideas, metaKeywords: 'technology, architecture, leadership, engineering, systems',
      publishDate: '2025-03-14', createDate: '2026-07-05T23:33:29Z', modifyDate: hoursAgo(2),
    },
    displayValues: { id: '2', siteId: 'Kof22', blogTypeId: 'Site Blog' },
  },
]

/**
 * The `ChildRecordListRenderer` payload for a child table of site 1, as the backend sends it
 * (the join field is omitted and becomes the new child's default).
 *
 * @param table - Child table.
 * @param records - Child rows.
 * @param label - Widget label.
 * @returns The payload.
 */
function childList(table: QTableMetaData, records: QRecord[], label: string): Record<string, unknown> {
  return {
    type: 'childRecordList',
    title: label,
    label,
    childFrontendTableMetaData: table,
    queryOutput: { records },
    totalRows: records.length,
    viewAllLink: `/cms/sites/${table.name}?filter=${encodeURIComponent(JSON.stringify({ criteria: [{ fieldName: 'siteId', operator: 'EQUALS', values: [1] }] }))}`,
    defaultValuesForNewChildRecords: { siteId: 1 },
    omitFieldNames: ['siteId'],
    canAddChildRecord: false,
  }
}

/** Widget payloads served for the CMS widgets. */
export const cmsWidgetData: Record<string, () => unknown> = {
  siteDomains: () => childList(siteDomainTable, siteDomainRecords, 'Site Domains'),
  siteBlogs: () => childList(siteBlogTable, siteBlogRecords, 'Site Blogs'),
  cmsRecentBlogs: () => childList(siteBlogTable, siteBlogRecords, 'Recently Changed Blogs'),
  cmsSiteCount: () => ({ type: 'statistics', title: 'Sites', value: siteRecords.length, unit: 'sites' }),
  cmsDomainCount: () => ({ type: 'statistics', title: 'Domains', value: siteDomainRecords.length, unit: 'domains' }),
  cmsBlogCount: () => ({ type: 'statistics', title: 'Blogs', value: siteBlogRecords.length, unit: 'blogs' }),
}

export const cmsWidgets: Record<string, QWidgetMetaData> = {
  siteDomains: { name: 'siteDomains', label: 'Domains', type: 'childRecordList', hasPermission: true, showExportButton: true, showReloadButton: true },
  siteBlogs: { name: 'siteBlogs', label: 'Blogs', type: 'childRecordList', hasPermission: true, showExportButton: true, showReloadButton: true },
  cmsSiteCount: { name: 'cmsSiteCount', label: 'Sites', type: 'statistics', hasPermission: true, gridColumns: 4 },
  cmsDomainCount: { name: 'cmsDomainCount', label: 'Domains', type: 'statistics', hasPermission: true, gridColumns: 4 },
  cmsBlogCount: { name: 'cmsBlogCount', label: 'Blogs', type: 'statistics', hasPermission: true, gridColumns: 4 },
  cmsRecentBlogs: { name: 'cmsRecentBlogs', label: 'Recently Changed Blogs', type: 'childRecordList', hasPermission: true, gridColumns: 12 },
}

export const cmsTreeNode: QAppTreeNode = {
  name: 'cms',
  label: 'CMS',
  type: 'APP',
  iconName: 'web',
  children: [
    { name: 'site', label: 'Sites', type: 'TABLE', iconName: 'language' },
    { name: 'siteDomain', label: 'Domains', type: 'TABLE', iconName: 'dns' },
    { name: 'siteBlog', label: 'Blogs', type: 'TABLE', iconName: 'article' },
  ],
}

export const cmsApp: QAppMetaData = {
  name: 'cms',
  label: 'CMS',
  iconName: 'web',
  widgets: ['cmsSiteCount', 'cmsDomainCount', 'cmsBlogCount', 'cmsRecentBlogs'],
  children: cmsTreeNode.children ?? [],
  sections: [
    { name: 'sites', label: 'Sites', icon: { name: 'language' }, tables: ['site', 'siteDomain', 'siteBlog'], processes: [], reports: [] },
  ],
}
