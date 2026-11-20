import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

const SPECS = [
  { sku: 't-shirt', hang: 't-shirt', tall: 0.98, shelf: false },
  { sku: 'polo', hang: 'polo', tall: 1.05, shelf: false },
  { sku: 'quarter-zip', hang: 'quarter-zip', tall: 1.0, shelf: false },
  { sku: 'cap', hang: 'cap', tall: 0.32, shelf: true }
];

const RAIL_Y = 0.48;
const SPACING = 0.92;

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
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f3ee');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;

  const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 40);
  const rackCenter = SPACING * 1.5;

  scene.add(new THREE.AmbientLight('#fff6ee', 0.42));
  const key = new THREE.DirectionalLight('#fff1e2', 2.15);
  key.position.set(-1.6, 3.4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 2;
  key.shadow.camera.bottom = -2;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e7eef6', 0.45);
  fill.position.set(2.2, 1.4, 1.8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#f3e6cf', 0.35);
  rim.position.set(0.2, 1.6, -2.4);
  scene.add(rim);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 1 })
  );
  wall.position.set(rackCenter, 0.1, -0.55);
  wall.receiveShadow = true;
  scene.add(wall);

  const railMat = new THREE.MeshStandardMaterial({ color: '#101014', metalness: 0.72, roughness: 0.28 });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, SPACING * 3 + 1.4, 40), railMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(rackCenter, RAIL_Y, 0);
  rail.castShadow = true;
  scene.add(rail);

  const velvet = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.78, metalness: 0.04 });
  const gold = new THREE.MeshPhysicalMaterial({
    color: '#d5be87',
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.25
  });
  const shelfMat = new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.42, metalness: 0.35 });

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }
  function makeTex(img) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  function garmentMesh(frontImg, backImg, targetH, sideColor) {
    const max = 110;
    const sc = max / Math.max(frontImg.width, frontImg.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(8, Math.round(frontImg.width * sc));
    canvas.height = Math.max(8, Math.round(frontImg.height * sc));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(frontImg, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const src = imageData.data;
    const iw0 = canvas.width;
    const ih0 = canvas.height;
    for (let pass = 0; pass < 3; pass++) {
      const mark = [];
      for (let y = 1; y < ih0 - 1; y++) {
        for (let x = 1; x < iw0 - 1; x++) {
          const o = (y * iw0 + x) * 4;
          if (src[o + 3] < 24) continue;
          if (src[o] < 175 || src[o + 1] < 175 || src[o + 2] < 175) continue;
          const near = [o - 4, o + 4, o - iw0 * 4, o + iw0 * 4].some(function (n) { return src[n + 3] < 24; });
          if (near) mark.push(o);
        }
      }
      mark.forEach(function (o) { src[o + 3] = 0; });
    }
    ctx.putImageData(imageData, 0, 0);
    const data = src;
    const iw = canvas.width;
    const ih = canvas.height;
    const step = 2;
    const samples = [];
    let minY = ih;
    let maxY = 0;
    for (let y = 0; y < ih; y += step) {
      let left = -1;
      let right = -1;
      for (let x = 0; x < iw; x++) {
        if (data[(y * iw + x) * 4 + 3] > 36) {
          if (left < 0) left = x;
          right = x;
        }
      }
      if (left >= 0 && right - left > 2) {
        samples.push({ y: y, l: left, r: right });
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const opaque = Math.max(1, maxY - minY);
    const worldH = targetH * (ih / opaque);
    const worldW = worldH * (frontImg.width / frontImg.height);
    const thick = Math.max(0.02, targetH * 0.034);
    const bulge = targetH * 0.028;
    const cols = 20;
    const frontPos = [];
    const frontUv = [];
    const frontIdx = [];
    const backPos = [];
    const backUv = [];
    const backIdx = [];
    const sidePos = [];
    const sideIdx = [];
    const rows = samples.map(function (s) {
      const front = [];
      const back = [];
      for (let i = 0; i <= cols; i++) {
        const t = i / cols;
        const px = s.l + (s.r - s.l) * t;
        const u = px / iw;
        const v = 1 - (s.y + 0.5) / ih;
        const x = (u - 0.5) * worldW;
        const yy = (0.5 - (s.y + 0.5) / ih) * worldH;
        const lift = bulge * Math.sin(Math.PI * t) * Math.sin(Math.PI * (s.y - minY) / opaque);
        front.push(frontPos.length / 3);
        frontPos.push(x, yy, thick * 0.5 + lift);
        frontUv.push(u, v);
        back.push(backPos.length / 3);
        backPos.push(x, yy, -thick * 0.5 - lift * 0.4);
        backUv.push(u, v);
      }
      return { front: front, back: back };
    });
    function sideQuad(a, b, c, d) {
      const base = sidePos.length / 3;
      [a, b, c, d].forEach(function (p) { sidePos.push(p.x, p.y, p.z); });
      sideIdx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
    for (let r = 0; r < rows.length - 1; r++) {
      const a = rows[r];
      const b = rows[r + 1];
      for (let i = 0; i < cols; i++) {
        frontIdx.push(a.front[i], b.front[i], a.front[i + 1], a.front[i + 1], b.front[i], b.front[i + 1]);
        backIdx.push(a.back[i], a.back[i + 1], b.back[i], a.back[i + 1], b.back[i + 1], b.back[i]);
      }
      const edge = function (index) {
        return {
          x: frontPos[a.front[index] * 3],
          y: frontPos[a.front[index] * 3 + 1],
          zf: frontPos[a.front[index] * 3 + 2],
          zb: backPos[a.back[index] * 3 + 2],
          y2: frontPos[b.front[index] * 3 + 1],
          x2: frontPos[b.front[index] * 3],
          zf2: frontPos[b.front[index] * 3 + 2],
          zb2: backPos[b.back[index] * 3 + 2]
        };
      };
      [0, cols].forEach(function (index) {
        const e = edge(index);
        if (Math.abs(e.x - e.x2) > Math.abs(e.y - e.y2) * 0.45) return;
        sideQuad(
          { x: e.x, y: e.y, z: e.zf },
          { x: e.x, y: e.y, z: e.zb },
          { x: e.x2, y: e.y2, z: e.zf2 },
          { x: e.x2, y: e.y2, z: e.zb2 }
        );
      });
    }
    function geo(pos, uv, idx) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    const frontMat = new THREE.MeshBasicMaterial({
      map: makeTex(canvas), alphaTest: 0.35, side: THREE.FrontSide
    });
    const backMat = new THREE.MeshBasicMaterial({
      map: makeTex(backImg), alphaTest: 0.55, side: THREE.FrontSide
    });
    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const group = new THREE.Group();
    [new THREE.Mesh(geo(frontPos, frontUv, frontIdx), frontMat), new THREE.Mesh(geo(backPos, backUv, backIdx), backMat), new THREE.Mesh(geo(sidePos, null, sideIdx), sideMat)].forEach(function (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
    group.userData.frontMat = frontMat;
    group.userData.backMat = backMat;
    const box = new THREE.Box3().setFromObject(group);
    group.userData.top = box.max.y;
    group.userData.bottom = box.min.y;
    return group;
  }

  function makeHanger() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.23, -0.012);
    shape.bezierCurveTo(-0.14, 0.1, 0.14, 0.1, 0.23, -0.012);
    shape.lineTo(0.21, -0.034);
    shape.bezierCurveTo(0.1, 0.062, -0.1, 0.062, -0.21, -0.034);
    shape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.018, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 18
    });
    bodyGeo.translate(0, 0, -0.009);
    const bodyMat = velvet.clone();
    const hookMat = gold.clone();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.009, 0.012), bodyMat);
    bar.position.set(0, -0.026, 0);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.075, 0),
      new THREE.Vector3(0, 0.13, 0),
      new THREE.Vector3(0.012, 0.175, 0),
      new THREE.Vector3(0.046, 0.198, 0),
      new THREE.Vector3(0.07, 0.168, 0),
      new THREE.Vector3(0.05, 0.132, 0)
    ]);
    const hook = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.011, 16, false), hookMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 16), hookMat);
    neck.position.y = 0.06;
    g.add(body, bar, hook, neck);
    g.traverse(function (obj) { if (obj.isMesh) obj.castShadow = true; });
    g.scale.setScalar(1.35);
    g.position.y = -0.25;
    return g;
  }

  const pieces = [];
  const capX = 3 * SPACING;

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.016, 0.34), shelfMat);
  shelf.position.set(capX, RAIL_Y + 0.34, 0.04);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  scene.add(shelf);

  Promise.all(SPECS.map(async function (spec, index) {
    const colors = {};
    for (const color of ['black', 'white']) {
      const base = window.SHOP_BASE + 'assets/gear/' + spec.hang + '-' + color;
      colors[color] = {
        front: await loadImage(base + '-front.png'),
        back: await loadImage(base + '-back.png')
      };
    }
    const side = { black: '#101014', white: '#e6e3de' };
    const shells = {
      black: garmentMesh(colors.black.front, colors.black.back, spec.tall, side.black),
      white: garmentMesh(colors.white.front, colors.white.back, spec.tall, side.white)
    };
    shells.white.visible = false;
    const rotator = new THREE.Group();
    rotator.add(shells.black, shells.white);
    if (!spec.shelf) rotator.add(makeHanger());
    const holder = new THREE.Group();
    if (spec.shelf) {
      const drop = -shells.black.userData.bottom + 0.012;
      shells.black.position.y = drop;
      shells.white.position.y = drop;
      holder.position.set(capX, shelf.position.y + 0.008, 0.04);
    } else {
      const neck = -0.1;
      shells.black.position.y = neck - shells.black.userData.top;
      shells.white.position.y = neck - shells.white.userData.top;
      holder.position.set(index * SPACING, RAIL_Y, 0);
    }
    holder.add(rotator);
    scene.add(holder);
    pieces[index] = {
      spec: spec,
      holder: holder,
      rotator: rotator,
      shells: shells,
      homeX: holder.position.x,
      homeY: holder.position.y,
      x: holder.position.x,
      y: holder.position.y,
      scale: 1,
      opacity: 1,
      angle: 0,
      spin: 0
    };
  })).then(start).catch(function () {
    sheet.hidden = false;
    sheet.innerHTML = '<h2>Gear</h2><p class="hint">The closet photos could not be loaded.</p>';
  });

  let hover = null;
  let active = null;
  let mode = 'rack';
  const colorState = { color: 'black', size: 'M', agentName: false, agentNameText: '' };

  function showColor(color) {
    colorState.color = color;
    pieces.forEach(function (piece) {
      piece.shells.black.visible = color === 'black';
      piece.shells.white.visible = color === 'white';
    });
  }

  function applyVisuals() {
    pieces.forEach(function (piece) {
      piece.spin *= 0.93;
      if (Math.abs(piece.spin) < 0.0004) piece.spin = 0;
      piece.angle += piece.spin;
      piece.rotator.rotation.y += (piece.angle - piece.rotator.rotation.y) * 0.35;
      piece.holder.position.x += (piece.x - piece.holder.position.x) * 0.16;
      piece.holder.position.y += (piece.y - piece.holder.position.y) * 0.16;
      const s = piece.holder.scale.x + (piece.scale - piece.holder.scale.x) * 0.16;
      piece.holder.scale.setScalar(s);
      piece.holder.traverse(function (obj) {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function (mat) {
          if (mat.opacity === undefined) return;
          mat.transparent = piece.opacity < 0.98;
          mat.opacity += (piece.opacity - mat.opacity) * 0.2;
        });
      });
    });
  }

  function layoutRack(focus) {
    pieces.forEach(function (piece) {
      piece.x = piece.homeX + (focus && focus !== piece ? (piece.homeX < focus.homeX ? -0.12 : 0.12) : 0);
      piece.y = piece.homeY;
      piece.scale = focus === piece ? 1.08 : 1;
      piece.opacity = 1;
    });
  }

  function layoutDetail(focus) {
    pieces.forEach(function (piece) {
      if (piece === focus) {
        piece.x = rackCenter - 0.35;
        piece.y = piece.homeY;
        piece.scale = 1.22;
        piece.opacity = 1;
      } else {
        piece.x = piece.homeX < focus.homeX ? -1.4 : rackCenter + 2.2;
        piece.scale = 0.9;
        piece.opacity = 0.12;
      }
    });
  }

  function frame() {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.aspect = aspect;
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    const span = mode === 'detail' && aspect < 1 ? 1.8 : SPACING * 3 + 1.5;
    const z = Math.max(3.4, (span / Math.max(0.5, aspect)) / (2 * half));
    camera.position.set(rackCenter, 0.22, z);
    camera.lookAt(rackCenter, 0.12, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  function showPill(piece) {
    const product = Cat.find(piece.spec.sku);
    const priced = Cat.priceOf(product, { color: 'black', size: 'M' });
    pill.hidden = false;
    pill.innerHTML = '<b>' + product.name + '</b> · ' + Cat.money(priced.unit);
    const v = piece.holder.position.clone();
    v.y += piece.spec.shelf ? 0.22 : 0.08;
    v.project(camera);
    pill.style.left = (v.x * 0.5 + 0.5) * stage.clientWidth + 'px';
    pill.style.top = (-v.y * 0.5 + 0.5) * stage.clientHeight + 'px';
  }
  function hidePill() { pill.hidden = true; }

  function drawSheet() {
    const product = Cat.find(active.spec.sku);
    const priced = Cat.priceOf(product, colorState);
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
      '<p class="note">One-time setup fees may apply (DTF $15 setup, embroidery $50 digitizing), confirmed by Grafek Printing.</p>' +
      '<button class="btn" type="button" id="addCloset">Add To Bag, ' + Cat.money(priced.unit) + '</button>' +
      '<p><button class="text-btn" type="button" id="backCloset">Back</button></p>';
    sheet.querySelectorAll('[data-color]').forEach(function (btn) {
      btn.onclick = function () { showColor(btn.getAttribute('data-color')); drawSheet(); };
    });
    sheet.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.onclick = function () { colorState.size = btn.getAttribute('data-size'); drawSheet(); };
    });
    const nameBox = document.getElementById('cName');
    if (nameBox) nameBox.onchange = function () { colorState.agentName = nameBox.checked; drawSheet(); };
    const nameText = document.getElementById('cNameText');
    if (nameText) nameText.oninput = function () { colorState.agentNameText = nameText.value; };
    document.getElementById('backCloset').onclick = leave;
    document.getElementById('addCloset').onclick = function () {
      Cart.add(product.id, {
        color: colorState.color,
        size: colorState.size,
        agentName: colorState.agentName,
        agentNameText: colorState.agentNameText
      }, 1);
      UI.openCart();
    };
  }

  function enter(piece) {
    active = piece;
    hover = null;
    mode = 'detail';
    hidePill();
    piece.spin = 0;
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
    const meshes = [];
    pieces.forEach(function (piece) {
      const shell = piece.shells[colorState.color];
      shell.traverse(function (obj) { if (obj.isMesh) meshes.push(obj); });
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    let node = hits[0].object;
    while (node && !node.userData.piece) node = node.parent;
    return node ? node.userData.piece : null;
  }

  let down = null;
  renderer.domElement.addEventListener('pointerdown', function (ev) {
    down = { x: ev.clientX, y: ev.clientY, lastX: ev.clientX, moved: false, rotate: false, piece: pick(ev) };
  });
  renderer.domElement.addEventListener('pointermove', function (ev) {
    if (down && down.piece) {
      const dx = ev.clientX - down.lastX;
      const adx = Math.abs(ev.clientX - down.x);
      const ady = Math.abs(ev.clientY - down.y);
      if (!down.rotate && adx < 8 && ady < 8) return;
      if (!down.rotate && ady > adx) return;
      down.rotate = true;
      down.moved = true;
      down.lastX = ev.clientX;
      down.piece.angle += dx * 0.012;
      down.piece.spin = dx * 0.012;
      try { renderer.domElement.setPointerCapture(ev.pointerId); } catch (e) {}
      return;
    }
    if (mode !== 'rack') return;
    const piece = pick(ev);
    hover = piece;
    layoutRack(piece);
    if (piece) showPill(piece);
    else hidePill();
  });
  renderer.domElement.addEventListener('pointerup', function () {
    if (!down) return;
    const piece = down.piece;
    const dragged = down.moved;
    down = null;
    if (dragged) return;
    if (mode === 'rack' && piece) enter(piece);
    else if (mode === 'detail' && piece && piece !== active) enter(piece);
    else if (mode === 'detail' && !piece) leave();
  });
  window.addEventListener('resize', frame);

  function start() {
    pieces.forEach(function (piece) {
      piece.shells.black.userData.piece = piece;
      piece.shells.white.userData.piece = piece;
      piece.rotator.userData.piece = piece;
    });
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

if (document.getElementById('stage')) boot();
