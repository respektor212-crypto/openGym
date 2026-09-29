// Manual backups for the personal build: one JSON file, handed to the iOS share sheet ("Save to
// Files" → "On My iPhone") or, where sharing files is not available, downloaded. Works offline —
// nothing here touches the network.
//
// The file is exactly upstream's JSON export (Settings → Export backup): the whole state, pretty-
// printed. Upstream's import (lib/backup-media.js readBackupFile + the store's importBackup) reads
// it back, and so does any upstream build.
import { todayISO } from '../lib/format.js'

// When the last backup was saved on this device (ms). A device fact, not part of the state: it
// would otherwise travel inside the backups themselves, and a restored file would claim a backup
// date that belongs to another moment.
export const LAST_BACKUP_KEY = 'gym_fork_last_backup'
export const BACKUP_DUE_DAYS = 7
export const DAY_MS = 24 * 60 * 60 * 1000

export const backupFileName = (iso = todayISO()) => 'opengym-' + iso + '.json'

/** The backup's content — the same JSON upstream's "Export backup (JSON)" writes. */
export const backupJson = S => JSON.stringify(S, null, 2)

const subs = new Set()
/** For useSyncExternalStore: the banner and Settings follow a backup saved anywhere in the app. */
export const subscribeBackup = fn => { subs.add(fn); return () => subs.delete(fn) }

export function lastBackupAt(storage = globalThis.localStorage) {
  try {
    const v = Number(storage?.getItem(LAST_BACKUP_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

export function markBackup(ts = Date.now(), storage = globalThis.localStorage) {
  try { storage?.setItem(LAST_BACKUP_KEY, String(ts)) } catch { /* storage blocked: the banner stays */ }
  subs.forEach(fn => fn())
}

/**
 * Whether the Home screen should ask for a backup: there is at least one workout to lose, and
 * none was ever saved on this device or the last one is older than BACKUP_DUE_DAYS.
 */
export function backupDue(S, last, now = Date.now()) {
  if (!(Array.isArray(S?.workouts) && S.workouts.length > 0)) return false
  return !last || now - last > BACKUP_DUE_DAYS * DAY_MS
}

export const daysSince = (last, now = Date.now()) => Math.max(0, Math.floor((now - last) / DAY_MS))

/** What a backup holds, for the preview before it replaces anything. */
export function summarizeBackup(state) {
  const ws = Array.isArray(state?.workouts) ? state.workouts : []
  const dates = ws.map(w => w?.d).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  return {
    workouts: ws.length,
    from: dates[0] || null,
    to: dates[dates.length - 1] || null,
    routines: Array.isArray(state?.routines) ? state.routines.length : 0,
    weighIns: Array.isArray(state?.bodyweight) ? state.bodyweight.length : 0,
  }
}

/**
 * Save a backup of `S`. Shares the file where the browser can share files (iOS Safari, including
 * the Home Screen app), downloads it otherwise. Resolves 'shared', 'downloaded' or 'cancelled'
 * (the share sheet was dismissed: nothing saved, the date is not moved).
 *
 * Must be called straight from a tap: Safari only opens the share sheet with the user's gesture
 * still active, so nothing asynchronous happens before `share()`.
 */
export async function saveBackup(S, { nav = globalThis.navigator, doc = globalThis.document, now = () => Date.now(), storage } = {}) {
  const name = backupFileName()
  const json = backupJson(S)
  const type = 'application/json'
  let file = null
  try { file = new File([json], name, { type }) } catch { file = null }
  let canShare = false
  try { canShare = !!(file && typeof nav?.share === 'function' && nav.canShare?.({ files: [file] })) } catch { canShare = false }
  if (canShare) {
    try {
      await nav.share({ files: [file] })
      markBackup(now(), storage)
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
      // NotAllowedError (the gesture expired) or a share target that failed: fall through to a
      // plain download, so the tap still ends with a file.
    }
  }
  download(new Blob([json], { type }), name, doc)
  markBackup(now(), storage)
  return 'downloaded'
}

function download(blob, name, doc) {
  const url = URL.createObjectURL(blob)
  const a = doc.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  doc.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
