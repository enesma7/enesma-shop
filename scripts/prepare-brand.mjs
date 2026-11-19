/**
 * Build crisp white and black wordmarks and emblem masks from the ENESMA brand files.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const logoDir = path.join(process.cwd(), 'assets', 'logo');
fs.mkdirSync(logoDir, { recursive: true });

const realtySrc = '/tmp/brand/realty.png';
const emblemSrc = '/tmp/brand/icon512.png';

async function wordmark(rgb, dest, width) {
  const up = await sharp(realtySrc).resize({ width, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(up.data.length);
  for (let i = 0; i < up.data.length; i += 4) {
    const a = up.data[i + 3];
    const lum = (up.data[i] + up.data[i + 1] + up.data[i + 2]) / 3;
    let alpha = 0;
    if (a > 12) {
      const coverage = Math.min(1, a / 255) * Math.min(1, Math.max(0, (lum - 28) / 90));
      alpha = coverage > 0.45 ? 255 : coverage > 0.2 ? Math.round(coverage * 255) : 0;
    }
    out[i] = rgb[0];
    out[i + 1] = rgb[1];
    out[i + 2] = rgb[2];
    out[i + 3] = alpha;
  }
  await sharp(out, { raw: { width: up.info.width, height: up.info.height, channels: 4 } })
    .png()
    .toFile(dest);
  console.log(dest, up.info.width, up.info.height);
}

async function emblem(rgb, dest, size) {
  const up = await sharp(emblemSrc).resize({ width: size, height: size, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(up.data.length);
  for (let i = 0; i < up.data.length; i += 4) {
    const lum = (up.data[i] + up.data[i + 1] + up.data[i + 2]) / 3;
    const alpha = lum < 28 ? 0 : Math.min(255, Math.round((lum - 28) * 1.35));
    out[i] = rgb[0];
    out[i + 1] = rgb[1];
    out[i + 2] = rgb[2];
    out[i + 3] = alpha;
  }
  await sharp(out, { raw: { width: up.info.width, height: up.info.height, channels: 4 } })
    .png()
    .toFile(dest);
  console.log(dest, up.info.width);
}

await wordmark([255, 255, 255], path.join(logoDir, 'wordmark-white.png'), 2800);
await wordmark([12, 12, 16], path.join(logoDir, 'wordmark-black.png'), 2800);
await emblem([255, 255, 255], path.join(logoDir, 'emblem-white.png'), 1024);
await emblem([20, 20, 24], path.join(logoDir, 'emblem-black.png'), 1024);

const soft = await sharp(emblemSrc).resize(1024, 1024).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const mask = Buffer.alloc(soft.data.length);
for (let i = 0; i < soft.data.length; i += 4) {
  const lum = (soft.data[i] + soft.data[i + 1] + soft.data[i + 2]) / 3;
  const alpha = lum < 18 ? 0 : Math.min(255, Math.round((lum - 18) * 1.15));
  mask[i] = 255;
  mask[i + 1] = 255;
  mask[i + 2] = 255;
  mask[i + 3] = alpha;
}
await sharp(mask, { raw: { width: 1024, height: 1024, channels: 4 } })
  .png()
  .toFile(path.join(logoDir, 'emblem-mask.png'));
console.log('emblem mask ready');
