#!/usr/bin/env node
// Personal build, step two — run after `vite build --manifest` (see .github/workflows/personal-pages.yml):
//   node fork/postbuild.mjs [dist-dir]
// Appends the full precache list to the built sw.js (frontend/src/fork/precache-list.js says what
// goes in and why), then drops Vite's manifest so it is not published. public/sw.js itself is
// never edited, so pulling upstream changes to the worker meets no conflict here.
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { precacheFiles, precacheSnippet } from '../frontend/src/fork/precache-list.js'

const dist = process.argv[2] || fileURLToPath(new URL('../frontend/dist/', import.meta.url))
const manifestPath = join(dist, '.vite', 'manifest.json')
const swPath = join(dist, 'sw.js')

if (!existsSync(manifestPath)) throw new Error('no ' + manifestPath + ' — build with `vite build --manifest`')
const sw = readFileSync(swPath, 'utf8')
if (sw.includes('__BUILD__')) throw new Error('sw.js still carries __BUILD__ — the build did not stamp it')
if (sw.includes('FORK_PRECACHE')) throw new Error('sw.js already has the precache list — run this once per build')

const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name)
  return statSync(p).isDirectory() ? walk(p) : [relative(dist, p).split(sep).join('/')]
})
const files = walk(dist)
const list = precacheFiles(JSON.parse(readFileSync(manifestPath, 'utf8')), files)
writeFileSync(swPath, sw + precacheSnippet(list))
rmSync(join(dist, '.vite'), { recursive: true, force: true })

const bytes = list.reduce((n, f) => n + statSync(join(dist, f)).size, 0)
console.log(`sw.js: precaching ${list.length} files, ${(bytes / 1048576).toFixed(1)} MB (of ${files.length} built files)`)
