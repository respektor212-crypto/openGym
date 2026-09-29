// Personal static build (VITE_LOCAL=1): served from GitHub Pages, no server, no account, every
// byte of data on this phone. See FORK.md at the repository root.
//
// Everything this fork changes about upstream hangs off LOCAL. Unset — every upstream build, and
// the upstream test suite — the app behaves exactly as upstream wrote it.
export const LOCAL = import.meta.env?.VITE_LOCAL === '1'

// What /api/config would answer, for a build that has no /api. Guests are allowed, and a copy that
// never picked a language starts in Russian (lib/default-lang.js reads `default_lang`). No `coach`
// and no `media` keys: the AI Coach and server-side media stay off by construction.
export const LOCAL_CONFIG = { allow_guest: true, default_lang: 'ru' }

// AGPL §13: the "source code" link offers the source this copy actually runs — the fork.
// The Pages workflow passes the repository it builds from.
export const SOURCE_URL = import.meta.env?.VITE_SOURCE_URL || 'https://github.com/respektor212-crypto/openGym'
