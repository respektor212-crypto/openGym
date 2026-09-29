// @vitest-environment happy-dom
// Manual backups (fork/backup.js): the file is upstream's JSON export under a dated name, it goes
// to the share sheet when files can be shared and is downloaded otherwise, and the Home banner
// asks for one once the last is more than a week old.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backupFileName, backupJson, backupDue, daysSince, summarizeBackup, saveBackup,
  lastBackupAt, markBackup, subscribeBackup, LAST_BACKUP_KEY, DAY_MS,
} from './backup.js'
import { readBackupFile } from '../lib/backup-media.js'

const NOW = new Date(2026, 8, 29, 18, 30).getTime()
const S = { unit: 'kg', routines: [{ id: 'r1', ex: [] }], bodyweight: [{ d: '2026-09-01', w: 80 }], workouts: [
  { id: 'a', d: '2024-03-12', start: 1, end: 2 },
  { id: 'b', d: '2026-09-28', start: 3, end: 4 },
  { id: 'c', d: '2025-01-05', start: 5, end: 6 },
] }

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.useRealTimers() })

describe('the backup file', () => {
  it('is named opengym-YYYY-MM-DD.json after the local date', () => {
    expect(backupFileName('2026-09-29')).toBe('opengym-2026-09-29.json')
    vi.useFakeTimers({ now: new Date(2026, 0, 3, 23, 59) })
    expect(backupFileName()).toBe('opengym-2026-01-03.json')
  })

  it('holds the whole state, exactly as upstream exports it — and upstream reads it back', async () => {
    const json = backupJson(S)
    expect(json).toBe(JSON.stringify(S, null, 2))
    const read = await readBackupFile(new File([json], backupFileName('2026-09-29'), { type: 'application/json' }))
    expect(read.zip).toBe(false)
    expect(read.state.workouts.map(w => w.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('when to ask for a backup', () => {
  it('never while there is no workout to lose', () => {
    expect(backupDue({ workouts: [] }, null, NOW)).toBe(false)
    expect(backupDue({}, null, NOW)).toBe(false)
  })
  it('at once when a workout exists and no backup was ever saved', () => {
    expect(backupDue(S, null, NOW)).toBe(true)
  })
  it('not within 7 days of the last backup, and from then on', () => {
    expect(backupDue(S, NOW - 7 * DAY_MS, NOW)).toBe(false)
    expect(backupDue(S, NOW - 7 * DAY_MS - 1, NOW)).toBe(true)
    expect(backupDue(S, NOW - 1, NOW)).toBe(false)
  })
  it('counts whole days since', () => {
    expect(daysSince(NOW - 8 * DAY_MS - 5, NOW)).toBe(8)
    expect(daysSince(NOW + 5, NOW)).toBe(0)
  })
})

describe('the preview of a file', () => {
  it('counts workouts and finds their date range whatever their order', () => {
    expect(summarizeBackup(S)).toEqual({ workouts: 3, from: '2024-03-12', to: '2026-09-28', routines: 1, weighIns: 1 })
  })
  it('copes with an empty or odd state', () => {
    expect(summarizeBackup({ workouts: [], routines: [] })).toEqual({ workouts: 0, from: null, to: null, routines: 0, weighIns: 0 })
    expect(summarizeBackup({ workouts: [{ d: 'yesterday' }, null], routines: [] })).toMatchObject({ workouts: 2, from: null, to: null })
  })
})

describe('the last-backup mark', () => {
  it('is kept on this device and announced', () => {
    const seen = vi.fn()
    const off = subscribeBackup(seen)
    expect(lastBackupAt()).toBe(null)
    markBackup(NOW)
    expect(lastBackupAt()).toBe(NOW)
    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBe(String(NOW))
    expect(seen).toHaveBeenCalledTimes(1)
    off()
  })
  it('reads garbage as never', () => {
    localStorage.setItem(LAST_BACKUP_KEY, 'soon')
    expect(lastBackupAt()).toBe(null)
  })
})

describe('saving', () => {
  const docStub = () => {
    const a = { click: vi.fn(), remove: vi.fn() }
    return { a, doc: { createElement: vi.fn(() => a), body: { appendChild: vi.fn() } } }
  }

  it('hands a dated JSON file to the share sheet when files can be shared', async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 12) })
    const share = vi.fn(() => Promise.resolve())
    const nav = { canShare: vi.fn(() => true), share }
    const { doc } = docStub()
    expect(await saveBackup(S, { nav, doc, now: () => NOW })).toBe('shared')
    const file = share.mock.calls[0][0].files[0]
    expect(file.name).toBe('opengym-2026-09-29.json')
    expect(file.type).toBe('application/json')
    expect(JSON.parse(await file.text())).toEqual(S)
    expect(doc.createElement).not.toHaveBeenCalled()
    expect(lastBackupAt()).toBe(NOW)
  })

  it('a dismissed share sheet saves nothing and leaves the date alone', async () => {
    const nav = { canShare: () => true, share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) }
    const { doc } = docStub()
    expect(await saveBackup(S, { nav, doc })).toBe('cancelled')
    expect(doc.createElement).not.toHaveBeenCalled()
    expect(lastBackupAt()).toBe(null)
  })

  it('downloads the file when sharing files is not available', async () => {
    const { a, doc } = docStub()
    expect(await saveBackup(S, { nav: {}, doc, now: () => NOW })).toBe('downloaded')
    expect(a.download).toMatch(/^opengym-\d{4}-\d{2}-\d{2}\.json$/)
    expect(a.click).toHaveBeenCalled()
    expect(lastBackupAt()).toBe(NOW)
  })

  it('downloads when the share sheet refuses for another reason (an expired gesture)', async () => {
    const nav = { canShare: () => true, share: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) }
    const { a, doc } = docStub()
    expect(await saveBackup(S, { nav, doc })).toBe('downloaded')
    expect(a.click).toHaveBeenCalled()
  })

  it('downloads when the browser says it cannot share this file', async () => {
    const nav = { canShare: () => false, share: vi.fn() }
    const { a, doc } = docStub()
    expect(await saveBackup(S, { nav, doc })).toBe('downloaded')
    expect(nav.share).not.toHaveBeenCalled()
    expect(a.click).toHaveBeenCalled()
  })
})
