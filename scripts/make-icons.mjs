#!/usr/bin/env node
/**
 * Generates the PWA icons into public/icons/.
 *
 * Written by hand rather than pulled from a design tool so the icon set can be
 * regenerated from source at any size, and so the repo carries no opaque binary
 * blobs. The mark is the app's own motif: a rounded card on the cream ground
 * with the heavy bottom edge that every pressable surface in the UI has.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

// Palette lifted from src/styles/classical.css.
const BG = [243, 242, 242] // --color-bg
const CARD = [255, 246, 225] // the study card's warm fill
const EDGE = [49, 47, 42] // STROKE — the thick bottom border
const ACCENT = [0, 128, 120] // the app's teal accent

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Minimal 8-bit RGB PNG encoder — enough for flat shapes, no dependency. */
function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // 10–12: compression, filter, interlace — all 0

  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y)
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance to a rounded rectangle — negative inside. */
function roundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius - x, 0, x - (right - radius))
  const cy = Math.max(top + radius - y, 0, y - (bottom - radius))
  return Math.hypot(cx, cy) - radius
}

/**
 * `maskable` icons get cropped to a circle on Android, so the mark has to sit
 * inside the safe zone (the middle 80%). Padding differs between the two.
 */
function draw(size, { maskable }) {
  const pad = Math.round(size * (maskable ? 0.22 : 0.14))
  const left = pad
  const right = size - pad
  const top = Math.round(size * (maskable ? 0.26 : 0.2))
  const bottom = size - Math.round(size * (maskable ? 0.26 : 0.2))
  const radius = Math.round(size * 0.085)
  const edge = Math.max(2, Math.round(size * 0.055)) // the thick bottom border
  const barH = Math.max(2, Math.round(size * 0.035))

  return (x, y) => {
    // The dark edge is the same card shape, pushed down — exactly how the UI
    // draws it (a box-shadow slab beneath the card).
    if (roundedRect(x, y, left, top + edge, right, bottom + edge, radius) <= 0) {
      if (roundedRect(x, y, left, top, right, bottom, radius) > 0) return EDGE
    }
    if (roundedRect(x, y, left, top, right, bottom, radius) <= 0) {
      // Two accent bars standing in for the segmented sentence.
      const innerL = left + Math.round((right - left) * 0.16)
      const midY = (top + bottom) / 2
      const gap = Math.round(size * 0.05)
      const longR = left + Math.round((right - left) * 0.84)
      const shortR = left + Math.round((right - left) * 0.58)
      const onLong = y >= midY - gap - barH && y < midY - gap && x >= innerL && x < longR
      const onShort = y >= midY + gap && y < midY + gap + barH && x >= innerL && x < shortR
      return onLong || onShort ? ACCENT : CARD
    }
    return BG
  }
}

mkdirSync(outDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  // iOS ignores the manifest's icons and uses apple-touch-icon.
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

for (const { file, size, maskable } of targets) {
  writeFileSync(resolve(outDir, file), encodePng(size, draw(size, { maskable })))
  console.log(`  ${file}  ${size}×${size}`)
}
console.log(`✓ icons written to public/icons/`)
