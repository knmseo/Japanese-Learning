import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const DICT_ROUTE = '/kuromoji-dict/'
/**
 * Deliberately outside `public/`: everything in public/ is copied verbatim into
 * the build, and this dictionary is ~17MB that the deployed app never loads
 * (decks ship pre-segmented per §16). Kept here so the dev server can still
 * serve it for the deck-authoring path, without shipping it to a phone.
 */
const dictDir = path.resolve(import.meta.dirname, '.kuromoji-dict')

/**
 * Static servers label `*.dat.gz` with `Content-Encoding: gzip`, so the browser
 * silently inflates them and kuromoji's own gunzip then fails on plain bytes.
 * These files must arrive as opaque gzip payloads instead.
 */
function serveKuromojiDict(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (!url?.startsWith(DICT_ROUTE)) return next()

    const requested = path.resolve(dictDir, decodeURIComponent(url.slice(DICT_ROUTE.length)))
    if (!requested.startsWith(dictDir + path.sep) || !fs.existsSync(requested)) return next()

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', fs.statSync(requested).size)
    fs.createReadStream(requested).pipe(res)
  }

  return {
    name: 'serve-kuromoji-dict',
    configureServer: (server) => {
      server.middlewares.use(middleware)
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware)
    },
  }
}

/**
 * SPEC.md §9 v2 / §13 phase 7: installable PWA with a service worker.
 * Built once v1's commute bundle proved insufficient — it can't survive a tab
 * reload, which is exactly what a backgrounded phone does on a commute.
 */
function pwa(): Plugin[] {
  return VitePWA({
    registerType: 'autoUpdate',
    // Single user, single device — no update prompt UI to build.
    includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'Japanese Sentence Acquisition',
      short_name: 'Nihongo',
      description: 'Audio-first Japanese sentence practice with spaced repetition.',
      lang: 'ko',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#F5EDE7',
      theme_color: '#F5EDE7',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // The app shell plus the decks — decks are small (~40KB total) and are
      // what a cold offline start needs (§16).
      globPatterns: ['**/*.{js,css,html,svg,png,json,woff,woff2}'],
      // woff/woff2 are in the patterns because the two Korean faces are
      // self-hosted from public/fonts/ — without them the glosses and the stat
      // numerals fall back to a system face the moment the app is offline.
      // (The .otf/.ttf originals live in fonts-src/, outside public/, so they
      // are neither served nor precached.)
      //
      // The kuromoji dictionary is ~17MB and is NOT used at runtime: decks ship
      // pre-segmented (§16) and getSegmentationForDisplay only reads the cache.
      // Precaching it would bloat the install by 17× for no benefit.
      globIgnores: ['**/kuromoji-dict/**', '**/.DS_Store'],
      navigateFallback: 'index.html',
      runtimeCaching: [
        {
          // Kaisei Tokumin, Lora and Zen Maru Gothic come from Google Fonts;
          // without this the app falls back to system faces when offline.
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  }) as Plugin[]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveKuromojiDict(), ...pwa()],
  server: {
    // Vite ignores $PORT on its own — it only honours --port or this field, and
    // otherwise walks up from 5173 until it finds a free one. That silent walk
    // breaks any launcher that assigns a port and then opens it: the launcher
    // waits on the port it handed us while Vite quietly binds a different one.
    // Reading PORT here makes the assignment authoritative; nothing is set in
    // normal local use, so the default stays 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Fail loudly rather than drifting to another port behind the caller's back.
    strictPort: !!process.env.PORT,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
