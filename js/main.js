(function () {
  var Cat = window.ShopCatalog;
  var Cart = window.ShopCart;
  var UI = window.ShopUI;
  var h = UI.h;

  function picture(id, color, view, alt) {
    var base = Cat.renderBase(id, color, view);
    var size = Cat.imageSize(id);
    return '<picture><source srcset="' + base + '.webp" type="image/webp">' +
      '<img src="' + base + '.jpg" alt="' + h(alt) + '" width="' + size.w + '" height="' + size.h + '"></picture>';
  }

  function home() {
    document.title = 'ENESMA Shop';
    UI.$('#content').innerHTML =
      '<div class="hero-tiles">' +
      tile('gear/', 'tile-gear', 'Gear') +
      tile('signs/', 'tile-signs', 'Signs') +
      tile('cards/', 'tile-cards', 'Cards') +
      '</div>';
  }
  function tile(href, file, label) {
    return '<a class="tile" href="' + href + '"><img src="assets/tiles/' + file + '.jpg" alt="" width="1280" height="720">' +
      '<span class="copy"><b>' + label + '</b><i>Shop Now</i></span></a>';
  }

  function category(cat, title, lede) {
    document.title = title + ' · ENESMA Shop';
    var cards = Cat.byCategory(cat).map(function (p) {
      var priced = Cat.priceOf(p, { color: 'black' });
      var href = cat + '/' + p.id + '/';
      var fit = (p.category === 'signs' || p.category === 'cards') ? ' natural' : '';
      return '<a class="card" href="' + href + '"><div class="ph' + fit + '">' + picture(p.id, 'black', 'hero', p.name) + '</div>' +
        '<h2>' + h(p.name) + '</h2><p>' + h(p.detail) + '</p><p>' + (p.variants ? 'From ' : '') + Cat.money(priced.from) + '</p></a>';
    }).join('');
    UI.$('#content').innerHTML = '<section class="section"><h1>' + h(title) + '</h1><p class="lede">' + h(lede) + '</p><div class="grid">' + cards + '</div></section>';
  }

  function productPage(sku) {
    var product = Cat.find(sku);
    if (!product) { UI.$('#content').innerHTML = '<section class="section"><h1>Not Found</h1></section>'; return; }
    document.title = product.name + ' · ENESMA Shop';
    var state = { color: 'black', size: 'M', variantId: product.variants ? product.variants[0].id : '', agentName: false, agentNameText: '', qty: 1, personal: { photoMode: 'email' } };
    var root = document.createElement('div');
    root.className = 'product';
    root.innerHTML = '<div class="gallery" id="gallery"></div><div class="buy" id="buy"></div>';
    UI.$('#content').innerHTML = '';
    UI.$('#content').appendChild(root);
    function draw() {
      var priced = Cat.priceOf(product, state);
      var shots = product.category === 'gear' ? ['hero', 'front', 'back'] : product.category === 'cards' ? ['hero', 'back'] : ['hero'];
      UI.$('#gallery').innerHTML = shots.map(function (view) {
        return picture(product.id, state.color, view, product.name + ' in ' + (state.color === 'white' ? 'White' : 'Black'));
      }).join('');
      var html = '<h1>' + h(product.name) + '</h1><p class="detail">' + h(product.detail) + '</p>' +
        '<p class="price" id="price">' + Cat.money(priced.unit) + '</p>' +
        '<p class="blurb">' + h(product.blurb) + '</p>';
      html += '<div class="opt"><div class="lbl">Color</div><div class="pills" id="colors">' +
        '<button type="button" class="swatch" data-color="black" aria-pressed="' + (state.color === 'black') + '"><i style="background:#141418"></i><span class="sr">Black</span></button>' +
        '<button type="button" class="swatch" data-color="white" aria-pressed="' + (state.color === 'white') + '"><i style="background:#f4f3f0"></i><span class="sr">White</span></button>' +
        '</div></div>';
      if (product.sizes) {
        html += '<div class="opt"><div class="lbl">Size</div><div class="pills" id="sizes">' +
          ['S', 'M', 'L', 'XL', 'XXL'].map(function (s) {
            return '<button type="button" data-size="' + s + '" aria-pressed="' + (state.size === s) + '">' + s + '</button>';
          }).join('') + '</div></div>';
      }
      if (product.variants) {
        html += '<div class="opt"><div class="lbl">Quantity Option</div><div class="pills" id="variants">' +
          product.variants.map(function (v) {
            return '<button type="button" data-variant="' + v.id + '" aria-pressed="' + (state.variantId === v.id) + '">' + h(v.label) + ' · ' + Cat.money(v.price) + '</button>';
          }).join('') + '</div></div>';
      }
      if (product.agentName) {
        html += '<label class="check"><input type="checkbox" id="agentName"' + (state.agentName ? ' checked' : '') + '> Agent Name (+' + Cat.money(window.ENESMA_CATALOG.agentNamePrice) + ')</label>' +
          '<div class="field" id="nameField"' + (state.agentName ? '' : ' hidden') + '><label for="agentNameText">Agent Name</label><input id="agentNameText" maxlength="24" value="' + h(state.agentNameText) + '"></div>';
      }
      if (product.personal) html += personalFields(state.personal);
      if (product.category === 'gear') {
        html += '<p class="note">One-time setup fees may apply (DTF $15 setup, embroidery $50 digitizing), confirmed by Grafek Printing.</p>';
      }
      html += '<div class="field"><label for="qty">Quantity</label><input id="qty" inputmode="numeric" value="' + state.qty + '"></div>';
      html += '<button class="btn" id="addBtn" type="button">Add To Cart</button>';
      if (product.category === 'gear') html += '<p><a href="gear/?item=' + product.id + '&color=' + state.color + '">View In The Closet</a></p>';
      UI.$('#buy').innerHTML = html;
      UI.$('#colors').onclick = function (ev) {
        var b = ev.target.closest('[data-color]'); if (!b) return; state.color = b.getAttribute('data-color'); draw();
      };
      var sizes = UI.$('#sizes');
      if (sizes) sizes.onclick = function (ev) {
        var b = ev.target.closest('[data-size]'); if (!b) return; state.size = b.getAttribute('data-size'); draw();
      };
      var variants = UI.$('#variants');
      if (variants) variants.onclick = function (ev) {
        var b = ev.target.closest('[data-variant]'); if (!b) return; state.variantId = b.getAttribute('data-variant'); draw();
      };
      var agent = UI.$('#agentName');
      if (agent) agent.onchange = function () { state.agentName = agent.checked; draw(); };
      var name = UI.$('#agentNameText');
      if (name) name.oninput = function () { state.agentNameText = name.value; UI.$('#price').textContent = Cat.money(Cat.priceOf(product, state).unit); };
      bindPersonal(state);
      UI.$('#qty').oninput = function (ev) { state.qty = Math.max(1, Math.min(20, parseInt(ev.target.value, 10) || 1)); };
      UI.$('#addBtn').onclick = function () {
        if (product.personal && !validPersonal(state.personal)) return;
        Cart.add(product.id, JSON.parse(JSON.stringify(state)), state.qty);
        UI.openCart();
      };
    }
    draw();
  }

  function personalFields(p) {
    return '<div class="opt"><div class="lbl">Agent Details For Print</div>' +
      '<div class="field"><label for="pName">Name</label><input id="pName" value="' + h(p.name || '') + '"></div>' +
      '<div class="field"><label for="pPhone">Phone</label><input id="pPhone" inputmode="tel" value="' + h(p.phone || '') + '"></div>' +
      '<div class="field"><label for="pEmail">Email</label><input id="pEmail" type="email" value="' + h(p.email || '') + '"></div>' +
      '<div class="field"><label for="pDre">DRE #</label><input id="pDre" value="' + h(p.dre || '') + '"></div>' +
      '<div class="pills" id="photoMode">' +
      '<button type="button" data-photo="upload" aria-pressed="' + (p.photoMode === 'upload') + '">Upload Photo</button>' +
      '<button type="button" data-photo="email" aria-pressed="' + (p.photoMode !== 'upload') + '">I\'ll Email My Photo</button></div>' +
      '<div class="field" id="photoField"' + (p.photoMode === 'upload' ? '' : ' hidden') + '><label for="pPhoto">Photo</label><input id="pPhoto" type="file" accept="image/jpeg,image/png,image/webp"></div>' +
      '<p class="err" id="pErr" hidden></p></div>';
  }
  function bindPersonal(state) {
    ['pName', 'pPhone', 'pEmail', 'pDre'].forEach(function (id) {
      var el = UI.$( '#' + id);
      if (!el) return;
      el.oninput = function () {
        var key = id === 'pName' ? 'name' : id === 'pPhone' ? 'phone' : id === 'pEmail' ? 'email' : 'dre';
        state.personal[key] = el.value;
      };
    });
    var mode = UI.$('#photoMode');
    if (mode) mode.onclick = function (ev) {
      var b = ev.target.closest('[data-photo]'); if (!b) return;
      state.personal.photoMode = b.getAttribute('data-photo');
      UI.$('#photoField').hidden = state.personal.photoMode !== 'upload';
      Array.prototype.forEach.call(mode.children, function (child) {
        if (child.getAttribute) child.setAttribute('aria-pressed', child === b ? 'true' : 'false');
      });
    };
    var file = UI.$('#pPhoto');
    if (file) file.onchange = function () {
      var f = file.files && file.files[0];
      if (!f) return;
      compressPhoto(f).then(function (data) {
        state.personal.photoData = data.data;
        state.personal.photoName = f.name || 'photo.jpg';
        state.personal.photoMime = 'image/jpeg';
      }).catch(function (err) {
        var box = UI.$('#pErr'); box.hidden = false; box.textContent = err.message;
      });
    };
  }
  function validPersonal(p) {
    var box = UI.$('#pErr');
    if (!p.name || !p.phone || !p.email || !p.dre) {
      box.hidden = false; box.textContent = 'Name, phone, email, and DRE # are needed for this item.'; return false;
    }
    if (p.photoMode === 'upload' && !p.photoData) {
      box.hidden = false; box.textContent = 'Upload a photo, or choose I’ll Email My Photo.'; return false;
    }
    box.hidden = true; return true;
  }
  function compressPhoto(file) {
    if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error('Choose a photo under 8 MB.'));
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ data: canvas.toDataURL('image/jpeg', 0.72).split(',')[1] });
      };
      img.onerror = function () { reject(new Error('Could not read that photo.')); };
      img.src = url;
    });
  }

  function cartPage() {
    document.title = 'Your Bag · ENESMA Shop';
    var lines = Cart.items();
    UI.$('#content').innerHTML = '<section class="section"><h1>Your Bag</h1>' +
      (lines.length ? lines.map(function (line) {
        return '<article class="line"><img src="' + h(line.thumb) + '" alt=""><div><h3>' + h(line.name) + '</h3><p>' + h(line.summary) + '</p><p>' + Cat.money(line.unit) + ' × ' + line.qty + '</p></div></article>';
      }).join('') + '<p class="est"><span>Estimated Total</span><b>' + Cat.money(Cart.total()) + '</b></p><p class="fine">Grafek Printing will contact you to confirm and collect payment.</p><a class="btn" href="checkout/">Order</a>' : '<p>Your bag is empty.</p><a class="btn" href="./">Continue Shopping</a>') +
      '</section>';
  }

  function checkout() {
    document.title = 'Checkout · ENESMA Shop';
    var lines = Cart.items();
    if (!lines.length) { UI.$('#content').innerHTML = '<section class="section"><h1>Checkout</h1><p>Your bag is empty.</p></section>'; return; }
    var connected = window.ShopApi.connected();
    UI.$('#content').innerHTML = '<section class="section"><h1>Checkout</h1>' +
      (connected ? '' : '<div class="banner"><strong>Ordering not yet connected.</strong> The print shop link is not set yet, so this order cannot be sent.</div>') +
      '<p class="fine">Grafek Printing will contact you to confirm and collect payment. No payment is collected on this site.</p>' +
      '<form id="orderForm">' +
      '<div class="field"><label for="buyerName">Name</label><input id="buyerName" name="buyerName" required autocomplete="name"></div>' +
      '<div class="field"><label for="buyerEmail">Email</label><input id="buyerEmail" name="buyerEmail" type="email" required autocomplete="email"></div>' +
      '<div class="field"><label for="buyerPhone">Phone</label><input id="buyerPhone" name="buyerPhone" required autocomplete="tel"></div>' +
      '<div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes"></textarea></div>' +
      '<div class="hp" aria-hidden="true"><label>Company Website<input name="company_website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="lineEditors"></div>' +
      '<p class="est"><span>Estimated Total</span><b>' + Cat.money(Cart.total()) + '</b></p>' +
      '<p class="err" id="orderErr" hidden></p>' +
      '<button class="btn" id="placeBtn" type="submit"' + (connected ? '' : ' disabled') + '>Place Order</button>' +
      '</form></section>';
    UI.$('#lineEditors').innerHTML = lines.map(function (line) {
      return '<article class="line"><img src="' + h(line.thumb) + '" alt=""><div><h3>' + h(line.name) + '</h3><p>' + h(line.summary) + '</p><p>' + Cat.money(line.unit) + ' × ' + line.qty + '</p></div></article>';
    }).join('');
    UI.$('#orderForm').onsubmit = function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      if (String(fd.get('company_website') || '').trim()) return;
      var btn = UI.$('#placeBtn');
      btn.disabled = true;
      btn.textContent = 'Sending';
      var payload = {
        buyerName: fd.get('buyerName'),
        buyerEmail: fd.get('buyerEmail'),
        buyerPhone: fd.get('buyerPhone'),
        notes: fd.get('notes') || '',
        website: fd.get('company_website') || '',
        items: Cart.items().map(function (line) {
          var sel = line.selection || {};
          var personal = sel.personal || {};
          return {
            sku: line.sku,
            name: line.name,
            detail: line.detail,
            color: sel.color || '',
            size: sel.size || '',
            variant: line.summary,
            qty: line.qty,
            unitPrice: line.unit,
            lineTotal: Math.round(line.unit * line.qty * 100) / 100,
            pending: line.pending || [],
            agentName: sel.agentNameText || '',
            personal: {
              name: personal.name || '',
              phone: personal.phone || '',
              email: personal.email || '',
              dre: personal.dre || '',
              photoMode: personal.photoMode || '',
              photoName: personal.photoName || '',
              photoMime: personal.photoMime || '',
              photoData: personal.photoData || ''
            }
          };
        })
      };
      window.ShopApi.shop('placeOrder', payload).then(function (data) {
        try { sessionStorage.setItem('enesma_shop_last_order', JSON.stringify(data)); } catch (e) {}
        Cart.clear();
        location.href = 'confirmation/?order=' + encodeURIComponent(data.orderNumber || '');
      }).catch(function (err) {
        var box = UI.$('#orderErr');
        box.hidden = false;
        box.textContent = err.code === 'SETUP' ? 'Ordering not yet connected.' : err.message;
        btn.disabled = !window.ShopApi.connected();
        btn.textContent = 'Place Order';
      });
    };
  }

  function confirmation() {
    document.title = 'Order Received · ENESMA Shop';
    var params = new URLSearchParams(location.search);
    var stored = null;
    try { stored = JSON.parse(sessionStorage.getItem('enesma_shop_last_order') || 'null'); } catch (e) {}
    var number = (stored && stored.orderNumber) || params.get('order') || '';
    UI.$('#content').innerHTML = '<section class="section"><h1>Order Received</h1>' +
      (number ? '<p>Order ' + h(number) + '</p>' : '') +
      '<p>Grafek Printing will contact you to confirm and collect payment.</p>' +
      (stored && stored.total != null ? '<p class="est"><span>Estimated Total</span><b>' + Cat.money(stored.total) + '</b></p>' : '') +
      '<a class="btn" href="./">Back To Shop</a></section>';
  }

  UI.mount().then(function (ok) {
    if (!ok) return;
    var page = document.body.getAttribute('data-page');
    var sku = document.body.getAttribute('data-sku');
    if (page === 'home') home();
    else if (page === 'category') category(document.body.getAttribute('data-category'), document.body.getAttribute('data-title'), document.body.getAttribute('data-lede'));
    else if (page === 'product') productPage(sku);
    else if (page === 'cart') cartPage();
    else if (page === 'checkout') checkout();
    else if (page === 'confirm') confirmation();
    else if (page === 'closet') {
      document.title = 'Gear · ENESMA Shop';
      var stage = document.createElement('div');
      stage.className = 'closet';
      stage.innerHTML = '<div class="stage" id="stage"><h1 class="closet-headline" id="closetHeadline">ENESMA Gear. Built For Agents.</h1><div class="pill" id="pill" hidden></div></div><aside class="sheet" id="sheet" hidden></aside>';
      UI.$('#content').appendChild(stage);
      import(window.SHOP_BASE + 'js/closet.js').catch(function () { showFallback(); });
    } else if (page === 'admin') {
      import(window.SHOP_BASE + 'js/admin.js');
    }
  });

  function showFallback() {
    var box = UI.$('#sheet');
    if (!box) return;
    box.innerHTML = '<h2>Gear</h2><p class="hint">3D is unavailable on this device. Browse the pieces below.</p><div class="grid">' +
      Cat.byCategory('gear').map(function (p) {
        return '<a class="card" href="gear/' + p.id + '/"><div class="ph">' + picture(p.id, 'black', 'hero', p.name) + '</div><h2>' + h(p.name) + '</h2><p>' + Cat.money(p.price) + '</p></a>';
      }).join('') + '</div>';
  }
})();
