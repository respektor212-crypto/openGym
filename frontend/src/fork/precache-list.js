// Which files of a build the service worker should hold before it takes over, so the app works in
// full with no network from the first launch on (fork/postbuild.mjs writes the list into sw.js).
//
// Upstream's worker precaches index.html and what it references — the entry chunk and its CSS —
// and keeps every lazy chunk only once it has been loaded online. A screen first opened in the
// gym (a language pack, the instructions, the backup reader) was then missing offline. This list
// is every file of the build, minus:
//  - other languages' packs (locales/, instr/, exercise-names/): 10+ MB nobody here reads; a
//    language switched to online is still kept by the worker's ordinary runtime cache;
//  - index.html and sw.js, which the worker handles itself;
//  - the exercise media (img/, gif/): ~130 MB, fetched per plan instead (fork/media-offline.js);
//  - Vite's own manifest.
const LANG_PACK = /^src\/(?:locales|instr|exercise-names)\/([^/]+)\.js$/

/**
 * @param {Record<string, {file: string}>} manifest Vite's build manifest (dist/.vite/manifest.json)
 * @param {string[]} files every file under dist/, relative, with forward slashes
 * @param {{langs?: string[]}} opts language packs to keep
 */
export function precacheFiles(manifest, files, { langs = ['ru'] } = {}) {
  const skip = new Set()
  for (const [src, chunk] of Object.entries(manifest || {})) {
    const m = LANG_PACK.exec(src)
    if (m && !langs.includes(m[1]) && chunk?.file) skip.add(chunk.file)
  }
  return files
    .filter(f => !skip.has(f)
      && f !== 'index.html' && f !== 'sw.js'
      && !f.startsWith('.vite/')
      && !/^(?:img|gif)\//.test(f))
    .sort()
}

/** The code appended to the built sw.js: one more install step, into the build's own cache. */
export function precacheSnippet(list) {
  return `

/* ---- personal build (fork/postbuild.mjs) ----------------------------------------------------
   Every file of this build, lazy chunks included, goes into this build's cache before the worker
   installs: a screen first opened with no network must not be missing its code. A file that will
   not cache fails the install, which keeps the previous, working build in place (see precache). */
const FORK_PRECACHE = ${JSON.stringify(list, null, 0)}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FORK_PRECACHE.map(async u => {
    if (await c.match(u)) return
    const r = await fetch(u, { cache: 'no-cache' })
    if (!r.ok || r.redirected) throw new Error('precache: ' + u + ' ' + r.status)
    await c.put(u, r)
  }))))
})
`
}
