import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'node_modules/@sglkc/kuromoji/dict')
const target = resolve(root, 'public/kuromoji-dict')

if (!existsSync(source)) {
  console.error('kuromoji dictionary not found — run npm install first.')
  process.exit(1)
}

mkdirSync(dirname(target), { recursive: true })
cpSync(source, target, { recursive: true })
console.log(`kuromoji dictionary copied to ${target}`)
