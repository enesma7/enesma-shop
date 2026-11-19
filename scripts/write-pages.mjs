import fs from 'fs';
import path from 'path';

const pages = [
  { out: 'index.html', title: 'ENESMA Shop', page: 'home' },
  { out: 'gear/index.html', title: 'Gear · ENESMA Shop', page: 'closet', importMap: true },
  { out: 'gear/t-shirt/index.html', title: 'T-Shirt · ENESMA Shop', page: 'product', sku: 't-shirt' },
  { out: 'gear/polo/index.html', title: 'Polo · ENESMA Shop', page: 'product', sku: 'polo' },
  { out: 'gear/quarter-zip/index.html', title: 'Quarter-Zip · ENESMA Shop', page: 'product', sku: 'quarter-zip' },
  { out: 'gear/cap/index.html', title: 'Cap · ENESMA Shop', page: 'product', sku: 'cap' },
  { out: 'signs/index.html', title: 'Signs · ENESMA Shop', page: 'category', category: 'signs', heading: 'Signs', lede: 'For sale signs and open house signs, in White or Black.' },
  { out: 'signs/for-sale-plastic/index.html', title: 'For Sale Sign · ENESMA Shop', page: 'product', sku: 'for-sale-plastic' },
  { out: 'signs/for-sale-aluminum/index.html', title: 'For Sale Sign · ENESMA Shop', page: 'product', sku: 'for-sale-aluminum' },
  { out: 'signs/open-house/index.html', title: 'Open House Signs · ENESMA Shop', page: 'product', sku: 'open-house' },
  { out: 'signs/a-frame/index.html', title: 'Open House A-Frame · ENESMA Shop', page: 'product', sku: 'a-frame' },
  { out: 'cards/index.html', title: 'Cards · ENESMA Shop', page: 'category', category: 'cards', heading: 'Cards', lede: 'Business cards, printed with your photo and contact details.' },
  { out: 'cards/cards-1000/index.html', title: 'Business Cards · ENESMA Shop', page: 'product', sku: 'cards-1000' },
  { out: 'cart/index.html', title: 'Your Bag · ENESMA Shop', page: 'cart' },
  { out: 'checkout/index.html', title: 'Checkout · ENESMA Shop', page: 'checkout' },
  { out: 'confirmation/index.html', title: 'Order Received · ENESMA Shop', page: 'confirm' },
  { out: 'admin/index.html', title: 'Admin · ENESMA Shop', page: 'admin' }
];

function html(p) {
  const attrs = [
    `data-page="${p.page}"`,
    p.sku ? `data-sku="${p.sku}"` : '',
    p.category ? `data-category="${p.category}"` : '',
    p.heading ? `data-title="${p.heading}"` : '',
    p.lede ? `data-lede="${p.lede}"` : ''
  ].filter(Boolean).join(' ');
  const map = p.importMap ? `<script>
document.write('<script type="importmap">'+JSON.stringify({imports:{"three":window.SHOP_BASE+"vendor/three/build/three.module.js","three/addons/":window.SHOP_BASE+"vendor/three/examples/jsm/"}})+'<\\/script>');
</script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${p.title}</title>
<script>
(function () {
  var path = location.pathname, marker = '/enesma-shop/', i = path.indexOf(marker);
  window.SHOP_BASE = i >= 0 ? path.slice(0, i + marker.length) : '/';
  document.write('<base href="' + window.SHOP_BASE + '">');
})();
</script>
${map}
<link rel="stylesheet" href="css/shop.css">
<link rel="icon" href="favicon-32.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#fbfbfb">
<meta name="description" content="ENESMA Shop. Gear, signs, and cards for ENESMA Realty.">
</head>
<body ${attrs}>
<div id="app"></div>
<script src="js/config.js"></script>
<script src="js/catalog.js"></script>
<script src="js/cart.js"></script>
<script src="js/api.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
</body>
</html>
`;
}

for (const page of pages) {
  const file = path.join(process.cwd(), page.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html(page));
}
fs.writeFileSync('CNAME', 'shop.enesmarealty.com\n');
fs.writeFileSync('.nojekyll', '');
fs.writeFileSync('404.html', `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not Found · ENESMA Shop</title>
<link rel="stylesheet" href="/css/shop.css">
</head>
<body>
<main class="section"><h1>Page Not Found</h1><p><a href="/">Back To Shop</a></p></main>
</body>
</html>
`);
console.log('pages', pages.length);
