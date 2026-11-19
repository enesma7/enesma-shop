/**
 * ENESMA Shop orders.
 * Deploy as a web app: Execute as me, Who has access: Anyone.
 * All secrets and access lists live in Script Properties. See DEPLOY.md.
 *
 * Print Partner access is enforced only in this script. It never calls the
 * Agent Hub or Transaction Center except to read an existing ENESMA session
 * (`me`) when an owner or admin continues with their ENESMA sign-in.
 */
var SHOP = {
  statuses: ['New', 'Sent To Printer', 'Completed'],
  personalSkus: {
    'for-sale-plastic': true,
    'for-sale-aluminum': true,
    'open-house': true,
    'a-frame': true,
    'cards-500': true,
    'cards-1000': true
  }
};

function doGet() {
  return json({ ok: true, data: { service: 'enesma-shop' } });
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'The order could not be read.', code: 'BAD_REQUEST' });
  }
  var action = String(body.action || '');
  try {
    var data;
    if (action === 'placeOrder') data = placeOrder(body);
    else if (action === 'requestCode') data = requestCode(body);
    else if (action === 'verifyCode') data = verifyCode(body);
    else if (action === 'sessionFromHub') data = sessionFromHub(body);
    else if (action === 'me') data = { user: publicUser(requireSession(body)) };
    else if (action === 'logout') data = logout(body);
    else if (action === 'listOrders') data = listOrders(body);
    else if (action === 'getOrder') data = getOrder(body);
    else if (action === 'setStatus') data = setStatus(body);
    else {
      var unknown = new Error('Unknown action.');
      unknown.code = 'BAD_REQUEST';
      throw unknown;
    }
    return json({ ok: true, data: data });
  } catch (err) {
    return json({ ok: false, error: err.message || 'Something went wrong.', code: err.code || 'ERROR' });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function props() { return PropertiesService.getScriptProperties(); }

function fail(message, code) {
  var err = new Error(message);
  err.code = code || 'ERROR';
  throw err;
}

function placeOrder(body) {
  if (String(body.website || body.company_website || body.company || '').trim()) fail('Unable to place this order.', 'SPAM');
  var buyer = {
    name: clean(body.buyerName, 80),
    email: normalizeEmail(body.buyerEmail),
    phone: clean(body.buyerPhone, 40),
    notes: clean(body.notes, 1000)
  };
  if (!buyer.name || !buyer.phone || !isEmail(buyer.email)) fail('Name, email, and phone are required.', 'BAD_REQUEST');
  rateLimit('order:' + buyer.email, 6, 3600);
  rateLimit('order:shop', 40, 3600);
  var items = body.items;
  if (!items || !items.length || items.length > 40) fail('Add at least one item.', 'BAD_REQUEST');
  var cleanItems = [];
  var total = 0;
  var photos = [];
  for (var i = 0; i < items.length; i++) {
    var item = sanitizeItem(items[i], i);
    total += item.lineTotal;
    if (item.personal && item.personal.photoData) {
      photos.push({ index: cleanItems.length, mime: item.personal.photoMime, name: item.personal.photoName, data: item.personal.photoData });
      delete item.personal.photoData;
    }
    cleanItems.push(item);
  }
  total = Math.round(total * 100) / 100;
  if (total < 0 || total > 20000) fail('This order total cannot be accepted.', 'BAD_REQUEST');
  var orderNumber = makeOrderNumber();
  var photoLinks = [];
  for (var p = 0; p < photos.length; p++) {
    var link = savePhoto(photos[p], orderNumber);
    cleanItems[photos[p].index].personal.photoLink = link;
    photoLinks.push(link);
  }
  var created = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
  var record = {
    orderNumber: orderNumber,
    createdAt: created,
    status: 'New',
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    buyerPhone: buyer.phone,
    notes: buyer.notes,
    items: cleanItems,
    total: total,
    photoLinks: photoLinks.join(' ')
  };
  appendOrder(record);
  sendOrderMail(record);
  return { orderNumber: orderNumber, total: total, status: 'New' };
}

function sanitizeItem(item, index) {
  var qty = Math.round(Number(item.qty));
  var unit = Number(item.unitPrice);
  if (!qty || qty < 1 || qty > 30) fail('Check the quantity on item ' + (index + 1) + '.', 'BAD_REQUEST');
  if (!isFinite(unit) || unit < 0 || unit > 2000) fail('Check the price on item ' + (index + 1) + '.', 'BAD_REQUEST');
  var sku = clean(item.sku, 40);
  var personal = item.personal || {};
  var cleanedPersonal = {
    name: clean(personal.name, 80),
    phone: clean(personal.phone, 40),
    email: clean(personal.email, 80),
    dre: clean(personal.dre, 30),
    photoMode: personal.photoMode === 'upload' ? 'upload' : (personal.photoMode ? 'email' : ''),
    photoName: clean(personal.photoName, 80),
    photoMime: allowedMime(personal.photoMime),
    photoData: ''
  };
  if (SHOP.personalSkus[sku]) {
    if (!cleanedPersonal.name || !cleanedPersonal.phone || !isEmail(cleanedPersonal.email) || !cleanedPersonal.dre) {
      fail('Name, phone, email, and DRE # are required for ' + (item.name || 'this item') + '.', 'BAD_REQUEST');
    }
    if (cleanedPersonal.photoMode === 'upload') {
      var raw = String(personal.photoData || '');
      if (raw.indexOf(',') >= 0) raw = raw.split(',').pop();
      if (!raw || raw.length > 2.2e6) fail('The photo on item ' + (index + 1) + ' is missing or too large.', 'BAD_REQUEST');
      cleanedPersonal.photoData = raw;
      if (!cleanedPersonal.photoMime) cleanedPersonal.photoMime = 'image/jpeg';
    }
  } else {
    cleanedPersonal.photoData = '';
  }
  var lineTotal = Math.round(unit * qty * 100) / 100;
  return {
    sku: sku,
    name: clean(item.name, 80),
    detail: clean(item.detail, 80),
    color: clean(item.color, 20),
    size: clean(item.size, 10),
    variant: clean(item.variant || item.summary, 240),
    summary: clean(item.summary || item.variant, 240),
    qty: qty,
    unitPrice: Math.round(unit * 100) / 100,
    lineTotal: lineTotal,
    pending: (item.pending || []).map(function (x) { return clean(x, 40); }).slice(0, 4),
    agentName: clean(item.agentName, 40),
    backEmblem: item.backEmblem === true,
    personal: cleanedPersonal
  };
}

function allowedMime(mime) {
  mime = String(mime || '').toLowerCase();
  if (mime === 'image/png' || mime === 'image/webp' || mime === 'image/jpeg') return mime;
  return '';
}

function savePhoto(photo, orderNumber) {
  var folderId = props().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) fail('Photo storage is not configured.', 'SETUP');
  var bytes = Utilities.base64Decode(photo.data);
  var blob = Utilities.newBlob(bytes, photo.mime || 'image/jpeg', orderNumber + '-' + (photo.name || 'photo.jpg'));
  var file = DriveApp.getFolderById(folderId).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function appendOrder(record) {
  var sheet = ordersSheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet.appendRow([
      record.orderNumber,
      record.createdAt,
      record.status,
      record.buyerName,
      record.buyerEmail,
      record.buyerPhone,
      record.notes,
      JSON.stringify(record.items),
      record.total,
      record.photoLinks,
      record.createdAt
    ]);
  } finally {
    lock.releaseLock();
  }
}

function ordersSheet() {
  var id = props().getProperty('ORDERS_SHEET_ID');
  if (!id) fail('The orders sheet is not configured.', 'SETUP');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Order Number', 'Created At', 'Status', 'Buyer Name', 'Buyer Email', 'Buyer Phone', 'Notes', 'Items', 'Estimated Total', 'Photo Links', 'Updated At']);
  }
  return sheet;
}

function sendOrderMail(record) {
  var to = String(props().getProperty('ORDER_TO') || '').trim();
  var cc = String(props().getProperty('ORDER_CC') || '').trim();
  if (!to) fail('The print shop recipient is not configured.', 'SETUP');
  var rows = record.items.map(function (item) {
    return '<tr><td>' + esc(item.name) + '</td><td>' + esc(item.color) + '</td><td>' + esc(item.size) + '</td><td>' + esc(item.summary) +
      '</td><td>' + item.qty + '</td><td>' + money(item.unitPrice) + '</td><td>' + money(item.lineTotal) + '</td><td>' +
      esc(item.agentName || '') + '</td><td>' + (item.backEmblem ? 'Yes' : '') + '</td><td>' +
      esc(item.personal && item.personal.name || '') + '</td><td>' + esc(item.personal && item.personal.phone || '') + '</td><td>' +
      esc(item.personal && item.personal.email || '') + '</td><td>' + esc(item.personal && item.personal.dre || '') + '</td><td>' +
      (item.personal && item.personal.photoLink ? '<a href="' + esc(item.personal.photoLink) + '">Photo</a>' : esc(item.personal && item.personal.photoMode || '')) +
      '</td></tr>';
  }).join('');
  var html = '<p>New ENESMA Shop order <b>' + esc(record.orderNumber) + '</b>.</p>' +
    '<p>' + esc(record.buyerName) + '<br>' + esc(record.buyerEmail) + '<br>' + esc(record.buyerPhone) + '</p>' +
    (record.notes ? '<p>Notes: ' + esc(record.notes) + '</p>' : '') +
    '<table border="1" cellpadding="6" cellspacing="0"><tr><th>Item</th><th>Color</th><th>Size</th><th>Options</th><th>Qty</th><th>Unit</th><th>Line</th><th>Agent Name</th><th>Back Emblem</th><th>Print Name</th><th>Print Phone</th><th>Print Email</th><th>DRE</th><th>Photo</th></tr>' +
    rows + '</table><p>Estimated total ' + money(record.total) + '. Pending back-emblem prices and one-time setup fees are not included. Please contact the buyer to confirm and collect payment.</p>';
  var mail = {
    to: to,
    replyTo: record.buyerEmail,
    subject: 'ENESMA Shop Order ' + record.orderNumber,
    htmlBody: html
  };
  if (cc) mail.cc = cc;
  MailApp.sendEmail(mail);
}

function requestCode(body) {
  var email = normalizeEmail(body.email);
  if (!isEmail(email)) fail('Enter a valid email.', 'BAD_REQUEST');
  rateLimit('otp:' + email, 5, 3600);
  var role = roleForEmail(email);
  if (role) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var salt = Utilities.getUuid();
    CacheService.getScriptCache().put('otp:' + email, JSON.stringify({
      salt: salt,
      hash: hashCode(salt, code),
      role: role,
      tries: 0
    }), 600);
    MailApp.sendEmail({
      to: email,
      subject: 'Your ENESMA Shop Sign-In Code',
      body: 'Your ENESMA Shop code is ' + code + '. It expires in 10 minutes. This code only signs you in to ENESMA Shop order history.'
    });
  }
  return { sent: true, message: 'If this email is allowed, a code is on the way.' };
}

function verifyCode(body) {
  var email = normalizeEmail(body.email);
  var code = String(body.code || '').replace(/\s/g, '');
  rateLimit('otptry:' + email, 12, 3600);
  var cache = CacheService.getScriptCache();
  var raw = cache.get('otp:' + email);
  if (!raw) fail('That code is not valid anymore. Request a new one.', 'AUTH');
  var rec = JSON.parse(raw);
  rec.tries = (rec.tries || 0) + 1;
  if (rec.tries > 5) {
    cache.remove('otp:' + email);
    fail('That code is not valid anymore. Request a new one.', 'AUTH');
  }
  cache.put('otp:' + email, JSON.stringify(rec), 600);
  if (!timingEqual(rec.hash, hashCode(rec.salt, code))) fail('That code does not match.', 'AUTH');
  cache.remove('otp:' + email);
  return issueSession(email, rec.role, '');
}

function sessionFromHub(body) {
  var token = String(body.hubToken || '');
  if (!token) fail('Sign in on the Agent Hub first.', 'AUTH');
  var hub = String(props().getProperty('HUB_API_URL') || '').trim();
  if (!hub) fail('ENESMA sign-in is not configured.', 'SETUP');
  var res = UrlFetchApp.fetch(hub, {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify({ action: 'me', token: token }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var parsed;
  try { parsed = JSON.parse(res.getContentText()); } catch (err) { fail('ENESMA sign-in was not accepted.', 'AUTH'); }
  if (!parsed || !parsed.ok) fail('ENESMA sign-in was not accepted.', 'AUTH');
  var user = (parsed.data && parsed.data.user) || parsed.data || {};
  if (!isHubOwnerOrAdmin(user)) fail('Order history is limited to ENESMA owners and admins.', 'FORBIDDEN');
  var email = normalizeEmail(user.email || user.username || '');
  if (!email) fail('ENESMA sign-in did not include an email.', 'AUTH');
  return issueSession(email, user.owner === true ? 'owner' : 'admin', clean(user.name || '', 80));
}

function isHubOwnerOrAdmin(user) {
  if (!user) return false;
  if (user.owner === true) return true;
  var role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner') return true;
  var roles = user.roles || [];
  for (var i = 0; i < roles.length; i++) {
    var r = String(roles[i] || '').toLowerCase();
    if (r === 'admin' || r === 'owner') return true;
  }
  return false;
}

function roleForEmail(email) {
  var admins = String(props().getProperty('SHOP_OWNER_ADMINS') || '').toLowerCase().split(/[,\s]+/);
  for (var i = 0; i < admins.length; i++) if (admins[i] && admins[i] === email) return 'admin';
  var partner = normalizeEmail(props().getProperty('SHOP_PRINT_PARTNER') || '');
  if (partner && partner === email) return 'print_partner';
  return '';
}

function issueSession(email, role, name) {
  if (role !== 'owner' && role !== 'admin' && role !== 'print_partner') fail('Not allowed.', 'FORBIDDEN');
  var token = Utilities.getUuid() + Utilities.getUuid();
  var sessions = readSessions();
  var now = Date.now();
  Object.keys(sessions).forEach(function (key) {
    if (!sessions[key] || sessions[key].exp < now) delete sessions[key];
  });
  var keys = Object.keys(sessions);
  if (keys.length > 40) delete sessions[keys[0]];
  sessions[tokenHash(token)] = { email: email, role: role, name: name || '', exp: now + 8 * 60 * 60 * 1000 };
  props().setProperty('SESSIONS', JSON.stringify(sessions));
  return { token: token, email: email, role: role, name: name || '', exp: now + 8 * 60 * 60 * 1000 };
}

function requireSession(body) {
  var token = String(body.token || '');
  if (!token) fail('Sign in required.', 'AUTH');
  var rec = readSessions()[tokenHash(token)];
  if (!rec || rec.exp < Date.now()) fail('Sign in required.', 'AUTH');
  if (rec.role !== 'owner' && rec.role !== 'admin' && rec.role !== 'print_partner') fail('Sign in required.', 'AUTH');
  return rec;
}

function publicUser(rec) {
  return { email: rec.email, role: rec.role, name: rec.name || '' };
}

function logout(body) {
  var token = String(body.token || '');
  if (!token) return { ok: true };
  var sessions = readSessions();
  delete sessions[tokenHash(token)];
  props().setProperty('SESSIONS', JSON.stringify(sessions));
  return { ok: true };
}

function readSessions() {
  try { return JSON.parse(props().getProperty('SESSIONS') || '{}') || {}; }
  catch (err) { return {}; }
}

function listOrders(body) {
  requireSession(body);
  var q = String(body.q || '').toLowerCase().trim();
  var rows = readOrderRows();
  var orders = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var order = rows[i];
    var hay = (order.orderNumber + ' ' + order.buyerName + ' ' + order.buyerEmail + ' ' + order.status).toLowerCase();
    if (q && hay.indexOf(q) < 0) continue;
    orders.push({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      total: order.total
    });
  }
  return { orders: orders };
}

function getOrder(body) {
  requireSession(body);
  var want = String(body.orderNumber || '');
  var rows = readOrderRows();
  for (var i = rows.length - 1; i >= 0; i--) if (rows[i].orderNumber === want) return { order: rows[i] };
  fail('Order not found.', 'NOT_FOUND');
}

function setStatus(body) {
  requireSession(body);
  var status = String(body.status || '');
  if (SHOP.statuses.indexOf(status) < 0) fail('Choose a valid status.', 'BAD_REQUEST');
  var want = String(body.orderNumber || '');
  var sheet = ordersSheet();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === want) {
      var updated = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
      sheet.getRange(i + 1, 3).setValue(status);
      sheet.getRange(i + 1, 11).setValue(updated);
      return { orderNumber: want, status: status };
    }
  }
  fail('Order not found.', 'NOT_FOUND');
}

function readOrderRows() {
  var sheet = ordersSheet();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    var items = [];
    try { items = JSON.parse(values[i][7] || '[]'); } catch (err) { items = []; }
    out.push({
      orderNumber: String(values[i][0]),
      createdAt: String(values[i][1] || ''),
      status: String(values[i][2] || 'New'),
      buyerName: String(values[i][3] || ''),
      buyerEmail: String(values[i][4] || ''),
      buyerPhone: String(values[i][5] || ''),
      notes: String(values[i][6] || ''),
      items: items,
      total: Number(values[i][8] || 0),
      photoLinks: String(values[i][9] || ''),
      updatedAt: String(values[i][10] || '')
    });
  }
  return out;
}

function makeOrderNumber() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Los_Angeles', 'yyyyMMdd-HHmmss');
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var tail = '';
  for (var i = 0; i < 4; i++) tail += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  return 'ES-' + stamp + '-' + tail;
}

function rateLimit(key, max, seconds) {
  var cache = CacheService.getScriptCache();
  var count = Number(cache.get('rl:' + key) || '0');
  if (count >= max) fail('Too many requests. Please wait and try again.', 'RATE');
  cache.put('rl:' + key, String(count + 1), seconds);
}

function hashCode(salt, code) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + code, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function tokenHash(token) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function timingEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function clean(value, max) { return String(value || '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, max); }
function money(n) { return '$' + (Math.round(Number(n) * 100) / 100).toFixed(2); }
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
