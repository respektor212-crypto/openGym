// The personal build's screens: Settings → Backup and Offline exercise media, the backup banner on
// Home, and the backup button on the "Workout complete!" sheet. Each export renders nothing unless
// VITE_LOCAL=1, so the upstream files that mount them stay upstream in every other build.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { dateLocale } from '../lib/i18n-core.js'
import { limitsFrom } from '../lib/media-limits.js'
import { Section, Row, Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { LOCAL } from './flags.js'
import { ft, count } from './strings.js'
import { saveBackup, lastBackupAt, subscribeBackup, backupDue, daysSince, summarizeBackup } from './backup.js'
import { offlineMediaUrls, countCached, downloadMedia } from './media-offline.js'

const toast = msg => useUI.getState().toast(msg)
const useLastBackup = () => useSyncExternalStore(subscribeBackup, () => lastBackupAt())

const fmtWhen = ts => new Date(ts).toLocaleString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtDay = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMB = bytes => (bytes / (1024 * 1024)).toFixed(1) + ' ' + ft('MB')

// Straight from the tap: Safari opens the share sheet only while the gesture is still active.
async function saveNow() {
  try {
    const r = await saveBackup(useStore.getState().S)
    if (r !== 'cancelled') toast(ft('Backup saved'))
    return r
  } catch {
    toast(ft('Could not save the backup'))
    return 'failed'
  }
}

/* ---------------------------------------------------------------- restore */

function RestorePreview({ name, inFile, onPhone, close, onConfirm }) {
  const range = s => (s.from && s.to ? ' · ' + ft('from {0} to {1}', fmtDay(s.from), fmtDay(s.to)) : '')
  const box = { background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, textAlign: 'start' }
  return <div style={{ padding: '4px 0' }}>
    <h3 style={{ textAlign: 'center', marginBottom: 4 }}>{ft('Load this backup?')}</h3>
    <div className="small dim" style={{ textAlign: 'center', marginBottom: 14, overflowWrap: 'anywhere' }}>{name}</div>
    <div style={box}>
      <div className="small dim">{ft('In the file')}</div>
      <div style={{ fontWeight: 600 }}>{count(inFile.workouts, 'workout')}{range(inFile)}</div>
      <div className="small muted">{count(inFile.routines, 'routine')} · {count(inFile.weighIns, 'weighIn')}</div>
    </div>
    <div style={box}>
      <div className="small dim">{ft('On this phone now')}</div>
      <div>{count(onPhone.workouts, 'workout')}{range(onPhone)}</div>
    </div>
    <div className="muted small" style={{ textAlign: 'center', margin: '4px 0 16px' }}>{ft('Everything on this phone is replaced by the file.')}</div>
    <button className="btn danger" onClick={() => { close(); onConfirm() }}>{ft('Replace with the backup')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{ft('Cancel')}</Button>
  </div>
}

// Upstream's reader and importer, unchanged: a .json or a .zip of upstream's export, checked, then
// the store replaces the state with it. The preview comes first; nothing is touched before the tap.
async function restoreFrom(file) {
  let read
  try {
    const { readBackupFile } = await import('../lib/backup-media.js')
    read = await readBackupFile(file)
  } catch {
    toast(ft('This file is not an openGym backup'))
    return
  }
  const apply = async () => {
    if (read.files.length) {
      const { storeBackupMedia } = await import('../lib/backup-media.js')
      await storeBackupMedia(read.files, { limits: limitsFrom(useStore.getState().config) })
    }
    useStore.getState().importBackup(read.state)
    toast(ft('Backup loaded'))
  }
  useUI.getState().openSheet(close => <RestorePreview name={file.name} inFile={summarizeBackup(read.state)}
    onPhone={summarizeBackup(useStore.getState().S)} close={close} onConfirm={apply} />, { kind: 'center' })
}

/* ---------------------------------------------------------------- Settings */

function OfflineMediaSection() {
  const routines = useStore(s => s.S.routines)
  const active = useStore(s => s.S.active)
  const urls = useMemo(() => offlineMediaUrls({ routines, active }), [routines, active])
  const [cached, setCached] = useState(null)
  const [run, setRun] = useState(null)
  useEffect(() => {
    let gone = false
    countCached(urls).then(n => { if (!gone) setCached(n) }, () => { if (!gone) setCached(0) })
    return () => { gone = true }
  }, [urls])

  const start = async () => {
    if (run) return
    if (navigator.onLine === false) { toast(ft('No network — connect and try again')); return }
    setRun({ done: 0, total: urls.length, bytes: 0, failed: 0 })
    const r = await downloadMedia(urls, { onProgress: setRun })
    setRun(null)
    setCached(await countCached(urls).catch(() => 0))
    toast(r.failed || r.stopped
      ? ft('{0} could not be downloaded — try again with a network', count(r.failed + (r.total - r.done), 'file'))
      : ft('All media of your plan are on this phone'))
  }

  const total = urls.length
  const subtitle = !total ? ft('Your plan has no exercises yet')
    : run ? ft('Downloading: {0} of {1} · {2}', run.done, run.total, fmtMB(run.bytes))
      : cached == null ? ft('Checking…')
        : ft('Offline: {0} of {1}', cached, count(total, 'file'))
  const pct = run && run.total ? Math.round(run.done / run.total * 100) : 0
  return <Section title={ft('Offline exercise media')} footer={ft('Pictures and animations of the exercises in your routines. Exercises you add later download by themselves while there is a network (in the app opened from the Home Screen).')}>
    <Row icon="download" iconTint="var(--teal)" title={ft('Download media for offline')} subtitle={subtitle}
      accessory={total && !run ? 'chevron' : 'none'} onClick={total && !run ? start : undefined} />
    {run && <div style={{ padding: '0 16px 14px' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'var(--acc)', transition: 'width .2s' }} />
      </div>
    </div>}
  </Section>
}

function BackupSectionInner() {
  const last = useLastBackup()
  const fileRef = useRef(null)
  return <>
    <Section title={ft('Backup')} footer={ft('Saves opengym-YYYY-MM-DD.json. In the share sheet choose “Save to Files” → “On My iPhone”. Works without a network.')}>
      <Row icon="download" iconTint="var(--blue)" title={ft('Save backup')}
        subtitle={last ? ft('Last backup: {0}', fmtWhen(last)) : ft('No backup saved yet')} accessory="chevron" onClick={saveNow} />
      <Row icon="upload" iconTint="var(--blue)" title={ft('Load backup')}
        subtitle={ft('Replaces the data on this phone — you see what is in the file first.')} accessory="chevron" onClick={() => fileRef.current?.click()} />
    </Section>
    {/* Reset after reading, so picking the same file again still fires onChange. */}
    <input ref={fileRef} type="file" accept=".json,.zip,application/json,application/zip" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) restoreFrom(f) }} />
    <OfflineMediaSection />
  </>
}

/** Settings: Backup (save / load) and Offline exercise media. */
export function ForkSettingsSections() {
  return LOCAL ? <BackupSectionInner /> : null
}

/* ---------------------------------------------------------------- Home */

function BackupBannerInner() {
  const S = useStore(s => s.S)
  const last = useLastBackup()
  if (!backupDue(S, last)) return null
  return <div className="card" role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'inset 0 0 0 1.5px var(--orange)' }}>
    <span style={{ fontSize: 24, color: 'var(--orange)', display: 'flex', flex: 'none' }}><Icon name="warning" /></span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{ft('Time to save a backup')}</div>
      <div className="small muted">{last
        ? ft('Last backup {0} ago. Your workouts exist only on this phone.', count(daysSince(last), 'day'))
        : ft('No backup yet. Your workouts exist only on this phone.')}</div>
    </div>
    <Button size="sm" variant="primary" style={{ width: 'auto', flex: 'none' }} onClick={saveNow}>{ft('Save')}</Button>
  </div>
}

/** Home: shown while the last backup is older than 7 days (or there never was one). */
export function ForkBackupBanner() {
  return LOCAL ? <BackupBannerInner /> : null
}

/* ---------------------------------------------------------------- Workout complete */

function FinishBackupInner() {
  const [saved, setSaved] = useState(false)
  const onClick = async () => {
    const r = await saveNow()
    if (r === 'shared' || r === 'downloaded') setSaved(true)
  }
  return <>
    <Button variant="tinted" icon={saved ? 'checkCircle' : 'download'} onClick={onClick}>{saved ? ft('Backup saved') : ft('Save backup')}</Button>
    <div style={{ height: 8 }} />
  </>
}

/** "Workout complete!" sheet: the moment a new workout exists that no backup has. */
export function ForkFinishBackupButton() {
  return LOCAL ? <FinishBackupInner /> : null
}
