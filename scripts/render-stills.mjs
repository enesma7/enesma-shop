/**
 * Render HD stills from the shop's 3D models.
 * Requires the local static server on 127.0.0.1:4173 and a built models/ folder.
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'assets', 'renders');
fs.mkdirSync(outDir, { recursive: true });

const gear = [
  { id: 't-shirt', model: 't-shirt' },
  { id: 'polo', model: 'polo', name: '' },
  { id: 'quarter-zip', model: 'quarter-zip' },
  { id: 'cap', model: 'cap', width: 1600, height: 1280 }
];
const colors = ['black', 'white'];
const views = [
  { view: 'hero', yaw: 0.48 },
  { view: 'front', yaw: 0.12 },
  { view: 'back', yaw: Math.PI - 0.28 }
];

const jobs = [];
for (const item of gear) {
  for (const color of colors) {
    for (const view of views) {
      jobs.push({
        file: item.id + '-' + color + '-' + view.view,
        job: {
          kind: 'garment',
          model: item.model,
          color,
          yaw: view.yaw,
          width: item.width || 1600,
          height: item.height || 2000,
          name: ''
        }
      });
    }
  }
}

jobs.push({
  file: 'tile-gear',
  job: {
    kind: 'group',
    width: 2000,
    height: 1400,
    yaw: 0.28,
    items: [
      { model: 't-shirt', color: 'black' },
      { model: 'polo', color: 'white' },
      { model: 'quarter-zip', color: 'black' },
      { model: 'cap', color: 'white', gap: 0.12 }
    ]
  }
});

for (const color of colors) {
  for (const product of ['plastic', 'aluminum', 'open-house', 'a-frame']) {
    const id = product === 'plastic' ? 'for-sale-plastic'
      : product === 'aluminum' ? 'for-sale-aluminum'
        : product === 'open-house' ? 'open-house' : 'a-frame';
    const job = {
      kind: 'sign',
      product: product === 'plastic' ? 'plastic' : product === 'aluminum' ? 'aluminum' : product,
      color,
      width: 1600,
      height: 2000,
      yaw: 0.46
    };
    if (product === 'open-house') {
      job.width = 2400;
      job.height = 1600;
      job.yaw = 0.18;
      job.fill = 0.9;
    } else if (product === 'a-frame') {
      job.width = 1800;
      job.height = 2250;
      job.yaw = 0.78;
      job.fill = 0.82;
      job.lift = 0.22;
      job.background = '#f3f1ec';
    }
    jobs.push({ file: id + '-' + color + '-hero', job });
  }
  jobs.push({
    file: 'cards-1000-' + color + '-hero',
    job: { kind: 'cards', color, stack: '1000', layers: 14, width: 1600, height: 1200, yaw: 0.7 }
  });
}

jobs.push({
  file: 'tile-signs',
  job: { kind: 'sign', product: 'plastic', color: 'white', width: 2000, height: 1400, yaw: 0.35, fill: 0.8 }
});
jobs.push({
  file: 'tile-cards',
  job: { kind: 'cards', color: 'black', stack: '1000', layers: 12, width: 2000, height: 1400, yaw: 0.55 }
});

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
await page.goto('http://127.0.0.1:4173/tools/render.html', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
const boot = await page.evaluate(() => window.__bootError || '');
if (boot) {
  console.error(boot);
  process.exit(1);
}

const only = process.argv[2] || '';
const selected = only ? jobs.filter(function (item) { return item.file.indexOf(only) >= 0; }) : jobs;
let n = 0;
for (const item of selected) {
  n += 1;
  const data = await page.evaluate(async (job) => window.renderJob(job), item.job);
  if (!data || String(data).startsWith('ERROR')) {
    console.error('FAIL', item.file, data);
    process.exit(1);
  }
  const png = Buffer.from(String(data).split(',')[1], 'base64');
  const base = path.join(outDir, item.file);
  await sharp(png).webp({ quality: 82 }).toFile(base + '.webp');
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(base + '.jpg');
  await sharp(png).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 80 }).toFile(base + '-thumb.webp');
  console.log(n + '/' + selected.length, item.file, Math.round(png.length / 1024) + 'KB png');
}
await browser.close();
console.log('renders done', selected.length);
