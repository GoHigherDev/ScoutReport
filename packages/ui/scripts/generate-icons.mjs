import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = resolve(root, 'apps/web/public/brand/scoutreport-x-avatar.png')
const output = resolve(root, 'apps/web/public/brand')

for (const [name, size] of [
  ['scoutreport-icon-32.png', 32],
  ['scoutreport-apple-touch-icon.png', 180],
  ['scoutreport-icon-192.png', 192],
  ['scoutreport-icon-512.png', 512],
]) {
  await sharp(source).resize(size, size).png().toFile(resolve(output, name))
}
