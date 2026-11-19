(function (w) {
  var KEY = 'enesma_shop_cart_v1';
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    w.dispatchEvent(new CustomEvent('enesma-cart'));
  }
  function uid() {
    return 'L' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function hydrate(line) {
    var product = w.ShopCatalog.find(line.sku);
    if (!product) return line;
    var priced = w.ShopCatalog.priceOf(product, line.selection);
    line.name = product.name;
    line.detail = product.detail;
    line.unit = priced.unit;
    line.pending = priced.pending;
    line.summary = w.ShopCatalog.optionSummary(product, line.selection);
    line.thumb = w.ShopCatalog.renderBase(product.id, (line.selection && line.selection.color) || 'black', 'hero') + '-thumb.webp';
    line.thumbFallback = w.ShopCatalog.renderBase(product.id, (line.selection && line.selection.color) || 'black', 'hero') + '.jpg';
    return line;
  }
  function items() { return read().map(hydrate); }
  function count() {
    return items().reduce(function (n, line) { return n + (Number(line.qty) || 0); }, 0);
  }
  function total() {
    return Math.round(items().reduce(function (n, line) { return n + line.unit * line.qty; }, 0) * 100) / 100;
  }
  function add(sku, selection, qty) {
    var product = w.ShopCatalog.find(sku);
    if (!product) return;
    var itemsNow = read();
    var qtyN = Math.max(1, Math.min(20, Number(qty) || 1));
    itemsNow.push({
      id: uid(),
      sku: sku,
      qty: qtyN,
      selection: selection || { color: 'black' }
    });
    write(itemsNow);
  }
  function update(id, patch) {
    var next = read().map(function (line) {
      if (line.id !== id) return line;
      if (patch.qty != null) line.qty = Math.max(1, Math.min(20, Number(patch.qty) || 1));
      if (patch.selection) line.selection = patch.selection;
      return line;
    });
    write(next);
  }
  function remove(id) { write(read().filter(function (line) { return line.id !== id; })); }
  function clear() { write([]); }
  w.ShopCart = { items: items, count: count, total: total, add: add, update: update, remove: remove, clear: clear, hydrate: hydrate };
})(window);
