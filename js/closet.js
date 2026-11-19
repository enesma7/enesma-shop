import * as THREE from 'three';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

const SPECS = [
  { sku: 't-shirt', hang: 't-shirt', w: 0.96, h: 1.05, emblem: true },
  { sku: 'polo', hang: 'polo', w: 0.84, h: 1.05, emblem: true },
  { sku: 'quarter-zip', hang: 'quarter-zip', w: 1.02, h: 1.02, emblem: true },
  { sku: 'cap', hang: 'cap', w: 0.62, h: 0.46, emblem: false }
];

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
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f2ee');
  const camera = new THREE.PerspectiveCamera(26, stage.clientWidth / Math.max(1, stage.clientHeight), 0.05, 20);
  camera.position.set(0.35, 0.42, 4.15);
  camera.lookAt(0.35, 0.22, 0);

  scene.add(new THREE.AmbientLight('#fffaf6', 0.85));
  const key = new THREE.DirectionalLight('#fff8f2', 1.15);
  key.position.set(-1.2, 2.4, 2.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e7edf5', 0.45);
  fill.position.set(2, 1.2, 1.4);
  scene.add(fill);

  const railMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.72, roughness: 0.32 });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 3.4, 16), railMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0.45, 0.98, 0);
  scene.add(rail);

  const hangerMat = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.72, metalness: 0.15 });

  function hanger() {
    const g = new THREE.Group();
    const hook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.01, 0.07, 0),
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(-0.045, 0.07, 0),
      new THREE.Vector3(-0.02, 0.02, 0)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(hook, 24, 0.0045, 8, false), hangerMat));
    const bar = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, -0.02, 0),
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(0.2, -0.02, 0)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 20, 0.005, 8, false), hangerMat));
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.4, 8), hangerMat);
    bottom.rotation.z = Math.PI / 2;
    bottom.position.y = -0.02;
    g.add(bottom);
    return g;
  }

  function curved(map, w, h) {
    const geo = new THREE.PlaneGeometry(w, h, 10, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, -0.035 * (1 - Math.pow((x / (w / 2)), 2)));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: map,
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.FrontSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

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

  const pieces = [];
  const spacing = 0.78;
  const origin = -0.35;

  Promise.all(SPECS.map(async function (spec, index) {
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
    const y = spec.sku === 'cap' ? -0.28 : -spec.h * 0.48 - 0.08;
    const cloth = curved(maps.black.front, spec.w, spec.h);
    cloth.position.y = y;
    const backCloth = curved(maps.black.back, spec.w, spec.h);
    backCloth.position.y = y;
    backCloth.material.opacity = 0;
    backCloth.material.transparent = true;
    backCloth.material.depthWrite = false;
    group.add(cloth, backCloth);
    if (spec.sku !== 'cap') {
      const hook = hanger();
      group.add(hook);
    } else {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 8, 16, Math.PI), hangerMat);
      hook.rotation.z = Math.PI;
      hook.position.y = 0.02;
      group.add(hook);
    }
    const x = origin + index * spacing;
    group.position.set(x, 0.98, 0);
    scene.add(group);
    const piece = {
      spec: spec,
      group: group,
      cloth: cloth,
      backCloth: backCloth,
      maps: maps,
      homeX: x,
      homeScale: 1,
      x: x,
      scale: 1,
      opacity: 1,
      angle: 0,
      frontMix: 1,
      backMix: 0
    };
    pieces[index] = piece;
  })).then(start).catch(function () {
    sheet.hidden = false;
    sheet.innerHTML = '<h2>Gear</h2><p class="hint">The closet photos could not be loaded.</p>';
  });

  let hover = null;
  let active = null;
  let mode = 'rack';
  const colorState = { color: 'black', size: 'M', agentName: false, agentNameText: '', backEmblem: false };

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
    });
  }

  function layoutRack(focus) {
    pieces.forEach(function (piece) {
      let x = piece.homeX;
      if (focus && focus !== piece) {
        x += piece.homeX < focus.homeX ? -0.18 : 0.18;
      }
      piece.x = x;
      piece.scale = focus === piece ? 1.34 : 1;
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
        piece.x = -0.55;
        piece.scale = 1.55;
        piece.opacity = 1;
      } else {
        piece.x = piece.homeX < focus.homeX ? -1.7 : 1.7;
        piece.scale = 0.92;
        piece.opacity = 0.18;
        piece.frontMix = 1;
        piece.backMix = 0;
      }
    });
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
  }

  function showPill(piece) {
    const product = Cat.find(piece.spec.sku);
    const priced = Cat.priceOf(product, { color: 'black', size: 'M' });
    pill.hidden = false;
    pill.innerHTML = '<b>' + product.name + '</b> · ' + Cat.money(priced.unit);
    const v = piece.group.position.clone();
    v.y += 0.22;
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
  }

  function leave() {
    active = null;
    mode = 'rack';
    sheet.hidden = true;
    headline.hidden = false;
    stage.parentElement.classList.remove('detail');
    hidePill();
    layoutRack(null);
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
    return pieces.filter(function (p) { return p.cloth === hits[0].object; })[0];
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

  window.addEventListener('resize', function () {
    camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  });

  function start() {
    layoutRack(null);
    (function loop() {
      applyVisuals();
      if (hover && mode === 'rack') showPill(hover);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })();
  }
}

if (document.getElementById('stage')) boot();
