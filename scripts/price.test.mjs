import fs from 'fs';
import vm from 'vm';

const window = {};
vm.runInNewContext(fs.readFileSync('js/catalog.js', 'utf8'), { window });
const { ShopCatalog, ENESMA_CATALOG } = window;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tee = ShopCatalog.find('t-shirt');
assert(ShopCatalog.priceOf(tee, { size: 'M', color: 'black' }).unit === 19.65, 'tee base');
assert(ShopCatalog.priceOf(tee, { size: 'XXL' }).unit === 22.6, 'tee xxl');
assert(ShopCatalog.priceOf(tee, { size: 'L', backEmblem: true }).pending[0] === 'Back Emblem', 'emblem pending');
assert(ShopCatalog.priceOf(tee, { size: 'L', backEmblem: true }).unit === 19.65, 'emblem not charged');

const polo = ShopCatalog.find('polo');
assert(ShopCatalog.priceOf(polo, { size: 'M', agentName: true, agentNameText: 'Ava' }).unit === 44.49, 'polo name');
assert(ShopCatalog.priceOf(polo, { size: 'XXL' }).unit === 35.84, 'polo xxl');

const cap = ShopCatalog.find('cap');
assert(ShopCatalog.priceOf(cap, { size: 'XXL' }).unit === 30, 'cap xxl stays 30');

const plastic = ShopCatalog.find('for-sale-plastic');
assert(ShopCatalog.priceOf(plastic, { variantId: 'single' }).unit === 60, 'plastic single');
assert(ShopCatalog.priceOf(plastic, { variantId: 'pack2' }).unit === 100, 'plastic pack');
assert(ShopCatalog.find('for-sale-aluminum').variants[1].price === 158, 'aluminum pack');
assert(ShopCatalog.find('open-house').price === 134, 'open house');
assert(ShopCatalog.find('a-frame').price === 320, 'a-frame');
assert(ShopCatalog.find('cards-500').price === 51, 'cards 500');
assert(ShopCatalog.find('cards-1000').price === 57, 'cards 1000');
assert(ENESMA_CATALOG.backEmblemPrice === null, 'emblem config');
console.log('price tests passed');
