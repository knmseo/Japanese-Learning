import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

const DICT_ROUTE = '/kuromoji-dict/'
const dictDir = path.resolve(import.meta.dirname, 'public/kuromoji-dict')

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveKuromojiDict()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
