import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const rootDir = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(rootDir, 'public')
const splashDir = path.join(publicDir, 'splash')
const iconSource = path.join(publicDir, 'icon-master.svg')

const iconSizes = [
  { output: 'logo192.png', size: 192 },
  { output: 'logo512.png', size: 512 },
  { output: 'apple-touch-icon.png', size: 180 },
  { output: 'icon-maskable-512.png', size: 512 },
]

const splashSizes = [
  { output: 'apple-splash-1170x2532.png', width: 1170, height: 2532 },
  { output: 'apple-splash-2532x1170.png', width: 2532, height: 1170 },
  { output: 'apple-splash-1179x2556.png', width: 1179, height: 2556 },
  { output: 'apple-splash-2556x1179.png', width: 2556, height: 1179 },
  { output: 'apple-splash-1290x2796.png', width: 1290, height: 2796 },
  { output: 'apple-splash-2796x1290.png', width: 2796, height: 1290 },
]

async function generateIcons() {
  await Promise.all(
    iconSizes.map(async ({ output, size }) => {
      await sharp(iconSource)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, output))
    }),
  )
}

async function generateSplashScreen({ output, width, height }) {
  const iconSize = Math.round(Math.min(width, height) * 0.34)
  const iconBuffer = await sharp(iconSource)
    .resize(iconSize, iconSize, { fit: 'contain' })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#f7f2e8',
    },
  })
    .composite([
      {
        input: iconBuffer,
        gravity: 'center',
      },
    ])
    .png()
    .toFile(path.join(splashDir, output))
}

async function main() {
  await mkdir(splashDir, { recursive: true })
  await generateIcons()
  await Promise.all(splashSizes.map(generateSplashScreen))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
