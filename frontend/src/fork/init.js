// Start-up of the personal build (imported first thing by main.jsx; does nothing unless VITE_LOCAL=1).
//
// The config /api/config would have answered goes into the store before the first render, so the
// app comes up in Russian at once and never asks a server for anything (the store's boot takes the
// same path as upstream's demo build, without the demo data — see useStore.boot).
import { LOCAL, LOCAL_CONFIG } from './flags.js'
import { requestPersistentStorage } from './persist.js'
import { useStore } from '../store/useStore.js'

if (LOCAL) {
  useStore.setState({ config: LOCAL_CONFIG })
  requestPersistentStorage()
}
