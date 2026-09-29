import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persist.js'

describe('persistent storage', () => {
  it('asks when storage is not persistent yet', async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) }
    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })
  it('does not ask again once granted', async () => {
    const storage = { persisted: async () => true, persist: vi.fn() }
    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
  })
  it('a refusal or a browser without the API is not an error', async () => {
    expect(await requestPersistentStorage({ persisted: async () => false, persist: async () => false })).toBe(false)
    expect(await requestPersistentStorage({ persist: () => Promise.reject(new Error('no')) })).toBe(null)
    expect(await requestPersistentStorage(undefined)).toBe(null)
    expect(await requestPersistentStorage({})).toBe(null)
  })
})
