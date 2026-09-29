// What the personal build's service worker takes in at install (fork/precache-list.js): the whole
// app, so nothing is missing offline, but not ten megabytes of languages nobody reads.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { precacheFiles, precacheSnippet } from './precache-list.js'

const manifest = {
  'index.html': { file: 'assets/index-A.js', isEntry: true },
  'src/locales/ru.js': { file: 'assets/ru-L.js' },
  'src/instr/ru.js': { file: 'assets/ru-I.js' },
  'src/exercise-names/ru.js': { file: 'assets/ru-N.js' },
  'src/locales/de.js': { file: 'assets/de-L.js' },
  'src/instr/pt-BR.js': { file: 'assets/pt-BR-I.js' },
  'src/exercise-names/fr.js': { file: 'assets/fr-N.js' },
  'src/lib/backup-media.js': { file: 'assets/backup-media-B.js' },
}
const files = [
  'index.html', 'sw.js', 'manifest.json', 'icon-180.png', '.vite/manifest.json',
  'assets/index-A.js', 'assets/index-C.css', 'assets/ru-L.js', 'assets/ru-I.js', 'assets/ru-N.js',
  'assets/de-L.js', 'assets/pt-BR-I.js', 'assets/fr-N.js', 'assets/backup-media-B.js',
  'img/0001.jpg', 'gif/0001.gif',
]

describe('the precache list', () => {
  const list = precacheFiles(manifest, files)
  it('holds every chunk of the app, the lazy ones included', () => {
    expect(list).toEqual(expect.arrayContaining(['assets/index-A.js', 'assets/index-C.css', 'assets/backup-media-B.js', 'manifest.json', 'icon-180.png']))
  })
  it('keeps the Russian packs and drops the other languages', () => {
    expect(list).toEqual(expect.arrayContaining(['assets/ru-L.js', 'assets/ru-I.js', 'assets/ru-N.js']))
    expect(list).not.toEqual(expect.arrayContaining(['assets/de-L.js']))
    expect(list).not.toContain('assets/pt-BR-I.js')
    expect(list).not.toContain('assets/fr-N.js')
  })
  it('leaves out what the worker handles itself, the media and the Vite manifest', () => {
    for (const f of ['index.html', 'sw.js', '.vite/manifest.json', 'img/0001.jpg', 'gif/0001.gif']) expect(list).not.toContain(f)
  })
})

describe('the code appended to sw.js', () => {
  it('parses together with upstream\'s worker and uses its build cache', () => {
    const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
    const code = sw + precacheSnippet(['assets/index-A.js'])
    // Throws on a syntax error or on a name the worker does not define.
    const listeners = []
    const self = { addEventListener: (type, fn) => listeners.push(type), location: { href: 'https://x/' } }
    new Function('self', 'caches', 'location', 'fetch', code)(self, {}, self.location, () => {})
    expect(listeners.filter(t => t === 'install')).toHaveLength(2)
    expect(code).toMatch(/caches\.open\(CACHE\)/)
  })
})
