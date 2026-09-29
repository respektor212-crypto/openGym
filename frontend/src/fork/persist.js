// Asks the browser to keep this site's storage (the state in localStorage, the media cache, the
// app itself) out of automatic eviction. Safari grants it to a Home Screen app; a tab may be told
// no, which changes nothing — it is a request, and failing it is not an error.
export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
  if (!storage || typeof storage.persist !== 'function') return null
  try {
    if (typeof storage.persisted === 'function' && await storage.persisted()) return true
    return await storage.persist()
  } catch { return null }
}
