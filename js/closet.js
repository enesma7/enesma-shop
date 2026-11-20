import * as THREE from 'three';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

// Hanger and clip photos. contact is the point that rests on the rail,
// as a fraction of the image. neck is the top of the velvet, where the collar sits.
const HANGER = { src: 'hanger.png', w: 1079, h: 770, contact: [524 / 1079, 68 / 770], neck: 373 / 770 };
const CLIP = { src: 'clip.png', w: 330, h: 773, contact: [171 / 330, 36 / 773], grip: 300 / 773 };

const SPECS = [
  {
    sku: 't-shirt', hang: 't-shirt', w: 0.94, h: 1.08, support: 0.58, neckDrop: -0.01, emblem: true,
    neck: {
      black: { front: [0.500, 0.128], back: [0.500, 0.128] },
      white: { front: [0.500, 0.128], back: [0.500, 0.128] }
    }
  },
  {
    sku: 'polo', hang: 'polo', w: 0.82, h: 1.14, support: 0.56, neckDrop: -0.006, emblem: true,
    neck: {
      black: { front: [0.462, 0.048], back: [0.484, 0.055] },
      white: { front: [0.462, 0.048], back: [0.511, 0.055] }
    }
  },
  {
    sku: 'quarter-zip', hang: 'quarter-zip', w: 0.90, h: 1.10, support: 0.50, neckDrop: -0.006, emblem: true,
    neck: {
      black: { front: [0.552, 0.105], back: [0.498, 0.105] },
      white: { front: [0.545, 0.105], back: [0.494, 0.105] }
    }
  },
  {
    sku: 'cap', hang: 'cap', w: 0.62, h: 0.48, support: 0.105, neckDrop: -0.03, emblem: false, clip: true,
    neck: {
      black: { front: [0.587, 0.073], back: [0.587, 0.073] },
      white: { front: [0.588, 0.077], back: [0.588, 0.077] }
    }
  }
];

const RAIL_Y = 0.56;
const SPACING = 0.86;

function boot() {
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const pill = document.getElementById('pill');
  const headline = document.getElementById('closetHeadline');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f2ee');
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);
  const rackCenter = SPACING * 1.5;

  scene.add(new THREE.AmbientLight('#fffaf6', 0.7));
  const key = new THREE.DirectionalLight('#fff8f2', 1.05);
  key.position.set(-0.6, 2.6, 2.2);
  scene.add(key);

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0125, 0.0125, SPACING * 3 + 1.15, 32),
    new THREE.MeshBasicMaterial({ map: metalTexture() })
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(rackCenter, RAIL_Y, -0.03);
  scene.add(rail);

  const loader = new THREE.TextureLoader();
  function loadMap(url) {
    return new Promise(function (resolve, reject) {
      loader.load(url, function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      }, undefined, reject);
    });
  }

  function photo(map, w, h) {
    const mat = new THREE.MeshBasicMaterial({
      map: map,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: true,
      side: THREE.FrontSide
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  // Put `frac` of the photo at local (0, y) and return the mesh position.
  function hangPosition(w, h, frac, y, z) {
    const px = (frac[0] - 0.5) * w;
    const py = (0.5 - frac[1]) * h;
    return new THREE.Vector3(-px, y - py, z);
  }

  const pieces = [];

  Promise.all([
    loadMap(window.SHOP_BASE + 'assets/gear/' + HANGER.src),
    loadMap(window.SHOP_BASE + 'assets/gear/' + CLIP.src),
    loadMap(window.SHOP_BASE + 'assets/gear/shadow.png')
  ]).then(function (shared) {
    const hangerMap = shared[0];
    const clipMap = shared[1];
    const shadowMap = shared[2];
    return Promise.all(SPECS.map(async function (spec, index) {
      const maps = {};
      for (const color of ['black', 'white']) {
        const base = window.SHOP_BASE + 'assets/gear/' + spec.hang + '-' + color;
        maps[color] = {
          front: await loadMap(base + '-front.png'),
          back: await loadMap(base + '-back.png'),
          backEmblem: spec.emblem ? await loadMap(base + '-back-emblem.png') : null
        };
      }
      const group = new THREE.Group();
      const ref = spec.clip ? CLIP : HANGER;
      const supportH = spec.support * (ref.h / ref.w);
      const support = photo(spec.clip ? clipMap : hangerMap, spec.support, supportH);
      support.position.copy(hangPosition(spec.support, supportH, ref.contact, 0, spec.clip ? 0.02 : 0.012));
      support.renderOrder = 1;
      const neckFrac = spec.clip ? ref.grip : ref.neck;
      const neckY = (ref.contact[1] - neckFrac) * supportH - spec.neckDrop;
      const cloth = photo(maps.black.front, spec.w, spec.h);
      const backCloth = photo(maps.black.back, spec.w, spec.h);
      cloth.renderOrder = 2;
      backCloth.renderOrder = 2;
      backCloth.material.opacity = 0;
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.w * 0.7, spec.h * 0.28),
        new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity: 0.45 })
      );
      shadow.position.set(0.03, neckY - spec.h * 0.32, -0.08);
      shadow.renderOrder = 0;
      group.add(shadow, support, cloth, backCloth);
      const x = index * SPACING;
      group.position.set(x, RAIL_Y, 0);
      scene.add(group);
      pieces[index] = {
        spec: spec,
        group: group,
        support: support,
        cloth: cloth,
        backCloth: backCloth,
        shadow: shadow,
        maps: maps,
        neckY: neckY,
        homeX: x,
        x: x,
        scale: 1,
        opacity: 1,
        angle: 0,
        frontMix: 1,
        backMix: 0
      };
      placeGarments(pieces[index], 'black');
    }));
  }).then(start).catch(function () {
    sheet.hidden = false;
    sheet.innerHTML = '<h2>Gear</h2><p class="hint">The closet photos could not be loaded.</p>';
  });

  let hover = null;
  let active = null;
  let mode = 'rack';
  const colorState = { color: 'black', size: 'M', agentName: false, agentNameText: '', backEmblem: false };

  function placeGarments(piece, color) {
    const neck = piece.spec.neck[color] || piece.spec.neck.black;
    piece.cloth.position.copy(hangPosition(piece.spec.w, piece.spec.h, neck.front, piece.neckY, 0.04));
    piece.backCloth.position.copy(hangPosition(piece.spec.w, piece.spec.h, neck.back, piece.neckY, 0.04));
  }

  function applyVisuals() {
    pieces.forEach(function (piece) {
      piece.group.position.x += (piece.x - piece.group.position.x) * 0.18;
      piece.group.rotation.y = 0;
      const s = piece.group.scale.x + (piece.scale - piece.group.scale.x) * 0.18;
      piece.group.scale.setScalar(s);
      const frontMat = piece.cloth.material;
      const backMat = piece.backCloth.material;
      frontMat.opacity += (piece.frontMix * piece.opacity - frontMat.opacity) * 0.22;
      backMat.opacity += (piece.backMix * piece.opacity - backMat.opacity) * 0.22;
      frontMat.transparent = true;
      backMat.transparent = true;
      frontMat.depthWrite = frontMat.opacity > 0.85;
      backMat.depthWrite = backMat.opacity > 0.85;
      piece.support.material.opacity += (piece.opacity - piece.support.material.opacity) * 0.22;
      piece.support.material.transparent = true;
      piece.shadow.material.opacity += (0.5 * piece.opacity - piece.shadow.material.opacity) * 0.22;
    });
  }

  function layoutRack(focus) {
    pieces.forEach(function (piece) {
      let x = piece.homeX;
      if (focus && focus !== piece) x += piece.homeX < focus.homeX ? -0.16 : 0.16;
      piece.x = x;
      piece.scale = focus === piece ? 1.18 : 1;
      piece.opacity = 1;
      if (mode !== 'detail') {
        piece.angle = 0;
        piece.frontMix = 1;
        piece.backMix = 0;
      }
    });
  }

  function layoutDetail(focus) {
    pieces.forEach(function (piece) {
      if (piece === focus) {
        piece.x = rackCenter - 0.42;
        piece.scale = 1.34;
        piece.opacity = 1;
      } else {
        piece.x = piece.homeX < focus.homeX ? rackCenter - 2.4 : rackCenter + 2.4;
        piece.scale = 0.92;
        piece.opacity = 0.12;
        piece.frontMix = 1;
        piece.backMix = 0;
      }
    });
  }

  function frame() {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.aspect = aspect;
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    const fit = function (span) { return (span / Math.max(0.5, aspect)) / (2 * half); };
    let z = Math.max(3.6, fit(SPACING * 3 + 1.35));
    let lookX = rackCenter;
    let lookY = 0.08;
    if (mode === 'detail' && aspect < 1) {
      z = Math.max(3.3, fit(2.35));
      lookY = 0.16;
    }
    camera.position.set(lookX, lookY + 0.04, z);
    camera.lookAt(lookX, lookY, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  function turntable(angle) {
    const a = ((angle % 360) + 360) % 360;
    if (a < 50 || a > 310) return { front: 1, back: 0 };
    if (a < 90) {
      const t = (a - 50) / 40;
      return { front: 1 - t, back: t };
    }
    if (a < 230) return { front: 0, back: 1 };
    if (a < 270) {
      const t = (a - 230) / 40;
      return { front: t, back: 1 - t };
    }
    return { front: 1, back: 0 };
  }

  function applyTurn(piece) {
    const mix = turntable(piece.angle);
    piece.frontMix = mix.front;
    piece.backMix = mix.back;
    const color = colorState.color;
    const pack = piece.maps[color];
    const backMap = (colorState.backEmblem && pack.backEmblem) ? pack.backEmblem : pack.back;
    if (piece.cloth.material.map !== pack.front) {
      piece.cloth.material.map = pack.front;
      piece.cloth.material.needsUpdate = true;
    }
    if (piece.backCloth.material.map !== backMap) {
      piece.backCloth.material.map = backMap;
      piece.backCloth.material.needsUpdate = true;
    }
    placeGarments(piece, color);
  }

  function showPill(piece) {
    const product = Cat.find(piece.spec.sku);
    const priced = Cat.priceOf(product, { color: 'black', size: 'M' });
    pill.hidden = false;
    pill.innerHTML = '<b>' + product.name + '</b> · ' + Cat.money(priced.unit);
    const v = piece.group.position.clone();
    v.y -= 0.28 * piece.group.scale.x;
    v.project(camera);
    pill.style.left = (v.x * 0.5 + 0.5) * stage.clientWidth + 'px';
    pill.style.top = (-v.y * 0.5 + 0.5) * stage.clientHeight + 'px';
  }

  function hidePill() { pill.hidden = true; }

  function recolor(color) {
    colorState.color = color;
    pieces.forEach(applyTurn);
    if (active) drawSheet();
  }

  function drawSheet() {
    const product = Cat.find(active.spec.sku);
    const priced = Cat.priceOf(product, colorState);
    const emblem = window.ENESMA_CATALOG.backEmblemPrice == null
      ? 'Back Emblem (Pending Price)'
      : 'Back Emblem (+' + Cat.money(window.ENESMA_CATALOG.backEmblemPrice) + ')';
    sheet.hidden = false;
    headline.hidden = true;
    stage.parentElement.classList.add('detail');
    sheet.innerHTML = '<p class="detail">Gear</p><h2>' + product.name + '</h2><p class="detail">' + product.detail + '</p>' +
      '<p class="price">' + Cat.money(priced.unit) + '</p><p class="blurb">' + product.blurb + '</p>' +
      '<p class="hint">Drag to turn it.</p>' +
      '<div class="opt"><div class="lbl">Color</div><div class="pills">' +
      '<button type="button" data-color="black" aria-pressed="' + (colorState.color === 'black') + '">Black</button>' +
      '<button type="button" data-color="white" aria-pressed="' + (colorState.color === 'white') + '">White</button></div></div>' +
      '<div class="opt"><div class="lbl">Size</div><div class="pills">' +
      ['S', 'M', 'L', 'XL', 'XXL'].map(function (s) {
        return '<button type="button" data-size="' + s + '" aria-pressed="' + (colorState.size === s) + '">' + s + '</button>';
      }).join('') + '</div></div>' +
      (product.agentName ? '<label class="check"><input id="cName" type="checkbox"' + (colorState.agentName ? ' checked' : '') + '> Agent Name (+' + Cat.money(window.ENESMA_CATALOG.agentNamePrice) + ')</label><div class="field"><label for="cNameText">Agent Name</label><input id="cNameText" maxlength="24" value="' + (colorState.agentNameText || '') + '"></div>' : '') +
      (product.backEmblem ? '<label class="check"><input id="cEmblem" type="checkbox"' + (colorState.backEmblem ? ' checked' : '') + '> ' + emblem + '</label>' : '') +
      '<p class="note">One-time setup fees may apply (DTF $15 setup, embroidery $50 digitizing), confirmed by Grafek Printing.</p>' +
      '<button class="btn" type="button" id="addCloset">Add To Bag, ' + Cat.money(priced.unit) + '</button>' +
      '<p><button class="text-btn" type="button" id="backCloset">Back</button></p>';
    sheet.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.onclick = function () { recolor(btn.getAttribute('data-color')); };
    });
    sheet.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.onclick = function () { colorState.size = btn.getAttribute('data-size'); drawSheet(); };
    });
    const nameBox = document.getElementById('cName');
    if (nameBox) nameBox.onchange = function () { colorState.agentName = nameBox.checked; drawSheet(); };
    const nameText = document.getElementById('cNameText');
    if (nameText) nameText.oninput = function () { colorState.agentNameText = nameText.value; };
    const emblemBox = document.getElementById('cEmblem');
    if (emblemBox) emblemBox.onchange = function () {
      colorState.backEmblem = emblemBox.checked;
      if (active) applyTurn(active);
    };
    document.getElementById('backCloset').onclick = leave;
    document.getElementById('addCloset').onclick = function () {
      Cart.add(product.id, {
        color: colorState.color,
        size: colorState.size,
        agentName: colorState.agentName,
        agentNameText: colorState.agentNameText,
        backEmblem: colorState.backEmblem
      }, 1);
      UI.openCart();
    };
  }

  function enter(piece) {
    active = piece;
    hover = null;
    mode = 'detail';
    hidePill();
    piece.angle = 0;
    applyTurn(piece);
    layoutDetail(piece);
    drawSheet();
    frame();
  }

  function leave() {
    active = null;
    mode = 'rack';
    sheet.hidden = true;
    headline.hidden = false;
    stage.parentElement.classList.remove('detail');
    hidePill();
    layoutRack(null);
    frame();
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pieces.map(function (p) { return p.cloth; }), false);
    if (!hits.length) return null;
    let best = null;
    let bestD = 1e9;
    hits.forEach(function (hit) {
      const piece = pieces.filter(function (p) { return p.cloth === hit.object; })[0];
      const d = Math.abs(hit.point.x - piece.group.position.x);
      if (d < bestD) { bestD = d; best = piece; }
    });
    return best;
  }

  let down = null;
  renderer.domElement.addEventListener('pointerdown', function (ev) {
    down = { x: ev.clientX, y: ev.clientY, moved: false, piece: pick(ev) };
    renderer.domElement.setPointerCapture(ev.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', function (ev) {
    if (down && mode === 'detail' && active) {
      const dx = ev.clientX - down.x;
      if (Math.abs(dx) > 4) down.moved = true;
      active.angle = dx * 0.7;
      applyTurn(active);
      return;
    }
    if (mode !== 'rack') return;
    const piece = pick(ev);
    hover = piece;
    layoutRack(piece);
    if (piece) showPill(piece);
    else hidePill();
  });
  renderer.domElement.addEventListener('pointerup', function (ev) {
    if (!down) return;
    const piece = down.piece;
    const dragged = down.moved;
    down = null;
    if (dragged && mode === 'detail') return;
    if (mode === 'rack' && piece) enter(piece);
    else if (mode === 'detail' && piece && piece !== active) enter(piece);
    else if (mode === 'detail' && !piece) leave();
  });

  window.addEventListener('resize', frame);

  function start() {
    layoutRack(null);
    frame();
    (function loop() {
      applyVisuals();
      if (hover && mode === 'rack') showPill(hover);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })();
  }
}

function metalTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0.00, '#4a4e54');
  grd.addColorStop(0.16, '#f4f5f6');
  grd.addColorStop(0.30, '#7c8288');
  grd.addColorStop(0.48, '#1c1e22');
  grd.addColorStop(0.70, '#121316');
  grd.addColorStop(0.86, '#3a3e44');
  grd.addColorStop(1.00, '#4a4e54');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

if (document.getElementById('stage')) boot();
