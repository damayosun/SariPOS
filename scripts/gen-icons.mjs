import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'public')

function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F766E"/>
  <rect x="64" y="200" width="384" height="248" rx="16" fill="#134E4A"/>
  <rect x="64" y="120" width="384" height="96" rx="12" fill="#14B8A6"/>
  <rect x="96" y="152" width="320" height="40" rx="8" fill="#0D9488"/>
  <rect x="96" y="240" width="140" height="100" rx="8" fill="#5EEAD4"/>
  <rect x="276" y="240" width="140" height="100" rx="8" fill="#5EEAD4"/>
  <rect x="96" y="360" width="320" height="72" rx="8" fill="#5EEAD4"/>
  <circle cx="160" cy="290" r="12" fill="#0F766E"/>
  <circle cx="340" cy="290" r="12" fill="#0F766E"/>
  <text x="256" y="398" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="#0F766E" text-anchor="middle">SariPOS</text>
</svg>`
}

mkdirSync(outDir, { recursive: true })

const svg512 = iconSvg(512)
writeFileSync(resolve(outDir, 'icon.svg'), svg512)

const sizes = [192, 512]
for (const size of sizes) {
  writeFileSync(resolve(outDir, `icon-${size}.svg`), iconSvg(size))
  await sharp(Buffer.from(iconSvg(size)))
    .png()
    .toFile(resolve(outDir, `icon-${size}.png`))
}

await sharp(Buffer.from(iconSvg(180)))
  .png()
  .toFile(resolve(outDir, 'apple-touch-icon.png'))

await sharp(Buffer.from(iconSvg(512)))
  .png()
  .toFile(resolve(outDir, 'icon.png'))

console.log('PWA icons generated (SVG + PNG).')
