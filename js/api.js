(function (w) {
  function cfg() { return w.ENESMA_SHOP || {}; }
  function connected() { return !!cfg().APPS_SCRIPT_URL; }
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('Server error ' + r.status);
      return r.json();
    }).then(function (res) {
      if (res && res.ok) return res.data;
      var err = new Error((res && res.error) || 'Something went wrong.');
      err.code = res && res.code;
      throw err;
    });
  }
  function shop(action, params) {
    if (!connected()) {
      var err = new Error('Ordering not yet connected.');
      err.code = 'SETUP';
      return Promise.reject(err);
    }
    return post(cfg().APPS_SCRIPT_URL, Object.assign({ action: action }, params || {}));
  }
  function hub(action, params) {
    if (!cfg().HUB_API_URL) return Promise.reject(new Error('ENESMA sign-in is not configured.'));
    return post(cfg().HUB_API_URL, Object.assign({ action: action }, params || {}));
  }
  w.ShopApi = { connected: connected, shop: shop, hub: hub };
})(window);
