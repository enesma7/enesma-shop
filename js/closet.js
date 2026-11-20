import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

const SPECS = [
  { sku: 't-shirt', hang: 't-shirt', tall: 0.98, shelf: false, bulge: 0.05, thick: 0.006 },
  { sku: 'polo', hang: 'polo', tall: 1.02, shelf: false, bulge: 0.046, thick: 0.006 },
  { sku: 'quarter-zip', hang: 'quarter-zip', tall: 1.0, shelf: false, bulge: 0.046, thick: 0.006 },
  { sku: 'cap', hang: 'cap', tall: 0.16, shelf: true, bulge: 0, thick: 0, angle: 0.62 }
];

const RAIL_Y = 0.36;
const SPACING = 1.05;
const WALL_Z = -0.46;

function boot() {
  const stage = document.getElementById('stage');
  const sheet = document.getElementById('sheet');
  const pill = document.getElementById('pill');
  const headline = document.getElementById('closetHeadline');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = false;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dbd8d4');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;

  const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 40);
  const rackCenter = SPACING;

  scene.add(new THREE.AmbientLight('#fff3e6', 0.78));
  const key = new THREE.DirectionalLight('#fff4e4', 1.05);
  key.position.set(-1.8, 3.6, 3.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#f6efe4', 0.38);
  fill.position.set(2.4, 1.6, 2.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#f4e2c4', 0.22);
  rim.position.set(0.4, 2.4, -2.2);
  scene.add(rim);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 9),
    new THREE.MeshBasicMaterial({ color: '#dbd8d4', toneMapped: false })
  );
  wall.position.set(rackCenter, 0.15, WALL_Z);
  scene.add(wall);

  const railMat = new THREE.MeshStandardMaterial({ color: '#101014', metalness: 0.78, roughness: 0.24 });
  const railLen = SPACING * 2 + 1.25;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, railLen, 40), railMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(rackCenter, RAIL_Y, 0.02);
  scene.add(rail);
  const railHardware = [];
  [-1, 1].forEach(function (side) {
    const x = rackCenter + side * (railLen / 2 - 0.04);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.02 - WALL_Z), railMat);
    arm.position.set(x, RAIL_Y, (0.02 + WALL_Z) / 2);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.012), railMat);
    plate.position.set(x, RAIL_Y, WALL_Z + 0.006);
    scene.add(arm, plate);
    railHardware.push(arm, plate);
  });

  const velvet = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.78, metalness: 0.04 });
  const gold = new THREE.MeshPhysicalMaterial({
    color: '#d5be87',
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.25
  });
  const shelfMat = new THREE.MeshPhysicalMaterial({
    color: '#0c0c0e', metalness: 0.78, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 1.2
  });

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function makeTex(img) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.premultiplyAlpha = true;
    tex.needsUpdate = true;
    return tex;
  }

  function garmentMesh(frontImg, backImg, spec) {
    const maxMask = 480;
    const sc = maxMask / Math.max(frontImg.width, frontImg.height);
    const iw = Math.max(8, Math.round(frontImg.width * sc));
    const ih = Math.max(8, Math.round(frontImg.height * sc));
    const mask = document.createElement('canvas');
    mask.width = iw;
    mask.height = ih;
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(frontImg, 0, 0, iw, ih);
    const data = mctx.getImageData(0, 0, iw, ih).data;
    const step = 2;
    const samples = [];
    let minY = ih;
    let maxY = 0;
    for (let y = 0; y < ih; y += step) {
      let left = -1;
      let right = -1;
      for (let x = 0; x < iw; x++) {
        if (data[(y * iw + x) * 4 + 3] > 140) {
          if (left < 0) left = x;
          right = x;
        }
      }
      if (left >= 0 && right - left > 3) {
        samples.push({ y: y, l: left, r: right });
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const jump = 6;
        samples[i].l = Math.max(prev.l - jump, Math.min(prev.l + jump, samples[i].l));
        samples[i].r = Math.max(prev.r - jump, Math.min(prev.r + jump, samples[i].r));
      }
      for (let i = samples.length - 2; i >= 0; i--) {
        const next = samples[i + 1];
        const jump = 6;
        samples[i].l = Math.max(next.l - jump, Math.min(next.l + jump, samples[i].l));
        samples[i].r = Math.max(next.r - jump, Math.min(next.r + jump, samples[i].r));
      }
    }
    let centerSum = 0;
    samples.forEach(function (s) { centerSum += (s.l + s.r) / 2; });
    const center = centerSum / Math.max(1, samples.length);
    samples.forEach(function (s) {
      const half = (s.r - s.l) / 2;
      s.ol = s.l;
      s.or = s.r;
      s.l = center - half;
      s.r = center + half;
    });
    const opaque = Math.max(1, maxY - minY);
    const worldH = spec.tall * (ih / opaque);
    const worldW = worldH * (frontImg.width / frontImg.height);
    const thick = spec.thick;
    const bulge = spec.bulge;
    const cols = 36;
    const frontPos = [];
    const frontUv = [];
    const frontIdx = [];
    const backPos = [];
    const backUv = [];
    const backIdx = [];
    const edgePos = [];
    const edgeCol = [];
    const edgeIdx = [];
    function sampleColor(px, py) {
      const x = Math.max(0, Math.min(iw - 1, px | 0));
      const y = Math.max(0, Math.min(ih - 1, py | 0));
      const o = (y * iw + x) * 4;
      if (data[o + 3] < 40) return spec.shelf ? [0.16, 0.16, 0.17] : [0.12, 0.12, 0.13];
      return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255];
    }
    const rows = samples.map(function (s) {
      const front = [];
      const back = [];
      const vNorm = (s.y - minY) / opaque;
      for (let i = 0; i <= cols; i++) {
        const t = i / cols;
        const inset = Math.min(3, (s.r - s.l) * 0.02);
        const ol = s.ol == null ? s.l : s.ol;
        const orr = s.or == null ? s.r : s.or;
        const px = (s.l + inset) + (s.r - s.l - inset * 2) * t;
        const pxUv = (ol + inset) + (orr - ol - inset * 2) * t;
        const u = pxUv / iw;
        const v = 1 - (s.y + 0.5) / ih;
        const x = (px / iw - 0.5) * worldW;
        const yy = (0.5 - (s.y + 0.5) / ih) * worldH;
        const lift = bulge * Math.sin(Math.PI * t) * Math.sin(Math.PI * Math.min(1, Math.max(0, vNorm)));
        const zf = lift + thick * 0.5;
        const zb = lift - thick * 0.5;
        front.push(frontPos.length / 3);
        frontPos.push(x, yy, zf);
        frontUv.push(u, v);
        back.push(backPos.length / 3);
        backPos.push(x, yy, zb);
        backUv.push(u, v);
      }
      return { front: front, back: back, y: s.y, l: s.l, r: s.r };
    });
    function pointAt(row, index) {
      const fi = row.front[index];
      const bi = row.back[index];
      return {
        x: frontPos[fi * 3],
        y: frontPos[fi * 3 + 1],
        zf: frontPos[fi * 3 + 2],
        zb: backPos[bi * 3 + 2]
      };
    }
    function toLinear(c) {
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function clothAt(row) {
      let dark = [0.1, 0.1, 0.1];
      let darkLum = 99;
      let light = [0.9, 0.9, 0.9];
      let lightLum = -1;
      let sum = 0;
      let n = 0;
      for (let t = 0.15; t <= 0.85; t += 0.1) {
        const c = sampleColor(row.l + (row.r - row.l) * t, row.y);
        const lum = c[0] + c[1] + c[2];
        sum += lum;
        n += 1;
        if (lum < darkLum) { darkLum = lum; dark = c; }
        if (lum > lightLum) { lightLum = lum; light = c; }
      }
      return sum / Math.max(1, n) < 1.5 ? dark : light;
    }
    function addLip(a, b, outward, color, force) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.hypot(dx, dy) < 0.0004) return;
      if (!force && Math.hypot(dx, dy) > 0.12) return;
      const segs = 4;
      const rings = [[], []];
      [a, b].forEach(function (p, pi) {
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const ang = Math.PI * t;
          const mid = (p.zf + p.zb) / 2;
          const half = (p.zf - p.zb) / 2;
          rings[pi].push(edgePos.length / 3);
          edgePos.push(p.x, p.y, mid + Math.cos(ang) * half);
          edgeCol.push(toLinear(color[0]), toLinear(color[1]), toLinear(color[2]));
        }
      });
      for (let s = 0; s < segs; s++) {
        const a0 = rings[0][s];
        const a1 = rings[0][s + 1];
        const b0 = rings[1][s];
        const b1 = rings[1][s + 1];
        edgeIdx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    for (let r = 0; r < rows.length - 1; r++) {
      const a = rows[r];
      const b = rows[r + 1];
      for (let i = 0; i < cols; i++) {
        frontIdx.push(a.front[i], b.front[i], a.front[i + 1], a.front[i + 1], b.front[i], b.front[i + 1]);
        backIdx.push(a.back[i], a.back[i + 1], b.back[i], a.back[i + 1], b.back[i + 1], b.back[i]);
      }
      const cloth = clothAt(a);
      addLip(pointAt(a, 0), pointAt(b, 0), -1, cloth, false);
      addLip(pointAt(a, cols), pointAt(b, cols), 1, cloth, false);
    }
    function seal(row) {
      const cloth = clothAt(row);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const i0 = Math.round(cols * i / n);
        const i1 = Math.round(cols * (i + 1) / n);
        addLip(pointAt(row, i0), pointAt(row, i1), 0, cloth, true);
      }
    }
    if (rows.length) {
      seal(rows[0]);
      seal(rows[rows.length - 1]);
    }
    function geo(pos, uv, idx, colors) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      if (idx.length) g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    const frontMat = new THREE.MeshBasicMaterial({
      map: makeTex(frontImg),
      alphaTest: 0.5,
      premultipliedAlpha: true,
      side: THREE.FrontSide
    });
    const backMat = new THREE.MeshBasicMaterial({
      map: makeTex(backImg),
      alphaTest: 0.5,
      premultipliedAlpha: true,
      side: THREE.FrontSide
    });
    frontMat.toneMapped = false;
    backMat.toneMapped = false;
    frontMat.depthTest = true;
    backMat.depthTest = true;
    frontMat.depthWrite = true;
    backMat.depthWrite = true;
    frontMat.transparent = false;
    backMat.transparent = false;
    const edgeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthTest: true,
      depthWrite: true,
      transparent: false
    });
    const group = new THREE.Group();
    const frontMesh = new THREE.Mesh(geo(frontPos, frontUv, frontIdx), frontMat);
    const backMesh = new THREE.Mesh(geo(backPos, backUv, backIdx), backMat);
    const edgeMesh = new THREE.Mesh(geo(edgePos, null, edgeIdx, edgeCol), edgeMat);
    [frontMesh, backMesh].forEach(function (mesh) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    });
    const box = new THREE.Box3().setFromObject(group);
    group.userData.top = box.max.y;
    group.userData.bottom = box.min.y;
    group.userData.width = box.max.x - box.min.x;
    return group;
  }

  function makeHanger(shell) {
    const g = new THREE.Group();
    const metal = gold.clone();
    metal.color.set('#e8d4a4');
    metal.roughness = 0.1;
    metal.metalness = 1;
    metal.clearcoat = 0.9;
    metal.clearcoatRoughness = 0.12;
    metal.depthTest = true;
    metal.depthWrite = true;
    metal.transparent = false;
    metal.side = THREE.FrontSide;
    // About 45% of the previous 0.005 hook radius, so the bar fits inside the shell.
    const r = 0.00225;
    const rBar = r * 0.72;
    const railZ = 0.02;
    const around = 0.012 + r;
    const yShift = shell.position.y;
    const frontAttr = shell.children[0].geometry.attributes.position;
    const backAttr = shell.children[1].geometry.attributes.position;
    function nearestZ(attr, x, y) {
      let bestD = 1e9;
      let z = 0;
      for (let i = 0; i < attr.count; i += 3) {
        const dx = attr.getX(i) - x;
        const dy = attr.getY(i) - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; z = attr.getZ(i); }
      }
      return z;
    }
    function insideZ(x, yRot) {
      const y = yRot - yShift;
      const zf = nearestZ(frontAttr, x, y);
      const zb = nearestZ(backAttr, x, y);
      const lo = Math.min(zf, zb);
      const hi = Math.max(zf, zb);
      const mid = (zf + zb) * 0.5;
      return Math.min(hi - rBar - 0.0003, Math.max(lo + rBar + 0.0003, mid));
    }
    const hook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.055, insideZ(0, -0.055)),
      new THREE.Vector3(0, -0.028, insideZ(0, -0.028)),
      new THREE.Vector3(0, -0.012, insideZ(0, -0.012)),
      new THREE.Vector3(0, 0.002, railZ),
      new THREE.Vector3(0, around + 0.001, railZ),
      new THREE.Vector3(0, around * 0.2, railZ - around),
      new THREE.Vector3(0, -0.02, railZ - around * 0.55)
    ]);
    const half = Math.min(0.15, (shell.userData.width || 0.56) * 0.2);
    const barPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = -half + half * 2 * t;
      const y = -0.05 - 0.085 * Math.pow(Math.abs(t - 0.5) * 2, 1.55);
      barPts.push(new THREE.Vector3(x, y, insideZ(x, y)));
    }
    const bar = new THREE.CatmullRomCurve3(barPts);
    const hookMesh = new THREE.Mesh(new THREE.TubeGeometry(hook, 64, r, 10, false), metal);
    const barMesh = new THREE.Mesh(new THREE.TubeGeometry(bar, 48, rBar, 8, false), metal);
    hookMesh.renderOrder = 0;
    barMesh.renderOrder = 0;
    g.add(hookMesh, barMesh);
    g.traverse(function (obj) {
      if (!obj.isMesh) return;
      obj.castShadow = false;
      obj.material.depthTest = true;
      obj.material.depthWrite = true;
      obj.material.transparent = false;
    });
    return g;
  }

  function buildCap(white, logoImg, emblemImg) {
    const R = 0.092;
    const H = 0.086;
    const group = new THREE.Group();
    const cloth = new THREE.MeshPhysicalMaterial({
      color: white ? '#f3f1ec' : '#1c1d21',
      roughness: white ? 0.7 : 0.52,
      metalness: 0,
      sheen: white ? 0.16 : 0.5,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(white ? '#ffffff' : '#a0a0a8'),
      depthTest: true,
      depthWrite: true,
      transparent: false,
      side: THREE.FrontSide
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: white ? '#b9b6ae' : '#0c0c0e',
      roughness: 0.72,
      metalness: 0,
      depthTest: true,
      depthWrite: true,
      transparent: false
    });
    function dome(t, a, inset) {
      const y = H * Math.sin(t * Math.PI * 0.5);
      const rad = R * Math.cos(t * Math.PI * 0.5) * (inset || 1);
      return new THREE.Vector3(Math.sin(a) * rad, y, Math.cos(a) * rad);
    }
    function gridGeom(nu, nv, sample, flip) {
      const pos = [];
      const uv = [];
      const idx = [];
      for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
          const p = sample(i / nu, j / nv);
          pos.push(p.x, p.y, p.z);
          uv.push(i / nu, j / nv);
        }
      }
      const row = nu + 1;
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          const a = j * row + i;
          const b = a + 1;
          const c = a + row;
          const d = c + 1;
          if (flip) idx.push(a, c, b, b, c, d);
          else idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    function addMesh(geom, mat, order) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = order || 0;
      group.add(mesh);
      return mesh;
    }
    const panels = 6;
    for (let p = 0; p < panels; p++) {
      const a0 = p * (Math.PI * 2 / panels);
      const a1 = (p + 1) * (Math.PI * 2 / panels);
      addMesh(gridGeom(7, 18, function (u, v) {
        const edge = Math.min(u, 1 - u);
        const groove = 1 - 0.018 * Math.exp(-Math.pow(edge / 0.16, 2));
        const a = a0 + (a1 - a0) * u;
        const back = -Math.cos(a);
        const open = back > 0.25 ? Math.pow((back - 0.25) / 0.75, 1.4) * 0.2 : 0;
        const t = open + (1 - open) * v;
        return dome(t, a, groove);
      }), cloth, 0);
      const seamOpen = (-Math.cos(a0) > 0.25) ? Math.pow((-Math.cos(a0) - 0.25) / 0.75, 1.4) * 0.2 : 0;
      const seam = new THREE.CatmullRomCurve3([0, 0.2, 0.45, 0.7, 0.88, 1].map(function (t) {
        return dome(seamOpen + (1 - seamOpen) * t, a0, 1.002);
      }));
      addMesh(new THREE.TubeGeometry(seam, 28, 0.00105, 5, false), seamMat, 1);
    }
    addMesh(gridGeom(16, 8, function (u, v) {
      const b = v * Math.PI * 0.5;
      const a = u * Math.PI * 2;
      const rad = 0.011 * Math.cos(b);
      return new THREE.Vector3(Math.cos(a) * rad, H + Math.sin(b) * 0.0075, Math.sin(a) * rad);
    }), cloth, 0);

    function billPoint(u, v, lift) {
      const spread = 0.78;
      const a = (u - 0.5) * 2 * spread;
      const dist = R * 0.9 + v * 0.07;
      const arch = Math.cos((u - 0.5) * Math.PI) * 0.007 * (0.25 + v);
      const drop = v * v * 0.024;
      return new THREE.Vector3(
        Math.sin(a) * dist,
        0.014 + arch - drop + lift,
        Math.cos(a) * dist
      );
    }
    const surfaces = [
      { nu: 28, nv: 12, flip: true, sample: function (u, v) { return billPoint(u, v, 0.0042); } },
      { nu: 28, nv: 12, flip: false, sample: function (u, v) { return billPoint(u, v, 0); } }
    ];
    const bPos = [];
    const bUv = [];
    const bIdx = [];
    surfaces.forEach(function (s) {
      const start = bPos.length / 3;
      for (let j = 0; j <= s.nv; j++) {
        for (let i = 0; i <= s.nu; i++) {
          const p = s.sample(i / s.nu, j / s.nv);
          bPos.push(p.x, p.y, p.z);
          bUv.push(i / s.nu, j / s.nv);
        }
      }
      const row = s.nu + 1;
      for (let j = 0; j < s.nv; j++) {
        for (let i = 0; i < s.nu; i++) {
          const a = start + j * row + i;
          const b = a + 1;
          const c = a + row;
          const d = c + 1;
          if (s.flip) bIdx.push(a, b, c, b, d, c);
          else bIdx.push(a, c, b, b, c, d);
        }
      }
    });
    const rimStart = bPos.length / 3;
    const rimN = 28;
    for (let i = 0; i <= rimN; i++) {
      const top = billPoint(i / rimN, 1, 0.0034);
      const bot = billPoint(i / rimN, 1, 0);
      bPos.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
      bUv.push(i / rimN, 1, i / rimN, 1);
    }
    for (let i = 0; i < rimN; i++) {
      const a = rimStart + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      bIdx.push(a, b, c, c, b, d);
    }
    const billGeo = new THREE.BufferGeometry();
    billGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
    billGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
    billGeo.setIndex(bIdx);
    billGeo.computeVertexNormals();
    addMesh(billGeo, cloth, 0);

    function curvedPatch(cx, cy, halfA, halfY, tex) {
      const geom = gridGeom(18, 6, function (u, v) {
        const a = cx + (u - 0.5) * 2 * halfA;
        const y = cy + (v - 0.5) * 2 * halfY;
        const t = Math.asin(Math.max(-1, Math.min(1, y / H))) / (Math.PI * 0.5);
        const p = dome(Math.max(0, Math.min(0.96, t)), a, 1);
        const n = new THREE.Vector3(p.x / (R * R), p.y / (H * H), p.z / (R * R)).normalize();
        return p.add(n.multiplyScalar(0.0014));
      });
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        alphaTest: 0.35,
        depthTest: true,
        depthWrite: true,
        transparent: false,
        side: THREE.FrontSide,
        toneMapped: false
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      return addMesh(geom, mat, 2);
    }
    function imageTexture(img) {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
      return tex;
    }
    const yLogo = 0.033;
    const radLogo = R * Math.cos(Math.asin(Math.min(1, yLogo / H)));
    const logoW = 0.07;
    curvedPatch(0, yLogo, (logoW * 0.5) / radLogo, (logoW / 4.21) * 0.5, imageTexture(logoImg));
    const yEmb = 0.05;
    const radEmb = R * Math.cos(Math.asin(Math.min(1, yEmb / H)));
    const emb = 0.028;
    curvedPatch(Math.PI, yEmb, (emb * 0.5) / radEmb, emb * 0.5, imageTexture(emblemImg));

    const nameMesh = { current: null };
    function paintName(text) {
      if (nameMesh.current) {
        group.remove(nameMesh.current);
        if (nameMesh.current.material.map) nameMesh.current.material.map.dispose();
        nameMesh.current.material.dispose();
        nameMesh.current.geometry.dispose();
        nameMesh.current = null;
      }
      const label = String(text || '').trim();
      if (!label) return;
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = white ? '#1a1a1c' : '#f6f3ec';
      ctx.font = '600 148px Inter, Helvetica, Arial, sans-serif';
      ctx.textBaseline = 'middle';
      const chars = label.toUpperCase().split('');
      const gap = 14;
      const widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
      const total = widths.reduce(function (s, w) { return s + w; }, 0) + gap * Math.max(0, chars.length - 1);
      const fit = Math.min(1, (canvas.width * 0.84) / total);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(fit, 1);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      let x = (canvas.width - total) / 2;
      chars.forEach(function (ch, i) {
        ctx.fillText(ch, x, canvas.height / 2 + 6);
        x += widths[i] + gap;
      });
      ctx.restore();
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      const yName = 0.037;
      const radName = R * Math.cos(Math.asin(Math.min(1, yName / H)));
      const nameW = 0.036;
      const nameH = 0.0095;
      nameMesh.current = curvedPatch(Math.PI / 2, yName, (nameW * 0.5) / radName, nameH * 0.5, tex);
    }
    paintName('AGENT NAME');
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { paintName(group.userData.nameText || 'AGENT NAME'); });
    }
    group.userData.setName = function (text) {
      group.userData.nameText = text || 'AGENT NAME';
      paintName(group.userData.nameText);
    };

    const strap = new THREE.CatmullRomCurve3([-0.7, -0.25, 0.25, 0.7].map(function (u) {
      const a = Math.PI + u * 0.42;
      return new THREE.Vector3(Math.sin(a) * R * 0.86, 0.012, Math.cos(a) * R * 0.86);
    }));
    addMesh(new THREE.TubeGeometry(strap, 12, 0.0032, 6, false), seamMat, 1);

    const box = new THREE.Box3().setFromObject(group);
    group.userData.top = box.max.y;
    group.userData.bottom = box.min.y;
    group.userData.width = box.max.x - box.min.x;
    return group;
  }

  function softShadow(w, h) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 132, 16, 128, 140, 122);
    grd.addColorStop(0, 'rgba(40,32,24,0.14)');
    grd.addColorStop(0.6, 'rgba(40,32,24,0.04)');
    grd.addColorStop(1, 'rgba(40,32,24,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    );
    return mesh;
  }

  const pieces = [];
  const shelfW = railLen * 0.4;
  const shelfD = 0.2;
  const shelfT = 0.012;
  const shelfY = RAIL_Y + 0.52;
  const shelfZ = WALL_Z + shelfD / 2 + 0.012;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfW, shelfT, shelfD), shelfMat);
  shelf.position.set(rackCenter, shelfY, shelfZ);
  scene.add(shelf);
  const shelfLip = new THREE.Mesh(
    new THREE.BoxGeometry(shelfW - 0.02, 0.003, shelfD - 0.02),
    new THREE.MeshStandardMaterial({ color: '#2a2926', metalness: 0.9, roughness: 0.16 })
  );
  shelfLip.position.set(rackCenter, shelfY + shelfT / 2, shelfZ);
  scene.add(shelfLip);
  const rackParts = [rail, shelf, shelfLip].concat(railHardware);
  [-0.34, 0.34].forEach(function (t) {
    const x = rackCenter + t * shelfW;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, shelfD * 0.78), shelfMat);
    bracket.position.set(x, shelfY - 0.03, shelfZ + 0.02);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.01), shelfMat);
    plate.position.set(x, shelfY - 0.01, WALL_Z + 0.006);
    scene.add(bracket, plate);
    rackParts.push(bracket, plate);
  });
  const shelfShade = softShadow(shelfW * 1.05, shelfD * 0.7);
  shelfShade.rotation.x = -Math.PI / 2;
  shelfShade.position.set(rackCenter, shelfY - shelfT / 2 - 0.004, shelfZ + 0.02);
  scene.add(shelfShade);
  rackParts.push(shelfShade);
  const capX = rackCenter;

  Promise.all(SPECS.map(async function (spec, index) {
    const v = (window.ENESMA_SHOP && window.ENESMA_SHOP.ASSET) ? ('?v=' + window.ENESMA_SHOP.ASSET) : '';
    let shells;
    if (spec.sku === 'cap') {
      const logoW = await loadImage(window.SHOP_BASE + 'assets/logo/wordmark-white.png' + v);
      const logoB = await loadImage(window.SHOP_BASE + 'assets/logo/wordmark-black.png' + v);
      const embW = await loadImage(window.SHOP_BASE + 'assets/logo/emblem-white.png' + v);
      const embB = await loadImage(window.SHOP_BASE + 'assets/logo/emblem-black.png' + v);
      shells = {
        black: buildCap(false, logoW, embW),
        white: buildCap(true, logoB, embB)
      };
    } else {
      const colors = {};
      for (const color of ['black', 'white']) {
        const base = window.SHOP_BASE + 'assets/gear/' + spec.hang + '-' + color;
        colors[color] = {
          front: await loadImage(base + '-front.png' + v),
          back: await loadImage(base + '-back.png' + v)
        };
      }
      shells = {
        black: garmentMesh(colors.black.front, colors.black.back, spec),
        white: garmentMesh(colors.white.front, colors.white.back, spec)
      };
    }
    shells.white.visible = false;
    const rotator = new THREE.Group();
    rotator.add(shells.black, shells.white);
    const holder = new THREE.Group();
    if (spec.shelf) {
      const drop = -shells.black.userData.bottom;
      shells.black.position.y = drop;
      shells.white.position.y = -shells.white.userData.bottom;
      holder.position.set(capX, shelfY + shelfT / 2 + 0.001, shelfZ + shelfD * 0.08);
      if (spec.angle) rotator.rotation.y = spec.angle;
    } else {
      const neck = -0.01;
      shells.black.position.y = neck - shells.black.userData.top;
      shells.white.position.y = neck - shells.white.userData.top;
      rotator.add(makeHanger(shells.black));
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
      angle: spec.angle || 0,
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
          mat.depthTest = true;
          mat.depthWrite = true;
          if (!(mat.alphaTest > 0)) mat.transparent = piece.opacity < 0.98;
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
    const narrow = stage.clientWidth < 760;
    pieces.forEach(function (piece) {
      if (piece === focus) {
        piece.x = narrow ? rackCenter : rackCenter - 0.35;
        piece.y = piece.homeY;
        piece.scale = narrow ? 1 : 1.22;
        piece.opacity = 1;
      } else {
        piece.x = piece.homeX < focus.homeX ? -2.6 : rackCenter + 3.4;
        piece.scale = narrow ? 1 : 0.9;
        piece.opacity = narrow ? 0 : 0.12;
      }
    });
  }

  function fitDetail(piece) {
    piece.holder.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(piece.holder);
    const width = Math.max(1, stage.clientWidth);
    const cssH = Math.max(320, Math.round(Math.min(window.innerHeight * 0.58, 520)));
    stage.style.height = cssH + 'px';
    let contentW = Math.max(0.18, (box.max.x - box.min.x) * 1.16);
    let contentH = Math.max(0.18, (box.max.y - box.min.y) * 1.14);
    if (piece.spec.sku === 'cap') {
      contentW = Math.max(0.08, (box.max.x - box.min.x) / 0.85);
      contentH = Math.max(0.08, (box.max.y - box.min.y) / 0.78);
    }
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    camera.aspect = width / cssH;
    const zW = (contentW / camera.aspect) / (2 * half);
    const zH = contentH / (2 * half);
    const zFit = Math.max(zW, zH, piece.spec.sku === 'cap' ? 0.3 : 1.4);
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const pitch = piece.camPitch || 0;
    camera.position.set(cx, cy + Math.sin(pitch) * zFit, Math.cos(pitch) * zFit);
    camera.lookAt(cx, cy, 0);
    camera.updateProjectionMatrix();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (renderer.getPixelRatio() !== ratio || renderer.domElement.clientWidth !== width || renderer.domElement.clientHeight !== cssH) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, cssH);
    }
  }

  function frame() {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    camera.aspect = aspect;
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    const phone = stage.clientWidth < 760;
    let span = SPACING * 2 + 1.85;
    let lookY = 0.36;
    let camY = 0.5;
    if (phone && mode !== 'detail' && pieces[0]) {
      let minX = rackCenter - railLen / 2 - 0.02;
      let maxX = rackCenter + railLen / 2 + 0.02;
      let minY = Infinity;
      let maxY = shelf.position.y + 0.28;
      pieces.forEach(function (p) {
        if (!p) return;
        p.holder.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(p.holder);
        minY = Math.min(minY, box.min.y);
        maxY = Math.max(maxY, box.max.y);
      });
      const contentW = maxX - minX;
      const contentH = Math.max(0.4, maxY - minY);
      const width = stage.clientWidth;
      const padPx = 16;
      const topPx = 36;
      const botPx = 16;
      span = contentW * width / Math.max(1, width - padPx * 2);
      const cssH = Math.max(200, Math.round(contentH / span * width + topPx + botPx));
      stage.style.height = cssH + 'px';
      camera.aspect = width / cssH;
      const zFit = (span / camera.aspect) / (2 * half);
      const ndcTop = 1 - 2 * (topPx / cssH);
      lookY = maxY - ndcTop * zFit * half;
      camera.position.set((minX + maxX) / 2, lookY, zFit);
      camera.lookAt((minX + maxX) / 2, lookY, 0);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, cssH);
      return;
    }
    if (phone && mode === 'detail' && active) {
      fitDetail(active);
      return;
    }
    const z = Math.max(3.2, (span / Math.max(0.5, aspect)) / (2 * half));
    camera.position.set(rackCenter, camY, z);
    camera.lookAt(rackCenter, lookY, 0);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    function applyCapName() {
      const label = colorState.agentName && String(colorState.agentNameText || '').trim()
        ? colorState.agentNameText
        : 'AGENT NAME';
      ['black', 'white'].forEach(function (key) {
        const shell = active && active.shells[key];
        if (shell && shell.userData.setName) shell.userData.setName(label);
      });
    }
    const nameBox = document.getElementById('cName');
    if (nameBox) nameBox.onchange = function () { colorState.agentName = nameBox.checked; applyCapName(); drawSheet(); };
    const nameText = document.getElementById('cNameText');
    if (nameText) nameText.oninput = function () { colorState.agentNameText = nameText.value; applyCapName(); };
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
    if (stage.clientWidth < 760) {
      rackParts.forEach(function (part) { part.visible = !piece.spec.shelf && part === rail; });
    }
    drawSheet();
    frame();
  }
  function leave() {
    active = null;
    mode = 'rack';
    rackParts.forEach(function (part) { part.visible = true; });
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
    stage.__pieces = pieces;
    stage.__camera = camera;
    frame();
    (function loop() {
      applyVisuals();
      if (stage.clientWidth < 760 && mode === 'detail' && active) fitDetail(active);
      if (hover && mode === 'rack') showPill(hover);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })();
  }
}

if (document.getElementById('stage')) boot();
