/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'

/** Simulate only Google's SDK scripts; application metadata, CSP and process execution stay real. */
export async function installGoogleDriveProvider(page: Page) {
  await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    window.google = window.google || {};
    window.google.accounts = { oauth2: { initTokenClient(config) {
      if (config.client_id !== 'owned-test-client' || config.scope !== 'https://www.googleapis.com/auth/drive') throw new Error('Incorrect OAuth configuration');
      return { requestAccessToken() { queueMicrotask(() => config.callback({ access_token: 'owned-synthetic-token', scope: config.scope, expires_in: 3600 })); } };
    } } };
  ` }))
  await page.route('https://apis.google.com/js/api.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    window.google = window.google || {};
    class DocsView {
      constructor(id) { this.id = id; }
      setIncludeFolders(value) { this.folders = value; return this; }
      setSelectFolderEnabled(value) { this.select = value; return this; }
      setEnableDrives(value) { this.drives = value; return this; }
      setMode(value) { this.mode = value; return this; }
    }
    class PickerBuilder {
      addView(view) { this.view = view; return this; }
      setOAuthToken(token) { if (token !== 'owned-synthetic-token') throw new Error('Incorrect OAuth token'); return this; }
      setDeveloperKey(key) { if (key !== 'owned-test-key') throw new Error('Incorrect API key'); return this; }
      setOrigin(origin) { if (origin !== location.origin) throw new Error('Incorrect picker origin'); return this; }
      enableFeature(feature) { if (feature !== 'supportDrives') throw new Error('Incorrect picker feature'); return this; }
      setCallback(callback) { this.callback = callback; return this; }
      build() {
        if (!this.view.drives || !this.view.folders || !this.view.select || this.view.mode !== 'list') throw new Error('Incorrect shared-drive folder view');
        const dialog = document.createElement('dialog');
        dialog.setAttribute('aria-label', 'Google provider fixture');
        for (const [label, response] of [
          ['Exports folder', { action: 'picked', docs: [{ id: 'folder-owned', name: 'Exports', mimeType: 'application/vnd.google-apps.folder' }] }],
          ['A file', { action: 'picked', docs: [{ id: 'file-owned', name: 'Export.csv', mimeType: 'text/csv' }] }],
          ['Cancel selection', { action: 'cancel' }]
        ]) {
          const button = document.createElement('button');
          button.textContent = label;
          button.onclick = () => this.callback(response);
          dialog.appendChild(button);
        }
        document.body.appendChild(dialog);
        return { setVisible(visible) { if (visible) dialog.showModal(); else dialog.close(); }, dispose() { dialog.close(); dialog.remove(); } };
      }
    }
    window.google.picker = { DocsView, PickerBuilder, ViewId: { FOLDERS: 'folders' }, DocsViewMode: { LIST: 'list' }, Feature: { SUPPORT_DRIVES: 'supportDrives' } };
  ` }))
}
