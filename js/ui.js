(function (w) {
  function h(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function currentNav() {
    var path = location.pathname;
    if (path.indexOf('/gear') >= 0) return 'gear';
    if (path.indexOf('/signs') >= 0) return 'signs';
    if (path.indexOf('/cards') >= 0) return 'cards';
    return '';
  }
  function header() {
    var nav = currentNav();
    return '<a class="skip" href="#content">Skip To Content</a>' +
      '<header class="top" id="top">' +
      '<a class="brand" href="./"><img src="assets/logo/eshop-lockup.svg" alt="E Shop"></a>' +
      '<nav class="nav" aria-label="Shop">' +
      '<a href="gear/"' + (nav === 'gear' ? ' aria-current="page"' : '') + '>Gear</a>' +
      '<a href="signs/"' + (nav === 'signs' ? ' aria-current="page"' : '') + '>Signs</a>' +
      '<a href="cards/"' + (nav === 'cards' ? ' aria-current="page"' : '') + '>Cards</a>' +
      '</nav>' +
      '<div class="tools">' +
      '<a class="admin-link" href="admin/">Admin</a>' +
      '<button class="bag" id="openCart" type="button">Bag <b id="bagCount" data-n="0"></b></button>' +
      '<button class="menu-btn" id="menuBtn" type="button" aria-label="Menu"><span></span><span></span><span></span></button>' +
      '</div>' +
      '<div class="nav-pop" id="navPop">' +
      '<a href="gear/">Gear</a><a href="signs/">Signs</a><a href="cards/">Cards</a>' +
      '</div></header>';
  }
  function footer() {
    return '<footer class="foot"><p>Orders Fulfilled By Grafek Printing</p>' +
      '<p><a href="https://enesmarealty.com/">ENESMA Realty</a></p></footer>';
  }
  function drawer() {
    return '<div class="drawer-back" id="cartBack" hidden></div>' +
      '<aside class="drawer" id="cartDrawer" hidden aria-label="Bag">' +
      '<header><h2>Your Bag</h2><button class="text-btn" id="closeCart" type="button">Close</button></header>' +
      '<div class="lines" id="cartLines"></div>' +
      '<footer><p class="est"><span>Estimated Total</span><b id="cartTotal"></b></p>' +
      '<p class="fine">Grafek Printing will contact you to confirm and collect payment. Setup fees are not included.</p>' +
      '<a class="btn" href="checkout/">Order</a></footer></aside>';
  }
  function renderBag() {
    var lines = w.ShopCart.items();
    var count = w.ShopCart.count();
    var badge = $('#bagCount');
    if (badge) { badge.textContent = count ? String(count) : ''; badge.setAttribute('data-n', String(count)); }
    var box = $('#cartLines');
    if (!box) return;
    if (!lines.length) {
      box.innerHTML = '<p class="fine">Your bag is empty.</p>';
    } else {
      box.innerHTML = lines.map(function (line) {
        return '<article class="line"><img src="' + h(line.thumb) + '" alt="" width="84" height="104">' +
          '<div><h3>' + h(line.name) + '</h3><p>' + h(line.summary) + '</p>' +
          '<p>' + w.ShopCatalog.money(line.unit) + (line.pending && line.pending.length ? ' · ' + h(line.pending.join(', ')) + ' Not Charged' : '') + '</p>' +
          '<div class="qty"><button type="button" data-dec="' + h(line.id) + '" aria-label="Decrease Quantity">−</button><span>' + line.qty + '</span>' +
          '<button type="button" data-inc="' + h(line.id) + '" aria-label="Increase Quantity">+</button></div> ' +
          '<button class="text-btn" type="button" data-remove="' + h(line.id) + '">Remove</button></div></article>';
      }).join('');
    }
    var total = $('#cartTotal');
    if (total) total.textContent = w.ShopCatalog.money(w.ShopCart.total());
  }
  function openCart() {
    $('#cartDrawer').hidden = false;
    $('#cartBack').hidden = false;
    renderBag();
  }
  function closeCart() {
    $('#cartDrawer').hidden = true;
    $('#cartBack').hidden = true;
  }
  function bind() {
    $('#menuBtn').onclick = function () { $('#top').classList.toggle('nav-open'); };
    $('#openCart').onclick = openCart;
    $('#closeCart').onclick = closeCart;
    $('#cartBack').onclick = closeCart;
    $('#cartLines').onclick = function (ev) {
      var t = ev.target;
      if (t.getAttribute('data-inc')) w.ShopCart.update(t.getAttribute('data-inc'), { qty: lineQty(t.getAttribute('data-inc')) + 1 });
      if (t.getAttribute('data-dec')) w.ShopCart.update(t.getAttribute('data-dec'), { qty: Math.max(1, lineQty(t.getAttribute('data-dec')) - 1) });
      if (t.getAttribute('data-remove')) w.ShopCart.remove(t.getAttribute('data-remove'));
    };
    w.addEventListener('enesma-cart', renderBag);
    renderBag();
  }
  function lineQty(id) {
    var found = w.ShopCart.items().filter(function (l) { return l.id === id; })[0];
    return found ? found.qty : 1;
  }
  function memberRole(user) {
    if (!user) return false;
    if (user.owner === true) return true;
    var roles = [user.role].concat(user.roles || []).map(function (r) { return String(r || '').toLowerCase(); });
    var ok = ['admin', 'owner', 'agent', 'tc', 'preferred', 'preferred_partner', 'preferred-partner', 'partner'];
    return roles.some(function (r) { return ok.indexOf(r) >= 0; });
  }
  function gate() {
    var mode = (w.ENESMA_SHOP && w.ENESMA_SHOP.ACCESS_MODE) || 'open';
    if (mode !== 'members') return Promise.resolve(true);
    if (location.pathname.indexOf('/admin') >= 0) return Promise.resolve(true);
    var token = cookie('enesma_sso');
    if (!token) return Promise.resolve(false);
    return w.ShopApi.hub('me', { token: token }).then(function (d) {
      var user = (d && d.user) || d;
      return memberRole(user);
    }).catch(function () { return false; });
  }
  function showGate() {
    $('#content').innerHTML = '<div class="gate"><div class="cardish"><h1>ENESMA Shop</h1>' +
      '<p>This shop is open to ENESMA agents, admins, and preferred partners.</p>' +
      '<p><a class="btn" href="' + h((w.ENESMA_SHOP || {}).HUB_LOGIN_URL || 'https://agent.enesmarealty.com/') + '">Sign In</a></p></div></div>';
  }
  function mount() {
    var app = document.getElementById('app');
    app.innerHTML = header() + '<main id="content"></main>' + footer() + drawer();
    bind();
    return gate().then(function (ok) { if (!ok) showGate(); return ok; });
  }
  w.ShopUI = { h: h, mount: mount, openCart: openCart, closeCart: closeCart, cookie: cookie, renderBag: renderBag, $: $ };
})(window);
