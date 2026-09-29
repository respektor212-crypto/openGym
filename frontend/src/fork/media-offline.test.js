// "Download media for offline" (fork/media-offline.js): the plan's pictures and animations go into
// the worker's media cache — the one public/sw.js answers from — with progress, skipping what is
// there, keeping only real files, and giving up once the network is clearly gone.
import { describe, expect, it, vi } from 'vitest'
import { offlineMediaUrls, countCached, downloadMedia } from './media-offline.js'
import { MEDIA_CACHE } from '../lib/media-prefetch.js'
import { EXIDX } from '../lib/exercises.js'

const BASE = 'https://me.github.io/openGym/'

function fakeCaches(pre = []) {
  const store = new Map(pre.map(u => [u, new Response('x')]))
  const cache = {
    match: async u => store.get(String(u)),
    put: async (u, r) => { store.set(String(u), r) },
  }
  return { store, api: { open: vi.fn(async name => { expect(name).toBe(MEDIA_CACHE); return cache }) } }
}
const gif = (bytes = 10) => new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'image/gif' } })

// Two catalogue exercises that have both a still and an animation.
const withMedia = Object.values(EXIDX).filter(e => e.img && e.gif && !e.custom).slice(0, 3)

describe('which files', () => {
  it('are the same-origin still and animation of every exercise in the routines', () => {
    const [a, b] = withMedia
    const urls = offlineMediaUrls({ routines: [{ ex: [{ id: a.id }, { id: b.id }] }] }, BASE)
    expect(urls).toHaveLength(4)
    expect(urls).toContain(BASE + 'gif/' + a.gif)
    expect(urls).toContain(BASE + 'img/' + a.img)
    expect(urls.every(u => u.startsWith(BASE))).toBe(true)
  })

  it('grow when an exercise is added to the plan — that is what the auto-download follows', () => {
    const [a, b, c] = withMedia
    const before = offlineMediaUrls({ routines: [{ ex: [{ id: a.id }] }] }, BASE)
    const after = offlineMediaUrls({ routines: [{ ex: [{ id: a.id }] }, { ex: [{ id: b.id }, { id: c.id }] }] }, BASE)
    expect(after.length).toBe(before.length + 4)
  })

  it('include an exercise swapped into the session in progress', () => {
    const [a] = withMedia
    expect(offlineMediaUrls({ routines: [], active: { entries: [{ id: a.id }] } }, BASE)).toHaveLength(2)
  })
})

describe('downloading', () => {
  it('fetches only what the cache lacks and reports progress', async () => {
    const urls = [BASE + 'gif/1.gif', BASE + 'gif/2.gif', BASE + 'img/1.jpg']
    const { store, api } = fakeCaches([urls[0]])
    const fetchImpl = vi.fn(async () => gif(100))
    const seen = []
    const r = await downloadMedia(urls, { cachesApi: api, fetchImpl, onProgress: p => seen.push(p) })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ done: 3, total: 3, failed: 0, bytes: 200, stopped: false })
    expect(seen.map(p => p.done)).toEqual([1, 2, 3])
    expect(store.size).toBe(3)
    expect(await countCached(urls, { cachesApi: api })).toBe(3)
  })

  it('never keeps an error page or a login page under a media URL', async () => {
    const urls = [BASE + 'gif/missing.gif', BASE + 'gif/portal.gif']
    const { store, api } = fakeCaches()
    const fetchImpl = vi.fn(async u => u.includes('missing')
      ? new Response('nope', { status: 404 })
      : new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const r = await downloadMedia(urls, { cachesApi: api, fetchImpl })
    expect(r.failed).toBe(2)
    expect(store.size).toBe(0)
  })

  it('stops after a run of failures — the network is gone — instead of trying every file', async () => {
    const urls = Array.from({ length: 40 }, (_, i) => BASE + 'gif/' + i + '.gif')
    const { api } = fakeCaches()
    const fetchImpl = vi.fn(async () => { throw new TypeError('Load failed') })
    const r = await downloadMedia(urls, { cachesApi: api, fetchImpl })
    expect(r.stopped).toBe(true)
    expect(fetchImpl.mock.calls.length).toBeLessThan(10)
  })

  it('does nothing, harmlessly, without a plan or without Cache Storage', async () => {
    expect(await downloadMedia([], { cachesApi: fakeCaches().api })).toMatchObject({ done: 0, total: 0 })
    expect(await downloadMedia(['x'], { cachesApi: undefined })).toMatchObject({ done: 0, total: 1 })
    expect(await countCached(['x'], { cachesApi: undefined })).toBe(0)
  })
})
