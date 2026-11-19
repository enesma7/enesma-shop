import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { dress, makeWeaveNormal, makeEmblemNormal } from './dress.js';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

function fallback() {
  const sheet = document.getElementById('sheet');
  const stage = document.getElementById('stage');
  if (stage) stage.hidden = true;
  sheet.innerHTML = '<h2>Gear</h2><p class="hint">3D is unavailable in this browser. The photos below are renders of the same models.</p><div class="grid">' +
    Cat.byCategory('gear').map(function (p) {
      const base = Cat.renderBase(p.id, 'black', 'hero');
      return '<a class="card" href="gear/' + p.id + '/"><div class="ph"><picture><source srcset="' + base + '.webp" type="image/webp"><img src="' + base + '.jpg" alt="' + p.name + '"></picture></div><h2>' + p.name + '</h2><p>' + Cat.money(p.price) + '</p></a>';
    }).join('') + '</div>';
}

if (!hasWebGL()) {
  fallback();
} else {
  boot().catch(function () { fallback(); });
}

function loadImage(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function texOf(img, srgb) {
  const t = new THREE.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

async function boot() {
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14120f');
  scene.fog = new THREE.Fog('#14120f', 6.5, 12);
  const camera = new THREE.PerspectiveCamera(38, stage.clientWidth / Math.max(1, stage.clientHeight), 0.08, 30);
  camera.position.set(0.15, 1.42, 3.15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enabled = false;
  controls.target.set(0, 1.15, -0.6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight('#ffe6cc', 0.35));
  const key = new THREE.SpotLight('#ffd7ae', 8, 12, Math.PI / 5, 0.45, 1);
  key.position.set(-1.2, 2.6, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.PointLight('#ffc99a', 2.2, 8);
  fill.position.set(1.6, 1.8, 0.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#fff1df', 0.7);
  rim.position.set(0, 2.2, -3);
  scene.add(rim);

  buildRoom(scene);

  const wordWhite = await loadImage(window.SHOP_BASE + 'assets/logo/wordmark-white.png');
  const wordBlack = await loadImage(window.SHOP_BASE + 'assets/logo/wordmark-black.png');
  const emblem = await loadImage(window.SHOP_BASE + 'assets/logo/emblem-mask.png');
  const tex = {
    wordWhite: texOf(wordWhite, true),
    wordBlack: texOf(wordBlack, true),
    emblemMask: texOf(emblem, false),
    emblemNormal: makeEmblemNormal(THREE, emblem),
    weave: makeWeaveNormal(THREE)
  };

  const loader = new GLTFLoader();
  const catalog = [
    { sku: 't-shirt', model: 't-shirt', color: 'black' },
    { sku: 't-shirt', model: 't-shirt', color: 'white' },
    { sku: 'polo', model: 'polo', color: 'black' },
    { sku: 'polo', model: 'polo', color: 'white' },
    { sku: 'quarter-zip', model: 'quarter-zip', color: 'black' },
    { sku: 'quarter-zip', model: 'quarter-zip', color: 'white' },
    { sku: 'cap', model: 'cap', color: 'black' },
    { sku: 'cap', model: 'cap', color: 'white' }
  ];
  const glbCache = {};
  function loadModel(name) {
    if (glbCache[name]) return Promise.resolve(glbCache[name]);
    return new Promise(function (resolve, reject) {
      loader.load(window.SHOP_BASE + 'models/' + name + '.glb', function (gltf) {
        glbCache[name] = gltf.scene;
        resolve(gltf.scene);
      }, undefined, reject);
    });
  }

  const pieces = [];
  const railY = 1.62;
  for (let i = 0; i < catalog.length; i++) {
    const spec = catalog[i];
    const src = await loadModel(spec.model);
    const root = src.clone(true);
    dress(root, THREE, tex, { color: spec.color, name: '' });
    const pivot = new THREE.Group();
    pivot.add(root);
    if (spec.model === 'cap') {
      const shelfIndex = spec.color === 'black' ? 0 : 1;
      pivot.position.set(-1.55, 0.92 + shelfIndex * 0.28, -0.85);
      pivot.scale.setScalar(1.35);
    } else {
      const slot = pieces.filter(function (p) { return p.spec.model !== 'cap'; }).length;
      pivot.position.set(-1.35 + slot * 0.52, railY - 0.68, -1.05);
      addHanger(scene, pivot.position.x, railY, -1.05);
    }
    pivot.userData.piece = spec;
    pivot.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.userData.pieceRoot = pivot; } });
    scene.add(pivot);
    pieces.push({ pivot: pivot, spec: spec, home: pivot.position.clone() });
  }

  const homeCam = camera.position.clone();
  const homeTarget = controls.target.clone();
  let active = null;
  const params = new URLSearchParams(location.search);
  const state = { color: params.get('color') === 'white' ? 'white' : 'black', size: 'M', agentName: false, agentNameText: '', backEmblem: false, qty: 1 };

  function pieceFor(sku, color) {
    return pieces.filter(function (p) { return p.spec.sku === sku && p.spec.color === color; })[0];
  }

  function enter(piece, yaw) {
    if (active && active !== piece) {
      active.pivot.position.copy(active.home);
      active.pivot.rotation.y = 0;
    }
    active = piece;
    state.color = piece.spec.color;
    controls.enabled = true;
    controls.target.copy(piece.pivot.position);
    if (piece.spec.model === 'cap') controls.target.y += 0.08;
    else controls.target.y += 0.35;
    camera.position.set(controls.target.x + 0.15, controls.target.y + 0.05, controls.target.z + 1.15);
    if (yaw) piece.pivot.rotation.y = yaw;
    drawSheet();
  }

  function leave() {
    if (active) {
      active.pivot.position.copy(active.home);
      active.pivot.rotation.y = 0;
    }
    active = null;
    controls.enabled = false;
    camera.position.copy(homeCam);
    controls.target.copy(homeTarget);
    sheet.innerHTML = '<h2>Gear</h2><p class="hint">Hover or tap a piece, then drag to turn it.</p>';
  }

  function drawSheet() {
    if (!active) return;
    const product = Cat.find(active.spec.sku);
    const priced = Cat.priceOf(product, state);
    const emblem = window.ENESMA_CATALOG.backEmblemPrice == null
      ? 'Back Emblem (Pending Price)'
      : 'Back Emblem (+' + Cat.money(window.ENESMA_CATALOG.backEmblemPrice) + ')';
    sheet.innerHTML = '<h2>' + product.name + '</h2><p class="detail">' + product.detail + '</p>' +
      '<p class="price">' + Cat.money(priced.unit) + '</p><p class="hint">Drag to rotate. The logo is on the front and the emblem is at the top of the back.</p>' +
      '<div class="opt"><div class="lbl">Color</div><div class="pills"><button type="button" data-color="black" aria-pressed="' + (state.color === 'black') + '">Black</button><button type="button" data-color="white" aria-pressed="' + (state.color === 'white') + '">White</button></div></div>' +
      '<div class="opt"><div class="lbl">Size</div><div class="pills">' + ['S', 'M', 'L', 'XL', 'XXL'].map(function (s) {
        return '<button type="button" data-size="' + s + '" aria-pressed="' + (state.size === s) + '">' + s + '</button>';
      }).join('') + '</div></div>' +
      (product.agentName ? '<label class="check"><input id="cName" type="checkbox"' + (state.agentName ? ' checked' : '') + '> Agent Name (+' + Cat.money(window.ENESMA_CATALOG.agentNamePrice) + ')</label><div class="field"><label for="cNameText">Agent Name</label><input id="cNameText" maxlength="24" value="' + (state.agentNameText || '') + '"></div>' : '') +
      (product.backEmblem ? '<label class="check"><input id="cEmblem" type="checkbox"' + (state.backEmblem ? ' checked' : '') + '> ' + emblem + '</label>' : '') +
      '<p class="note">One-time setup fees may apply (DTF $15 setup, embroidery $50 digitizing), confirmed by Grafek Printing.</p>' +
      '<div class="icon-row"><button class="btn secondary" type="button" id="rotL">Rotate Left</button><button class="btn secondary" type="button" id="rotR">Rotate Right</button></div>' +
      '<button class="btn" type="button" id="addCloset">Add To Cart</button>' +
      '<p><button class="text-btn" type="button" id="backCloset">Back To Closet</button> · <a href="gear/' + product.id + '/">View Details</a></p>';
    sheet.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.onclick = function () {
        const next = pieceFor(active.spec.sku, btn.getAttribute('data-color'));
        if (next) enter(next, active.pivot.rotation.y);
      };
    });
    sheet.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.onclick = function () { state.size = btn.getAttribute('data-size'); drawSheet(); };
    });
    const nameBox = document.getElementById('cName');
    if (nameBox) nameBox.onchange = function () {
      state.agentName = nameBox.checked;
      applyName();
      drawSheet();
    };
    const nameText = document.getElementById('cNameText');
    if (nameText) nameText.oninput = function () { state.agentNameText = nameText.value; applyName(); };
    const emblemBox = document.getElementById('cEmblem');
    if (emblemBox) emblemBox.onchange = function () { state.backEmblem = emblemBox.checked; };
    document.getElementById('rotL').onclick = function () { active.pivot.rotation.y -= 0.45; };
    document.getElementById('rotR').onclick = function () { active.pivot.rotation.y += 0.45; };
    document.getElementById('backCloset').onclick = leave;
    document.getElementById('addCloset').onclick = function () {
      Cart.add(product.id, {
        color: state.color,
        size: state.size,
        agentName: state.agentName,
        agentNameText: state.agentNameText,
        backEmblem: state.backEmblem
      }, 1);
      UI.openCart();
    };
  }

  function applyName() {
    if (!active) return;
    const show = state.agentName && state.agentNameText.trim();
    active.pivot.traverse(function (node) {
      if (node.name === 'decal-name') node.visible = !!show;
      if (node.name === 'decal-name' && show && node.material && node.material.map) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 1024, 200);
        ctx.fillStyle = state.color === 'black' ? '#f7f7f5' : '#141418';
        ctx.font = '600 86px Inter, Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.agentNameText.toUpperCase(), 512, 104);
        node.material.map.image = canvas;
        node.material.map.needsUpdate = true;
      }
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverTimer = 0;
  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      let node = hits[i].object;
      while (node && !node.userData.piece) node = node.parent;
      if (node && node.userData.piece) return pieces.filter(function (p) { return p.pivot === node; })[0];
    }
    return null;
  }
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) {
    renderer.domElement.addEventListener('pointermove', function (ev) {
      if (active) return;
      const piece = pick(ev);
      clearTimeout(hoverTimer);
      if (!piece) return;
      hoverTimer = setTimeout(function () { enter(piece, 0.2); }, 180);
    });
  }
  renderer.domElement.addEventListener('pointerup', function (ev) {
    if (ev.pointerType === 'mouse' && active) return;
    const piece = pick(ev);
    if (piece) enter(piece, 0.35);
  });

  const requested = params.get('item');
  if (requested) {
    const start = pieceFor(requested, state.color) || pieces.filter(function (p) { return p.spec.sku === requested; })[0];
    if (start) enter(start, Number(params.get('yaw') || 0.8));
  }

  window.addEventListener('resize', function () {
    camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  });

  (function loop() {
    controls.update();
    if (!active) camera.position.x = homeCam.x + Math.sin(performance.now() / 4000) * 0.08;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
}

function buildRoom(scene) {
  const wood = woodTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0.05, color: '#3a2416' });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat);
  back.position.set(0, 1.8, -2.2);
  scene.add(back);
  const shelfMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0.04, color: '#6b4528' });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.38), shelfMat);
  shelf.position.set(-1.55, 0.86, -0.85);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  const shelf2 = shelf.clone();
  shelf2.position.y = 1.14;
  scene.add(shelf, shelf2);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.3, 16), new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.7, roughness: 0.35 }));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 1.62, -1.05);
  scene.add(rail);
}

function addHanger(scene, x, y, z) {
  const mat = new THREE.MeshStandardMaterial({ color: '#c2b8a2', metalness: 0.65, roughness: 0.35 });
  const pts = [
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(0.02, 0.16, 0),
    new THREE.Vector3(0.0, 0.2, 0),
    new THREE.Vector3(-0.03, 0.16, 0),
    new THREE.Vector3(0, 0.12, 0),
    new THREE.Vector3(-0.16, 0.02, 0),
    new THREE.Vector3(0.16, 0.02, 0),
    new THREE.Vector3(0, 0.12, 0)
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0045, 6, false), mat);
  mesh.position.set(x, y - 0.16, z);
  scene.add(mesh);
}

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#5a3822';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = 'rgba(40,22,10,' + (0.15 + (i % 5) * 0.06) + ')';
    g.lineWidth = 1 + (i % 3);
    g.beginPath();
    const y = (i * 17) % 512;
    g.moveTo(0, y);
    g.bezierCurveTo(140, y + 18, 300, y - 14, 512, y + 6);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
