/* ENESMA Shop catalog. Edit prices and copy here.
   backEmblemPrice: null shows "Back Emblem (Pending Price)" and does not charge it.
   Set a number (USD) when Grafek confirms the price. */
(function (w) {
  var C = {
    backEmblemPrice: null,
    agentNamePrice: 10,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    products: [
      {
        id: 't-shirt',
        category: 'gear',
        name: 'T-Shirt',
        detail: 'Gildan 8000',
        blurb: 'DTF print with the ENESMA Realty logo centered on the chest. White or Black. Sizes S through XXL.',
        price: 19.65,
        priceXXL: 22.60,
        model: 't-shirt',
        sizes: true,
        agentName: false,
        backEmblem: true,
        personal: false
      },
      {
        id: 'polo',
        category: 'gear',
        name: 'Polo',
        detail: 'Sport-Tek ST640',
        blurb: 'Embroidered logo on the left chest. Optional agent name on the sleeve.',
        price: 34.49,
        priceXXL: 35.84,
        model: 'polo',
        sizes: true,
        agentName: true,
        backEmblem: true,
        personal: false
      },
      {
        id: 'quarter-zip',
        category: 'gear',
        name: 'Quarter-Zip',
        detail: 'Sport-Tek ST581',
        blurb: 'Embroidered logo on the chest. Optional agent name on the sleeve.',
        price: 44.94,
        priceXXL: 51.24,
        model: 'quarter-zip',
        sizes: true,
        agentName: true,
        backEmblem: true,
        personal: false
      },
      {
        id: 'cap',
        category: 'gear',
        name: 'Cap',
        detail: 'Sport-Tek STC26',
        blurb: 'Embroidered logo on the front. Optional agent name on the side.',
        price: 30,
        model: 'cap',
        sizes: true,
        agentName: true,
        backEmblem: true,
        personal: false
      },
      {
        id: 'for-sale-plastic',
        category: 'signs',
        name: 'For Sale Sign',
        detail: '18×24 Plastic',
        blurb: 'Plastic rider sign, printed with your photo and contact details.',
        variants: [
          { id: 'single', label: 'Single', price: 60 },
          { id: 'pack2', label: 'Pack Of 2', price: 100 }
        ],
        sizes: false,
        agentName: false,
        backEmblem: false,
        personal: true
      },
      {
        id: 'for-sale-aluminum',
        category: 'signs',
        name: 'For Sale Sign',
        detail: '18×24 Aluminum',
        blurb: 'Aluminum rider sign, printed with your photo and contact details.',
        variants: [
          { id: 'single', label: 'Single', price: 85 },
          { id: 'pack2', label: 'Pack Of 2', price: 158 }
        ],
        sizes: false,
        agentName: false,
        backEmblem: false,
        personal: true
      },
      {
        id: 'open-house',
        category: 'signs',
        name: 'Open House Signs',
        detail: '12×18 · Bundle Of 15',
        image: { w: 2400, h: 1600 },
        blurb: 'A bundle of 15 open house signs, printed with your photo and contact details.',
        price: 134,
        sizes: false,
        agentName: false,
        backEmblem: false,
        personal: true
      },
      {
        id: 'a-frame',
        category: 'signs',
        name: 'Open House A-Frame',
        detail: 'Wire Stand · Bundle Of 5',
        image: { w: 1800, h: 2250 },
        blurb: 'A bundle of 5 black wire A-frame stands. A landscape open house sign hangs from the top bar, printed with your photo and contact details.',
        price: 320,
        sizes: false,
        agentName: false,
        backEmblem: false,
        personal: true
      },
      {
        id: 'cards-1000',
        category: 'cards',
        name: 'Business Cards',
        detail: 'Set Of 1,000',
        blurb: 'A set of 1,000 business cards, printed with your photo and contact details.',
        price: 57,
        sizes: false,
        agentName: false,
        backEmblem: false,
        personal: true
      }
    ]
  };

  function round(n) { return Math.round(n * 100) / 100; }
  function money(n) {
    var v = round(Number(n) || 0);
    return '$' + v.toFixed(2);
  }
  function find(id) {
    for (var i = 0; i < C.products.length; i++) if (C.products[i].id === id) return C.products[i];
    return null;
  }
  function byCategory(cat) {
    return C.products.filter(function (p) { return p.category === cat; });
  }
  function renderBase(id, color, view) {
    return 'assets/renders/' + id + '-' + (color || 'black') + '-' + (view || 'hero');
  }
  function priceOf(product, sel) {
    sel = sel || {};
    var base = product.price;
    var variantLabel = '';
    if (product.variants && product.variants.length) {
      var wanted = sel.variantId || product.variants[0].id;
      var variant = null;
      for (var i = 0; i < product.variants.length; i++) if (product.variants[i].id === wanted) variant = product.variants[i];
      if (!variant) variant = product.variants[0];
      base = variant.price;
      variantLabel = variant.label;
    } else if (sel.size === 'XXL' && product.priceXXL != null) {
      base = product.priceXXL;
    }
    var add = 0;
    var pending = [];
    var nameText = String(sel.agentNameText || '').trim();
    if (product.agentName && sel.agentName && nameText) add += C.agentNamePrice;
    if (product.backEmblem && sel.backEmblem) {
      if (C.backEmblemPrice == null) pending.push('Back Emblem');
      else add += Number(C.backEmblemPrice) || 0;
    }
    var from = product.variants ? product.variants[0].price : product.price;
    if (product.variants) {
      for (var j = 1; j < product.variants.length; j++) from = Math.min(from, product.variants[j].price);
    }
    return {
      unit: round(base + add),
      base: round(base),
      add: round(add),
      pending: pending,
      variantLabel: variantLabel,
      from: round(from)
    };
  }
  function optionSummary(product, sel) {
    sel = sel || {};
    var bits = [];
    if (sel.color) bits.push(sel.color === 'white' ? 'White' : 'Black');
    if (product.sizes && sel.size) bits.push(sel.size);
    var priced = priceOf(product, sel);
    if (priced.variantLabel) bits.push(priced.variantLabel);
    if (product.agentName && sel.agentName && String(sel.agentNameText || '').trim()) bits.push('Name: ' + String(sel.agentNameText).trim());
    if (product.backEmblem && sel.backEmblem) bits.push(C.backEmblemPrice == null ? 'Back Emblem (Pending Price)' : 'Back Emblem');
    var person = sel.personal || {};
    if (product.personal && person.name) bits.push(person.name);
    return bits.join(' · ');
  }

  w.ENESMA_CATALOG = C;
  w.ShopCatalog = {
    all: function () { return C.products.slice(); },
    find: find,
    byCategory: byCategory,
    priceOf: priceOf,
    money: money,
    renderBase: renderBase,
    imageSize: function (id) {
      var product = find(id);
      return (product && product.image) || { w: 1600, h: 2000 };
    },
    optionSummary: optionSummary
  };
})(window);
