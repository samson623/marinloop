#!/usr/bin/env node
/**
 * Generate PNG icons from medflow-icon.svg for PWA manifest and iOS.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'medflow-icon.svg')
const iconsDir = join(root, 'public', 'icons')

mkdirSync(iconsDir, { recursive: true })
const svg = readFileSync(svgPath)

const sizes = [
  { name: 'icon-192.png', w: 192, h: 192 },
  { name: 'icon-512.png', w: 512, h: 512 },
  { name: 'apple-touch-icon.png', w: 180, h: 180 },
]

for (const { name, w, h } of sizes) {
  await sharp(svg)
    .resize(w, h)
    .png()
    .toFile(join(iconsDir, name))
  console.log(`Generated ${name} (${w}x${h})`)
}

console.log('Done. Icons are in public/icons/')
