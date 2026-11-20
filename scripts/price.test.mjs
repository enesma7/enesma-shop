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
assert(ShopCatalog.priceOf(tee, { size: 'L' }).pending.length === 0, 'no pending add-ons');
assert(ShopCatalog.optionSummary(tee, { size: 'L', color: 'black' }).indexOf('ENESMA back emblem (standard)') >= 0, 'emblem is standard');

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
assert(ShopCatalog.find('cards-500') == null, 'cards 500 removed');
assert(ShopCatalog.byCategory('cards').length === 1, 'only one card set');
assert(ShopCatalog.find('cards-1000').price === 57, 'cards 1000');
assert(ENESMA_CATALOG.backEmblemPrice == null, 'emblem is not priced as an add-on');
console.log('price tests passed');
