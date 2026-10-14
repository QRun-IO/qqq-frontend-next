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

/** @file Realistic provider-owned notification and core-store regional preferences. */
import type { QFieldMetaData } from '@/types/metadata'
import type { PreferencesResponse } from '@/types/preferences'

/** Creates ordinary field metadata for preference fixtures.
 * @param name - Field name.
 * @param label - Display label.
 * @param type - Primitive field type.
 * @param source - Inline section enum source name.
 * @returns Complete metadata.
 */
const field = (
  name: string,
  label: string,
  type: QFieldMetaData['type'],
  source?: string
): QFieldMetaData => ({
  name,
  label,
  type,
  isEditable: true,
  isRequired: type === 'BOOLEAN',
  isHeavy: false,
  isHidden: false,
  adornments: [],
  possibleValueSourceName: source,
})
const options = (...ids: string[]) =>
  ids.map((id) => ({
    id,
    label: id
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^./, (s) => s.toUpperCase()),
  }))

export const preferencesFixture: PreferencesResponse = {
  sections: [
    {
      name: 'notifications',
      label: 'Notifications',
      description: 'What reaches you in the app and by email.',
      icon: { name: 'notifications' },
      order: 20,
      fields: [
        field('pausedUntil', 'Pause until', 'DATE_TIME'),
        field('digestHour', 'Daily digest hour', 'INTEGER', 'digestHours'),
        field('timeZone', 'Time zone', 'STRING'),
        field('alertEmailEnabled', 'Email alerts', 'BOOLEAN'),
        field('alertInAppEnabled', 'In-app alerts', 'BOOLEAN'),
      ],
      values: {
        pausedUntil: null,
        digestHour: 9,
        timeZone: 'America/Chicago',
        alertEmailEnabled: true,
        alertInAppEnabled: true,
      },
      possibleValues: {
        digestHours: Array.from({ length: 24 }, (_, id) => ({
          id,
          label: `${String(id).padStart(2, '0')}:00`,
        })),
        severities: options('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
        emailModes: options('OFF', 'IMMEDIATE', 'DAILY_DIGEST'),
        deliveryModes: options('IN_APP', 'EMAIL', 'BOTH'),
      },
      lists: [
        {
          name: 'categories',
          label: 'Categories',
          rowLabel: 'Category',
          description: 'Choose how each kind of notification reaches you.',
          fields: [
            field('inApp', 'In-app', 'BOOLEAN'),
            field('inAppMinSeverity', 'Minimum in-app severity', 'STRING', 'severities'),
            field('emailMode', 'Email delivery', 'STRING', 'emailModes'),
            field('emailMinSeverity', 'Minimum email severity', 'STRING', 'severities'),
          ],
          rows: ['SYSTEM', 'SECURITY', 'PRODUCT', 'ACCOUNT'].map((key) => ({
            key,
            label: key.charAt(0) + key.slice(1).toLowerCase(),
            values: {
              inApp: true,
              inAppMinSeverity: 'INFO',
              emailMode: 'IMMEDIATE',
              emailMinSeverity: 'WARNING',
            },
            readOnlyFields: key === 'SECURITY' ? ['inApp'] : [],
            readOnlyReason: key === 'SECURITY' ? "Security notices can't be muted" : null,
          })),
        },
        {
          name: 'subscriptions',
          label: 'Subscriptions',
          rowLabel: 'Subscription',
          fields: [
            field('enabled', 'Enabled', 'BOOLEAN'),
            field('minSeverity', 'Minimum severity', 'STRING', 'severities'),
            field('deliveryMode', 'Delivery mode', 'STRING', 'deliveryModes'),
          ],
          rows: [
            {
              key: 'order:42',
              label: 'Order processing',
              description: 'Updates to orders you follow.',
              values: { enabled: true, minSeverity: 'WARNING', deliveryMode: 'BOTH' },
              readOnlyFields: [],
            },
          ],
        },
      ],
    },
    {
      name: 'regional',
      label: 'Regional settings',
      description: 'Your time zone, date format and calendar.',
      icon: { name: 'language' },
      order: 30,
      fields: [
        field('timeZone', 'Time zone', 'STRING'),
        field('dateFormat', 'Date format', 'STRING', 'dateFormats'),
        field('weekStartsOn', 'Week starts on', 'STRING', 'weekDays'),
      ],
      values: { timeZone: 'America/Chicago', dateFormat: 'MM/dd/yyyy', weekStartsOn: 'SUNDAY' },
      lists: [],
      possibleValues: {
        dateFormats: ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'].map((id) => ({ id, label: id })),
        weekDays: options('SUNDAY', 'MONDAY'),
      },
    },
    {
      name: 'access-tokens',
      label: 'Access tokens',
      description: 'Manage tokens for your scripts and integrations.',
      icon: { name: 'key' },
      order: 40,
      showInUserMenu: true,
      fields: [],
      values: {},
      possibleValues: {},
      lists: [
        {
          name: 'tokens',
          label: 'Tokens',
          rowLabel: 'Token',
          fields: [
            field('description', 'Description', 'STRING'),
            field('expiresAt', 'Expires at', 'DATE_TIME'),
            field('lastUsedAt', 'Last used at', 'DATE_TIME'),
          ].map((item) => ({ ...item, isEditable: false })),
          rows: [
            {
              key: 'example-token',
              label: 'Development script',
              values: {
                description: 'Development script',
                expiresAt: '2027-01-01T00:00:00Z',
                lastUsedAt: '2026-10-12T12:00:00Z',
              },
              actionNames: ['rotate', 'revoke'],
            },
          ],
        },
      ],
      actions: [
        {
          name: 'create',
          label: 'Create token',
          scope: 'SECTION',
          order: 10,
          icon: { name: 'add' },
          inputFields: [
            { ...field('description', 'Description', 'STRING'), isRequired: true, maxLength: 100 },
            { ...field('expiresAt', 'Expires at', 'DATE_TIME'), isRequired: true },
          ],
        },
        {
          name: 'rotate',
          label: 'Rotate token',
          scope: 'ROW',
          listName: 'tokens',
          order: 20,
          confirmationText: 'Rotate this token? The old token will stop working immediately.',
        },
        {
          name: 'revoke',
          label: 'Revoke token',
          scope: 'ROW',
          listName: 'tokens',
          order: 30,
          isDestructive: true,
          confirmationText: 'Revoke this token? It will stop working immediately.',
        },
      ],
    },
  ],
}
