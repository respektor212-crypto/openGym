// "Download media for offline": the pictures and animations of every exercise in the plan, put
// into the service worker's media cache (public/sw.js MEDIA) so a workout opened in a basement
// with no signal shows them. Upstream already fetches these ahead by itself in the Home Screen app
// (lib/media-prefetch.js), a few seconds after the plan changes; this is the same set on demand,
// with progress, and in a browser tab too.
//
// The files are written into the cache from the page, not left to the worker: on the very first
// visit no worker controls the page yet, and a fetch then would only warm the HTTP cache.
import { planMediaUrls, MEDIA_CACHE } from '../lib/media-prefetch.js'

const CONCURRENCY = 3
// A server that refuses this many in a row (offline half-way, Pages down) stops the run.
const MAX_FAILURES_IN_A_ROW = 4

// Only a real file is kept: an HTML answer (a 404 page, a captive portal's login page) stored under
// an image's URL would stand in for it for good.
const realMedia = res => res && res.ok && !res.redirected && !/text\/html/i.test(res.headers?.get('content-type') || '')

/** Same-origin media URLs of the plan's exercises (routines and the session in progress). */
export const offlineMediaUrls = (S, base) => planMediaUrls(S, base)

/** How many of `urls` the media cache already holds. */
export async function countCached(urls, { cachesApi = globalThis.caches } = {}) {
  if (!cachesApi || !urls.length) return 0
  const cache = await cachesApi.open(MEDIA_CACHE)
  const hits = await Promise.all(urls.map(u => cache.match(u).then(Boolean, () => false)))
  return hits.filter(Boolean).length
}

/**
 * Fetch whatever of `urls` the media cache lacks and keep it there. `onProgress({ done, total,
 * bytes, failed })` after every file. Resolves the final tally; `stopped` is true when it gave up
 * after a run of failures (typically: the network went away).
 */
export async function downloadMedia(urls, { cachesApi = globalThis.caches, fetchImpl = globalThis.fetch, onProgress = () => {} } = {}) {
  const total = urls.length
  const tally = { done: 0, total, bytes: 0, failed: 0, stopped: false }
  if (!cachesApi || !total) { onProgress({ ...tally }); return tally }
  const cache = await cachesApi.open(MEDIA_CACHE)
  let next = 0
  let inARow = 0
  const lane = async () => {
    while (next < total && inARow < MAX_FAILURES_IN_A_ROW) {
      const u = urls[next++]
      try {
        if (!(await cache.match(u))) {
          const res = await fetchImpl(u, { cache: 'no-cache' })
          if (!realMedia(res)) throw new Error('HTTP ' + (res && res.status))
          const blob = await res.blob()
          await cache.put(u, new Response(blob, { status: 200, headers: res.headers }))
          tally.bytes += blob.size
        }
        inARow = 0
      } catch {
        tally.failed++
        inARow++
      }
      tally.done++
      onProgress({ ...tally })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, lane))
  tally.stopped = inARow >= MAX_FAILURES_IN_A_ROW && tally.done < total
  return tally
}
