(function () {
  var UI = window.ShopUI;
  var h = UI.h;
  var SESSION = 'enesma_shop_admin';

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION) || 'null'); }
    catch (e) { return null; }
  }
  function saveSession(data) {
    sessionStorage.setItem(SESSION, JSON.stringify(data));
  }
  function clearSession() { sessionStorage.removeItem(SESSION); }

  function shell(inner) {
    document.title = 'Admin · ENESMA Shop';
    UI.$('#content').innerHTML = '<section class="section"><h1>Order History</h1>' + inner + '</section>';
  }

  function login(message) {
    var connected = window.ShopApi.connected();
    shell(
      (connected ? '' : '<div class="banner"><strong>Ordering not yet connected.</strong> Order history is available after the Apps Script web app URL is set in js/config.js.</div>') +
      (message ? '<p class="err">' + h(message) + '</p>' : '') +
      '<h2>ENESMA Owner Or Admin</h2>' +
      '<p class="lede">Use your existing ENESMA sign-in. This only opens shop order history for owner and admin roles.</p>' +
      '<button class="btn" id="hubBtn" type="button">Continue With ENESMA</button>' +
      '<p class="fine"><a href="' + h((window.ENESMA_SHOP || {}).HUB_LOGIN_URL) + '">Sign In On The Agent Hub</a>, then return here.</p>' +
      '<h2>Print Partner</h2>' +
      '<p class="lede">A one-time code is emailed to the print partner. This sign-in works on the shop only.</p>' +
      '<form id="codeForm"><div class="field"><label for="email">Email</label><input id="email" type="email" required autocomplete="username"></div>' +
      '<button class="btn secondary" id="sendCode" type="button"' + (connected ? '' : ' disabled') + '>Send Code</button>' +
      '<div class="field" id="codeField" hidden><label for="code">Code</label><input id="code" inputmode="numeric" autocomplete="one-time-code"></div>' +
      '<button class="btn" id="verifyBtn" type="submit" hidden>Sign In</button></form>' +
      '<p class="err" id="loginErr" hidden></p>'
    );
    var hubBtn = UI.$('#hubBtn');
    hubBtn.onclick = function () {
      var token = UI.cookie('enesma_sso');
      if (!token) {
        location.href = (window.ENESMA_SHOP || {}).HUB_LOGIN_URL;
        return;
      }
      window.ShopApi.shop('sessionFromHub', { hubToken: token }).then(function (data) {
        saveSession(data);
        historyView();
      }).catch(function (err) {
        var box = UI.$('#loginErr');
        box.hidden = false;
        box.textContent = err.code === 'SETUP' ? 'Ordering not yet connected.' : err.message;
      });
    };
    UI.$('#sendCode').onclick = function () {
      window.ShopApi.shop('requestCode', { email: UI.$('#email').value }).then(function () {
        UI.$('#codeField').hidden = false;
        UI.$('#verifyBtn').hidden = false;
        var box = UI.$('#loginErr');
        box.hidden = false;
        box.className = 'ok';
        box.textContent = 'If this email is allowed, a code is on the way.';
      }).catch(function (err) {
        var box = UI.$('#loginErr');
        box.hidden = false;
        box.className = 'err';
        box.textContent = err.code === 'SETUP' ? 'Ordering not yet connected.' : err.message;
      });
    };
    UI.$('#codeForm').onsubmit = function (ev) {
      ev.preventDefault();
      window.ShopApi.shop('verifyCode', { email: UI.$('#email').value, code: UI.$('#code').value }).then(function (data) {
        saveSession(data);
        historyView();
      }).catch(function (err) {
        var box = UI.$('#loginErr');
        box.hidden = false;
        box.className = 'err';
        box.textContent = err.message;
      });
    };
    if (new URLSearchParams(location.search).get('preview') === '1' && !connected) sampleHistory();
  }

  function sampleHistory() {
    var samples = [
      { orderNumber: 'ES-SAMPLE-1001', createdAt: '2026-11-18 09:40', status: 'New', buyerName: 'Sample Agent', buyerEmail: 'agent@example.com', buyerPhone: '555-0100', total: 63.65, items: [{ name: 'T-Shirt', summary: 'Black · M', qty: 2, lineTotal: 39.3 }, { name: 'Business Cards', summary: 'White · Set Of 500', qty: 1, lineTotal: 51 }] },
      { orderNumber: 'ES-SAMPLE-1002', createdAt: '2026-11-17 15:10', status: 'Sent To Printer', buyerName: 'Sample Partner', buyerEmail: 'partner@example.com', buyerPhone: '555-0199', total: 134, items: [{ name: 'Open House Signs', summary: 'Black · Bundle Of 15', qty: 1, lineTotal: 134 }] }
    ];
    renderOrders(samples, true);
  }

  function historyView() {
    var sess = session();
    if (!sess) return login();
    shell('<p class="fine">Signed in as ' + h(sess.email || '') + ' · ' + h(roleLabel(sess.role)) + ' <button class="text-btn" id="signOut" type="button">Sign Out</button></p>' +
      '<div class="field"><label for="q">Search</label><input id="q" placeholder="Name, email, or order number"></div><div id="orders" class="orders"><p>Loading</p></div><div id="detail"></div>');
    UI.$('#signOut').onclick = function () {
      window.ShopApi.shop('logout', { token: sess.token }).catch(function () {});
      clearSession();
      login();
    };
    function load() {
      window.ShopApi.shop('listOrders', { token: sess.token, q: UI.$('#q').value || '' }).then(function (data) {
        renderOrders(data.orders || [], false, sess);
      }).catch(function (err) {
        if (err.code === 'AUTH') { clearSession(); login(err.message); return; }
        UI.$('#orders').innerHTML = '<p class="err">' + h(err.message) + '</p>';
      });
    }
    UI.$('#q').oninput = load;
    load();
  }

  function roleLabel(role) {
    if (role === 'print_partner') return 'Print Partner';
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Signed In';
  }

  function renderOrders(orders, sample, sess) {
    var box = UI.$('#orders') || document.getElementById('orders');
    if (!UI.$('#orders')) {
      shell((sample ? '<div class="banner"><strong>Sample orders.</strong> Ordering not yet connected, so these are not real customer orders.</div>' : '') + '<div id="orders" class="orders"></div><div id="detail"></div>');
    } else if (sample) {
      UI.$('#content').querySelector('.section').insertAdjacentHTML('afterbegin', '<div class="banner"><strong>Sample orders.</strong> Ordering not yet connected, so these are not real customer orders.</div>');
    }
    UI.$('#orders').innerHTML = orders.length ? orders.map(function (order) {
      return '<button class="order" type="button" data-id="' + h(order.orderNumber) + '"><b>' + h(order.orderNumber) + '</b><div class="status">' + h(order.status) + ' · ' + h(order.createdAt || '') + '</div><div>' + h(order.buyerName || '') + '</div><div>' + window.ShopCatalog.money(order.total || order.estimatedTotal || 0) + '</div></button>';
    }).join('') : '<p>No orders yet.</p>';
    UI.$('#orders').onclick = function (ev) {
      var btn = ev.target.closest('[data-id]');
      if (!btn) return;
      var order = orders.filter(function (o) { return o.orderNumber === btn.getAttribute('data-id'); })[0];
      if (sample) showDetail(order, null);
      else {
        window.ShopApi.shop('getOrder', { token: sess.token, orderNumber: order.orderNumber }).then(function (data) {
          showDetail(data.order, sess);
        });
      }
    };
  }

  function showDetail(order, sess) {
    var items = order.items || [];
    UI.$('#detail').innerHTML = '<h2>' + h(order.orderNumber) + '</h2>' +
      '<p>' + h(order.buyerName) + '<br>' + h(order.buyerEmail) + '<br>' + h(order.buyerPhone) + '</p>' +
      (order.notes ? '<p>' + h(order.notes) + '</p>' : '') +
      '<ul class="detail-list">' + items.map(function (item) {
        return '<li><b>' + h(item.name) + '</b> × ' + h(item.qty) + '<br>' + h(item.summary || item.variant || '') +
          (item.agentName ? '<br>Name: ' + h(item.agentName) : '') +
          (item.personal && item.personal.dre ? '<br>DRE: ' + h(item.personal.dre) : '') +
          (item.personal && item.personal.photoLink ? '<br><a href="' + h(item.personal.photoLink) + '">Photo</a>' : '') +
          '<br>' + window.ShopCatalog.money(item.lineTotal || 0) + '</li>';
      }).join('') + '</ul>' +
      (sess ? '<div class="field"><label for="status">Status</label><select id="status">' +
        ['New', 'Sent To Printer', 'Completed'].map(function (s) {
          return '<option' + (order.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></div><button class="btn" id="saveStatus" type="button">Save Status</button>' : '');
    var save = UI.$('#saveStatus');
    if (save) save.onclick = function () {
      window.ShopApi.shop('setStatus', { token: sess.token, orderNumber: order.orderNumber, status: UI.$('#status').value }).then(function () {
        historyView();
      });
    };
  }

  if (session() && window.ShopApi.connected()) historyView();
  else login();
})();
