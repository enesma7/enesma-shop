import puppeteer from 'puppeteer-core';
import fs from 'fs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist'
  ]
});
const page = await browser.newPage();
page.on('console', (msg) => console.log('PAGE', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
await page.goto('http://127.0.0.1:4173/tools/render.html', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
const boot = await page.evaluate(() => window.__bootError || '');
if (boot) {
  console.log('BOOT', boot);
  await browser.close();
  process.exit(1);
}
const jobs = [
  { file: '/tmp/tee-front.png', job: { kind: 'garment', model: 't-shirt', color: 'black', yaw: 0.4, width: 800, height: 1000 } },
  { file: '/tmp/cap.png', job: { kind: 'garment', model: 'cap', color: 'black', yaw: 0.55, width: 900, height: 700 } },
  { file: '/tmp/cards.png', job: { kind: 'cards', color: 'black', stack: '1000', layers: 12, width: 900, height: 700, yaw: 0.4 } }
];
for (const item of jobs) {
  const data = await page.evaluate(async (job) => window.renderJob(job), item.job);
  if (!data || data.startsWith('ERROR')) {
    console.log('FAIL', item.file, data);
    continue;
  }
  const buf = Buffer.from(data.split(',')[1], 'base64');
  fs.writeFileSync(item.file, buf);
  console.log('wrote', item.file, buf.length);
}
await browser.close();
