import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const out = '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});

async function shot(page, name) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot', name);
}

async function prep(width, height) {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('ERR', err.message));
  await page.setViewport({ width, height, deviceScaleFactor: width < 500 ? 2 : 1 });
  return page;
}

const desk = await prep(1440, 900);
await desk.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await shot(desk, 'home-desktop');

await desk.goto('http://127.0.0.1:4173/signs/', { waitUntil: 'networkidle0' });
await shot(desk, 'signs-desktop');

await desk.goto('http://127.0.0.1:4173/cards/', { waitUntil: 'networkidle0' });
await shot(desk, 'cards-desktop');

await desk.goto('http://127.0.0.1:4173/signs/for-sale-plastic/', { waitUntil: 'networkidle0' });
await shot(desk, 'product-sign-desktop');

await desk.goto('http://127.0.0.1:4173/gear/t-shirt/', { waitUntil: 'networkidle0' });
await shot(desk, 'product-tee-desktop');

await desk.goto('http://127.0.0.1:4173/gear/?item=t-shirt&color=black&yaw=1.15', { waitUntil: 'networkidle0' });
await desk.waitForFunction(() => /T-Shirt|unavailable/i.test(document.body.innerText), { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1200));
await shot(desk, 'closet-desktop');
console.log('closet text', await desk.evaluate(() => document.getElementById('sheet') && document.getElementById('sheet').innerText.slice(0, 180)));

await desk.evaluate(() => document.getElementById('addCloset').click());
await desk.waitForFunction(() => document.getElementById('cartDrawer') && !document.getElementById('cartDrawer').hidden);
await shot(desk, 'cart-desktop');

await desk.goto('http://127.0.0.1:4173/checkout/', { waitUntil: 'networkidle0' });
await shot(desk, 'checkout-desktop');

await desk.evaluate(() => sessionStorage.setItem('enesma_shop_last_order', JSON.stringify({ orderNumber: 'ES-PREVIEW-1001', total: 19.65 })));
await desk.goto('http://127.0.0.1:4173/confirmation/?order=ES-PREVIEW-1001', { waitUntil: 'networkidle0' });
await shot(desk, 'confirmation-desktop');

await desk.goto('http://127.0.0.1:4173/admin/', { waitUntil: 'networkidle0' });
await shot(desk, 'admin-login-desktop');
await desk.goto('http://127.0.0.1:4173/admin/?preview=1', { waitUntil: 'networkidle0' });
await shot(desk, 'admin-orders-desktop');

const phone = await prep(390, 844);
await phone.evaluateOnNewDocument(() => localStorage.clear());
await phone.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
await shot(phone, 'home-iphone');
await phone.goto('http://127.0.0.1:4173/signs/', { waitUntil: 'networkidle0' });
await shot(phone, 'signs-iphone');
await phone.goto('http://127.0.0.1:4173/cards/', { waitUntil: 'networkidle0' });
await shot(phone, 'cards-iphone');
await phone.goto('http://127.0.0.1:4173/gear/polo/', { waitUntil: 'networkidle0' });
await shot(phone, 'product-polo-iphone');
await phone.goto('http://127.0.0.1:4173/gear/?item=cap&color=white&yaw=0.9', { waitUntil: 'networkidle0' });
await phone.waitForFunction(() => /Cap|unavailable/i.test(document.body.innerText), { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1200));
await shot(phone, 'closet-iphone');
await phone.goto('http://127.0.0.1:4173/checkout/', { waitUntil: 'networkidle0' });
await shot(phone, 'checkout-iphone');
await phone.goto('http://127.0.0.1:4173/admin/', { waitUntil: 'networkidle0' });
await shot(phone, 'admin-login-iphone');

await browser.close();
console.log('shots done');
