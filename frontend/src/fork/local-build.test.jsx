// @vitest-environment happy-dom
// The personal build end to end, with VITE_LOCAL=1: it boots straight into the app — no sign-in,
// no demo data, not one request to a server — in Russian, asks for a backup on Home once there is
// something to lose, and restores a backup only after showing what is in it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let useStore, useUI, effectiveLang, ui, backup, i18n
const fetchSpy = vi.fn(() => Promise.reject(new TypeError('offline')))

beforeAll(async () => {
  vi.stubEnv('VITE_LOCAL', '1')
  vi.resetModules()
  globalThis.fetch = fetchSpy
  localStorage.clear()
  await import('./init.js')
  ;({ useStore } = await import('../store/useStore.js'))
  ;({ useUI } = await import('../store/useUI.js'))
  ;({ effectiveLang } = await import('../lib/default-lang.js'))
  ui = await import('./ui.jsx')
  backup = await import('./backup.js')
  i18n = await import('../lib/i18n-core.js')
  await useStore.getState().boot()
})
afterAll(() => { vi.unstubAllEnvs() })

let root, el
const mount = async node => {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => { root.render(node) })
  return el
}
beforeEach(() => { if (root) { act(() => root.unmount()); el.remove(); root = null } })

const workout = (id, d) => ({ id, d, start: new Date(d).getTime(), end: new Date(d).getTime() + 3600e3, entries: [] })

describe('boot', () => {
  it('goes straight in as the local profile, with no data and no request to any server', () => {
    const st = useStore.getState()
    expect(st.ready).toBe(true)
    expect(st.isGuest()).toBe(true)
    expect(st.user).toBe(null)
    expect(st.S.workouts).toEqual([])
    expect(st.S.routines).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('starts in Russian, with no AI Coach and no server media on offer', () => {
    const { S, config } = useStore.getState()
    expect(effectiveLang(S, config, ['en-US'])).toBe('ru')
    expect(config.coach).toBeUndefined()
    expect(config.media).toBeUndefined()
  })
})

describe('the backup banner on Home', () => {
  it('stays away while there is nothing to lose, and shows once a workout exists', async () => {
    const box = await mount(<ui.ForkBackupBanner />)
    expect(box.textContent).toBe('')
    await act(async () => { useStore.getState().update(s => { s.workouts = [workout('w1', '2026-09-20')] }) })
    expect(box.textContent).toMatch(/Time to save a backup/)
  })

  it('goes once a backup is saved, and comes back after 7 days', async () => {
    const box = await mount(<ui.ForkBackupBanner />)
    await act(async () => { backup.markBackup(Date.now()) })
    expect(box.textContent).toBe('')
    await act(async () => { backup.markBackup(Date.now() - 8 * backup.DAY_MS) })
    expect(box.textContent).toMatch(/8 days ago/)
  })

  it('speaks Russian in the Russian app', async () => {
    i18n._setLangState('ru', {}, null, null)
    try {
      const box = await mount(<ui.ForkBackupBanner />)
      expect(box.textContent).toMatch(/Пора сохранить бэкап/)
      expect(box.textContent).toMatch(/8 дней назад/)
    } finally { i18n._setLangState('en', {}, null, null) }
  })
})

describe('the workout-complete button', () => {
  it('is there in the personal build', async () => {
    const box = await mount(<ui.ForkFinishBackupButton />)
    expect(box.querySelector('button').textContent).toBe('Save backup')
  })
})

describe('loading a backup', () => {
  it('previews the file, and replaces the data only on confirm', async () => {
    useStore.getState().update(s => { s.workouts = [workout('mine', '2026-09-25')] })
    const inFile = {
      ...useStore.getState().S,
      workouts: [workout('a', '2024-03-12'), workout('b', '2026-09-20'), workout('c', '2025-06-01')],
      routines: [{ id: 'r1', name: 'Push', ex: [] }],
    }
    const openSheet = vi.fn()
    useUI.setState({ openSheet })

    const box = await mount(<ui.ForkSettingsSections />)
    expect(box.textContent).toMatch(/Save backup/)
    expect(box.textContent).toMatch(/Load backup/)
    expect(box.textContent).toMatch(/Download media for offline/)
    const input = box.querySelector('input[type=file]')
    const file = new File([JSON.stringify(inFile)], 'opengym-2026-09-20.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(openSheet).toHaveBeenCalled())

    // Nothing replaced yet: the sheet only shows what the file holds.
    expect(useStore.getState().S.workouts.map(w => w.id)).toEqual(['mine'])
    const close = vi.fn()
    const sheet = await mount(openSheet.mock.calls[0][0](close))
    expect(sheet.textContent).toMatch(/3 workouts/)
    expect(sheet.textContent).toMatch(/2024/)
    expect(sheet.textContent).toMatch(/1 routine\b/)
    expect(sheet.textContent).toMatch(/On this phone now1 workout/)

    const confirm = [...sheet.querySelectorAll('button')].find(b => /Replace with the backup/.test(b.textContent))
    await act(async () => { confirm.click() })
    await vi.waitFor(() => expect(useStore.getState().S.workouts.map(w => w.id).sort()).toEqual(['a', 'b', 'c']))
    expect(close).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts).toHaveLength(3)
  })

  it('refuses a file that is not an openGym backup, touching nothing', async () => {
    const openSheet = vi.fn()
    const toast = vi.fn()
    useUI.setState({ openSheet, toast })
    const before = useStore.getState().S
    const box = await mount(<ui.ForkSettingsSections />)
    const input = box.querySelector('input[type=file]')
    Object.defineProperty(input, 'files', { value: [new File(['{"hello":1}'], 'notes.json')], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('This file is not an openGym backup'))
    expect(openSheet).not.toHaveBeenCalled()
    expect(useStore.getState().S).toBe(before)
  })

  it('never asked a server for anything along the way', () => {
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
