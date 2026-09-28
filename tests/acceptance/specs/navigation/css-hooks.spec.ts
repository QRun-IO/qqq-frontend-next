/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material Dashboard CSS and test hook parity (QRun-IO/qqq#731): the data-qqq-id values and
// class hooks that app custom CSS written for Material targets, on the equivalent Next UI.
import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { openForm, openRecord, sqlCount, sqlOne } from '../records/helpers'
import { appNavigation, v1MetaData, waitForShell } from './nav-helpers'

/** Material's id sanitizer (qqqIdUtils.sanitizeId), written out here as the independent oracle. */
function materialId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50)
}

/** Adds app custom CSS the way a MaterialDashboardThemeMetaData.customCss style element does. */
async function customCss(page: Page, css: string) {
  await page.addStyleTag({ content: css })
}

/** A computed style property of the first element a locator matches. */
function computed(locator: Locator, property: string): Promise<string> {
  return locator.first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property)
}

test.describe('Material CSS and test hooks', () => {
  test('[NAV-055] sidebar, app home and banners carry the Material hooks, and app CSS keyed to them applies @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await v1MetaData(backend)
    expect(meta.apps.navLevelOne.label).toBe('Nav Level One')
    await open(page, '/app/navLevelOne')
    await waitForShell(page)
    await customCss(page, [
      '[data-qqq-id="sidenav-root"] { background-color: rgb(12, 34, 56) }',
      '.qqq-sidebar-active { outline: 3px solid rgb(200, 10, 20) !important }',
      '[data-qqq-id="sidenav-nav-level-one"] { border-left: 4px solid rgb(1, 2, 3) !important }',
      '.banner.warning { outline: 2px solid rgb(4, 5, 6) }',
      '[data-qqq-id="app-card-navleveltwo-icon"] { color: rgb(7, 8, 9) !important }',
    ].join('\n'))

    // Banners: class "banner {severity}" (Material Banners.tsx)
    await expect(page.getByRole('region', { name: 'Site banner' })).toHaveClass(/(^|\s)banner(\s|$)/)
    await expect(page.getByRole('region', { name: 'Site banner' })).toHaveClass(/(^|\s)info(\s|$)/)
    const body = page.getByRole('main').getByRole('region', { name: 'Page banner' })
    await expect(body).toHaveClass(/(^|\s)banner(\s|$)/)
    await expect(body).toHaveClass(/(^|\s)warning(\s|$)/)
    await expect.poll(() => computed(body, 'outline-color')).toBe('rgb(4, 5, 6)')

    // App home: the child app card icon is app-card-{sanitized app name}-icon
    const childCard = page.getByRole('main').getByRole('link', { name: 'Nav Level Two' })
    const icon = childCard.locator(`[data-qqq-id="app-card-${materialId('navLevelTwo')}-icon"]`)
    await expect(icon).toHaveCount(1)
    await expect.poll(() => computed(icon, 'color')).toBe('rgb(7, 8, 9)')

    // Sidebar: root, logo area, menu list, one sidenav-{label} per entry, active item and item types
    const nav = await appNavigation(page)
    const sidebar = page.getByRole('complementary', { name: 'Main navigation' })
    const root = sidebar.locator('[data-qqq-id="sidenav-root"]')
    await expect(root).toBeVisible()
    await expect.poll(() => computed(root, 'background-color')).toBe('rgb(12, 34, 56)')
    await expect(root.locator('[data-qqq-id="sidenav-logo-area"]').getByRole('img', { name: 'QQQ Sample' })).toBeVisible()
    const list = nav.locator(':scope > [data-qqq-id="sidenav-menu-list"]')
    await expect(list).toHaveCount(1)
    const entries = await list.locator(':scope > li').evaluateAll((items) => items.map((item) => ({
      id: item.getAttribute('data-qqq-id'),
      label: (item.querySelector(':scope > a, :scope > div > a')?.textContent ?? '').trim(),
    })))
    expect(entries.length).toBeGreaterThan(3)
    for (const entry of entries) expect(entry.id, entry.label).toBe(`sidenav-${materialId(entry.label)}`)
    expect(entries.map((entry) => entry.label)).toContain('Nav Level One')

    // The highlighted entry (this app's home) is the only .qqq-sidebar-active and a top-level parent app
    const active = nav.locator('.qqq-sidebar-active')
    await expect(active).toHaveCount(1)
    await expect(active).toHaveAttribute('data-qqq-sidenav-item-type', 'top-level-parent-app')
    await expect(active.getByRole('link', { name: 'Nav Level One' })).toBeVisible()
    await expect.poll(() => computed(active, 'outline-color')).toBe('rgb(200, 10, 20)')
    await expect.poll(() => computed(nav.locator('[data-qqq-id="sidenav-nav-level-one"]'), 'border-left-color')).toBe('rgb(1, 2, 3)')
    // Every top-level app group (an entry with an expand toggle) is a top-level parent app; links are not typed
    const typed = await list.locator('[data-qqq-sidenav-item-type="top-level-parent-app"]').count()
    expect(typed).toBeGreaterThan(0)
    await expect(list.locator(':scope > li > a[data-qqq-sidenav-item-type]')).toHaveCount(0)

    // User profile entry and the logout entry of its menu
    const profile = sidebar.locator('[data-qqq-sidenav-item-type="user-profile"]')
    await expect(profile).toHaveAttribute('data-qqq-id', 'sidebar-user-button')
    await profile.click()
    await expect(sidebar.getByRole('menuitem', { name: 'Log Out' })).toHaveAttribute('data-qqq-id', 'sidenav-logout-button')
    await page.keyboard.press('Escape')
    await expect(sidebar.getByRole('menuitem', { name: 'Log Out' })).toHaveCount(0)
  })

  test('[NAV-055] create and edit forms carry record-{mode} hooks, section and field wrappers, and default button variants @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const person = await (await backend.api.get('/qqq/v1/metaData/table/person')).json() as {
      fields: Record<string, { isEditable?: boolean }>
      sections: { name: string; label: string; isHidden?: boolean; fieldNames?: string[] }[]
    }
    const editableSections = person.sections.filter((section) => !section.isHidden && (section.fieldNames ?? []).some((name) => person.fields[name]?.isEditable))
    expect(editableSections.map((section) => section.name)).toEqual(expect.arrayContaining(['identity', 'basicInfo', 'employmentInfo']))

    await openForm(page, '/app/person/create', 'Create Person')
    await customCss(page, '[data-qqq-id="input-firstname"] input { background-color: rgb(250, 240, 200) !important } .stickyBottomButtonBar [data-button-variant="gradient"] { outline: 2px solid rgb(9, 9, 9) !important }')
    const form = page.locator('[data-qqq-id="record-create-person"]')
    await expect(form).toHaveClass(/(^|\s)entityForm(\s|$)/)
    await expect(form.locator('form[data-qqq-id="entity-form-person"]')).toHaveCount(1)
    await expect(form.locator('[data-qqq-id="record-create-header-person"] [data-qqq-id="record-create-title-person"]')).toHaveText('Creating New Person')
    for (const section of editableSections) {
      const wrapper = form.locator(`[data-qqq-id="form-section-${materialId(section.name)}"]`)
      await expect(wrapper, section.name).toHaveClass(/form-section-wrapper.*is-visible|is-visible.*form-section-wrapper/)
      const sectionHeading = wrapper.locator(`[data-qqq-id="form-section-header-${materialId(section.name)}"]`)
      await expect(sectionHeading).toHaveText(section.label)
    }
    // Field wrappers: input-{field}, switch-{boolean field}, all visible (Next does not render hidden fields)
    const firstName = form.locator('[data-qqq-id="input-firstname"]')
    await expect(firstName).toHaveClass(/(^|\s)field-wrapper(\s|$)/)
    await expect(firstName).toHaveClass(/(^|\s)is-visible(\s|$)/)
    await expect(firstName.getByLabel('First Name')).toBeVisible()
    await expect.poll(() => computed(firstName.getByLabel('First Name'), 'background-color')).toBe('rgb(250, 240, 200)')
    await expect(form.locator('[data-qqq-id="input-email"]').getByLabel('Email')).toBeVisible()
    await expect(form.locator('[data-qqq-id="switch-isemployed"]')).toHaveClass(/(^|\s)field-wrapper(\s|$)/)
    await expect(form.locator('.field-wrapper.is-hidden')).toHaveCount(0)
    // The button bar: sticky, with Material's save (gradient) and cancel (outlined) buttons
    const bar = form.locator('[data-qqq-id="record-create-button-bar-person"]')
    await expect(bar).toHaveClass(/(^|\s)stickyBottomButtonBar(\s|$)/)
    await expect(bar.locator('[data-qqq-id="button-save"]')).toHaveAttribute('data-button-variant', 'gradient')
    await expect(bar.locator('[data-qqq-id="button-cancel"]')).toHaveAttribute('data-button-variant', 'outlined')
    await expect.poll(() => computed(bar.locator('[data-qqq-id="button-save"]'), 'outline-color')).toBe('rgb(9, 9, 9)')

    // Edit mode, and a possible-value field is select-{field}
    const { first_name: first } = await sqlOne(backend, 'select first_name from person where id = 5')
    await openForm(page, '/app/person/5/edit', 'Edit Person')
    await expect(page.locator('[data-qqq-id="record-edit-person"]')).toHaveClass(/(^|\s)entityForm(\s|$)/)
    await expect(page.locator('[data-qqq-id="record-edit-button-bar-person"]')).toHaveClass(/(^|\s)stickyBottomButtonBar(\s|$)/)
    await expect(page.locator('[data-qqq-id="record-edit-person"] [data-qqq-id="input-firstname"]').getByLabel('First Name')).toHaveValue(first!)

    await openForm(page, '/app/pet/create', 'Create Pet')
    const pet = page.locator('[data-qqq-id="record-create-pet"]')
    await expect(pet.locator('[data-qqq-id="select-personid"]')).toHaveClass(/(^|\s)field-wrapper(\s|$)/)
    await expect(pet.locator('[data-qqq-id="select-personid"]').getByRole('combobox')).toBeVisible()
    await expect(pet.locator('[data-qqq-id="select-speciesid"]').getByRole('combobox')).toBeVisible()
  })

  test('[NAV-055] the record view carries recordView, header, actions and delete-confirmation hooks, and the yes and no buttons do what they say @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const { first_name: first, last_name: last } = await sqlOne(backend, 'select first_name, last_name from person where id = 5')
    const label = `${first} ${last}`
    await openRecord(page, 'person', 5, label)
    await customCss(page, '[data-qqq-id="record-view-title-person"] { text-decoration-line: underline }')
    const view = page.locator('.recordView')
    await expect(view.locator('[data-qqq-id="record-view-person"]')).toHaveCount(1)
    const header = view.locator('[data-qqq-id="record-view-header-person"]')
    await expect(header.locator('[data-qqq-id="record-view-header"]')).toHaveCount(1)
    await expect(header.locator('[data-qqq-id="record-view-avatar-person"]')).toBeVisible()
    await expect(header.locator('[data-qqq-id="record-view-title-person"]')).toHaveText(label)
    await expect.poll(() => computed(header.locator('[data-qqq-id="record-view-title-person"]'), 'text-decoration-line')).toBe('underline')
    await expect(view.locator('[data-qqq-id="record-view-button-bar-person"]')).toHaveCount(1)

    const sheetTrigger = page.locator('[data-qqq-id="button-mobile-actions"]')
    const phone = await sheetTrigger.isVisible()
    const openDelete = async () => {
      if (phone) {
        await sheetTrigger.click()
        await page.getByRole('dialog', { name: 'Record actions' }).getByRole('button', { name: 'Delete Person', exact: true }).click()
        return
      }
      await page.getByRole('button', { name: 'Record actions menu' }).click()
      await page.locator('[data-qqq-id="record-view-actions-menu"] [data-qqq-id="menu-item-delete"]').click()
    }

    if (phone) {
      // Phones show sections as an accordion; the tab bar (Next's section navigation) is desktop only
      await expect(page.locator('[data-qqq-id="record-view-accordion"]')).toBeVisible()
      await expect(page.locator('[data-qqq-id="record-sidebar"]')).toBeHidden()
    } else {
      const sidebar = page.locator('[data-qqq-id="record-sidebar"]')
      await expect(view.getByRole('tablist')).toBeVisible()
      if (await sidebar.isVisible()) {
        await expect(sidebar.locator('[data-qqq-id="sidebar-item-identity"]')).toHaveClass(/sidebar-section.*is-visible/)
      } else {
        // The tablet width has tabs and desktop actions, while the lg-only sidebar stays hidden.
        await expect(sidebar).toBeHidden()
      }
      const trigger = page.locator('[data-qqq-id="record-view-actions-menu-button"] [data-qqq-id="button-actions-menu"]')
      await expect(trigger).toHaveAttribute('data-button-variant', 'outlined')
      await trigger.click()
      const menu = page.locator('[data-qqq-id="record-view-actions-menu"]')
      await expect(menu).toBeVisible()
      for (const item of ['menu-item-edit', 'menu-item-copy', `menu-item-${materialId('clonePeople')}`, 'menu-item-delete']) {
        await expect(menu.locator(`[data-qqq-id="${item}"]`), item).toHaveCount(1)
      }
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
    }

    await openDelete()
    const dialog = page.locator('[data-qqq-id="delete-confirm-dialog"] [data-qqq-id="delete-confirmation-dialog"]')
    await expect(dialog.locator('[data-qqq-id="delete-confirmation-title"]')).toHaveText('Delete Person')
    await expect(dialog.locator('[data-qqq-id="delete-confirmation-text"]')).toContainText(`Are you sure you want to delete ${label}?`)
    const actions = dialog.locator('[data-qqq-id="delete-confirmation-actions"]')
    await actions.locator('[data-qqq-id="button-delete-no"]').click()
    await expect(page.locator('[data-qqq-id="delete-confirm-dialog"]')).toHaveCount(0)
    expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(1)

    await openDelete()
    await page.locator('[data-qqq-id="delete-confirmation-actions"] [data-qqq-id="button-delete-yes"]').click()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(0)
  })

  test('[NAV-055] the query screen carries create-new, filter-builder, views, table-header and menu-item hooks that app CSS can hide or restyle', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await v1MetaData(backend)
    await open(page, '/app/person')
    await expect(page.getByRole('grid', { name: 'Person records' })).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-create-new"]')).toHaveAttribute('data-button-variant', 'gradient')
    await expect(page.locator('[data-qqq-id="button-create-new"]')).toHaveAccessibleName('Create new Person record')
    await expect(page.locator('[data-qqq-id="button-filter-builder"] [data-qqq-id="button-filter"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-views"] [data-qqq-id="button-saved-views"]')).toBeVisible()
    if ((await page.locator('[data-qqq-id="button-query-mode-basic"]').count()) === 0) {
      await page.locator('[data-qqq-id="button-filter"]').click()
    }
    const basicMode = page.locator('[data-qqq-id="button-query-mode-basic"]')
    const advancedMode = page.locator('[data-qqq-id="button-query-mode-advanced"]')
    await expect(basicMode).toHaveText('Basic')
    await expect(advancedMode).toHaveText('Advanced')
    const header = page.locator('th[data-qqq-id="table-header-firstname"]')
    await expect(header).toContainText('First Name')

    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    const menu = page.getByRole('menu', { name: 'Actions' })
    const hooks = await menu.locator('[data-qqq-id^="menu-item-"]').evaluateAll((items) => items.map((item) => ({
      id: item.getAttribute('data-qqq-id'), label: (item.textContent ?? '').trim(),
    })))
    expect(hooks.length).toBeGreaterThan(0)
    for (const hook of hooks) expect(hook.id, hook.label).toBe(`menu-item-${materialId(hook.label)}`)
    expect(hooks.map((hook) => hook.id)).toEqual(expect.arrayContaining(['menu-item-bulk-edit', 'menu-item-bulk-delete']))
    const clone = meta.processes.clonePeople.label
    expect(hooks.map((hook) => hook.label)).toContain(clone)

    // Material-targeted app CSS: hide the bulk entries and the filter builder button, restyle a header
    await customCss(page, '[data-qqq-id^="menu-item-bulk"] { display: none } [data-qqq-id="button-filter-builder"] { display: none } [data-qqq-id="button-query-mode-advanced"] { outline: 3px solid rgb(30, 60, 90) } [data-qqq-id="table-header-firstname"] { background-color: rgb(20, 40, 60) }')
    await expect(menu.getByRole('menuitem', { name: 'Bulk Edit' })).toBeHidden()
    await expect(menu.getByRole('menuitem', { name: clone })).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-filter"]')).toBeHidden()
    await expect.poll(() => computed(advancedMode, 'outline-color')).toBe('rgb(30, 60, 90)')
    await expect.poll(() => computed(header, 'background-color')).toBe('rgb(20, 40, 60)')
  })
})
