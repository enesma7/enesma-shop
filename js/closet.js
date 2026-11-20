import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const UI = window.ShopUI;
const Cat = window.ShopCatalog;
const Cart = window.ShopCart;

const SPECS = [
  { sku: 't-shirt', hang: 't-shirt', tall: 0.98, shelf: false, bulge: 0.05, thick: 0.006 },
  { sku: 'polo', hang: 'polo', tall: 1.02, shelf: false, bulge: 0.046, thick: 0.006 },
  { sku: 'quarter-zip', hang: 'quarter-zip', tall: 1.0, shelf: false, bulge: 0.046, thick: 0.006 },
  { sku: 'cap', hang: 'cap', tall: 0.16, shelf: true, bulge: 0, thick: 0, angle: 1.05 }
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
    // Mipmaps average the white background into the sleeve hem and draw it as a gray shelf.
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.premultiplyAlpha = true;
    tex.needsUpdate = true;
    return tex;
  }

  // The cutouts leave a thin transparent slit under each sleeve. The mesh spans
  // that slit, then alphaTest opens it into a notch in the side seam. Close only
  // the short, off-center slits in the sleeve band. Neck and hem stay open.
  function sealSlits(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = image.data;
    const w = canvas.width;
    const h = canvas.height;
    let minY = h;
    let maxY = 0;
    let minX = w;
    let maxX = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (px[(y * w + x) * 4 + 3] > 140) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    const span = Math.max(1, maxX - minX);
    const tall = Math.max(1, maxY - minY);
    const limit = span * 0.12;
    const y0 = minY + tall * 0.28;
    const y1 = minY + tall * 0.62;
    const midX = (minX + maxX) / 2;
    for (let y = (y0 | 0); y < y1; y++) {
      const runs = [];
      let x = 0;
      while (x < w) {
        while (x < w && px[(y * w + x) * 4 + 3] <= 140) x++;
        if (x >= w) break;
        const start = x;
        while (x < w && px[(y * w + x) * 4 + 3] > 140) x++;
        runs.push([start, x - 1]);
      }
      for (let i = 0; i < runs.length - 1; i++) {
        const gapL = runs[i][1] + 1;
        const gapR = runs[i + 1][0] - 1;
        const gw = gapR - gapL + 1;
        if (gw < 2 || gw > limit) continue;
        if (Math.abs((gapL + gapR) / 2 - midX) < span * 0.18) continue;
        // The run edge is an anti-aliased fringe, often light gray. Sample
        // inward so the closed slit matches the cloth, not the fringe.
        const inset = 12;
        const leftX = Math.max(runs[i][0], runs[i][1] - inset);
        const rightX = Math.min(runs[i + 1][1], runs[i + 1][0] + inset);
        const left = (y * w + leftX) * 4;
        const right = (y * w + rightX) * 4;
        for (let fill = gapL; fill <= gapR; fill++) {
          const t = (fill - gapL) / Math.max(1, gw - 1);
          const o = (y * w + fill) * 4;
          px[o] = px[left] * (1 - t) + px[right] * t;
          px[o + 1] = px[left + 1] * (1 - t) + px[right + 1] * t;
          px[o + 2] = px[left + 2] * (1 - t) + px[right + 2] * t;
          px[o + 3] = 255;
        }
      }
    }
    // The cutout fringe is a light pixel with full alpha. Triangles along the
    // sleeve hem stretch that one pixel into a gray shelf. Recolor it from cloth.
    const copy = new Uint8ClampedArray(px);
    const reach = 2;
    const take = 14;
    for (let y = take; y < h - take; y++) {
      let rowEdge = false;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (copy[(row + x) * 4 + 3] > 140) { rowEdge = true; break; }
      }
      if (!rowEdge) continue;
      for (let x = take; x < w - take; x++) {
        const o = (row + x) * 4;
        if (copy[o + 3] <= 140) continue;
        let edge = false;
        for (let k = 1; k <= reach && !edge; k++) {
          if (copy[(row + x + k) * 4 + 3] <= 140 || copy[(row + x - k) * 4 + 3] <= 140) edge = true;
        }
        if (!edge) continue;
        const dir = x < midX ? 1 : -1;
        const ix = x + dir * take;
        const io = (row + ix) * 4;
        if (copy[io + 3] > 140) {
          px[o] = copy[io];
          px[o + 1] = copy[io + 1];
          px[o + 2] = copy[io + 2];
        }
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function garmentMesh(frontImg, backImg, spec) {
    const frontSrc = sealSlits(frontImg);
    const backSrc = sealSlits(backImg);
    const maxMask = 480;
    const sc = maxMask / Math.max(frontImg.width, frontImg.height);
    const iw = Math.max(8, Math.round(frontImg.width * sc));
    const ih = Math.max(8, Math.round(frontImg.height * sc));
    const mask = document.createElement('canvas');
    mask.width = iw;
    mask.height = ih;
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(frontSrc, 0, 0, iw, ih);
    const frontPx = mctx.getImageData(0, 0, iw, ih).data;
    mctx.clearRect(0, 0, iw, ih);
    mctx.drawImage(backSrc, 0, 0, iw, ih);
    const backPx = mctx.getImageData(0, 0, iw, ih).data;
    // Front and back photos are not the same outline. The front sleeve hangs
    // past the back sleeve, and that extra cloth shows through as a notch
    // under the cuff. Keep only the pixels that are cloth on both sides.
    const data = new Uint8ClampedArray(frontPx);
    for (let i = 3; i < data.length; i += 4) {
      if (!(frontPx[i] > 140 && backPx[i] > 140)) data[i] = 0;
    }
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
    // Knock out single-row spikes only. A hard clamp was chamfering the sleeve hem
    // into the waist and leaving a notch in the side seam.
    function despike(key) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < samples.length - 1; i++) {
          const prev = samples[i - 1][key];
          const next = samples[i + 1][key];
          const cur = samples[i][key];
          const mid = (prev + next) / 2;
          if (Math.abs(prev - next) < 10 && Math.abs(cur - mid) > 6 && Math.abs(cur - mid) < 28) {
            samples[i][key] = mid;
          }
        }
      }
    }
    despike('l');
    despike('r');
    // The front and back torsos are not the same width, so their overlap steps
    // in just under the sleeve and the body reads as two stacked pieces.
    // Keep the sleeves, and make the side seam one smooth contour to the hem.
    (function smoothTorso() {
      const n = samples.length;
      if (n < 16) return;
      const widthAt = samples.map(function (s) { return s.r - s.l; });
      const lo = Math.floor(n * 0.4);
      const hi = Math.floor(n * 0.8);
      const band = widthAt.slice(lo, hi).slice().sort(function (a, b) { return a - b; });
      const torso = band[band.length >> 1];
      if (!(torso > 8)) return;
      const sleeveCut = torso * 1.16;
      const hemCut = torso * 0.82;
      const isTorso = widthAt.map(function (width, i) {
        return i > 2 && width < sleeveCut && width > hemCut;
      });
      const radius = 16;
      const nextL = samples.map(function (s) { return s.l; });
      const nextR = samples.map(function (s) { return s.r; });
      for (let i = 0; i < n; i++) {
        if (!isTorso[i]) continue;
        let sumL = 0;
        let sumR = 0;
        let sumW = 0;
        for (let k = -radius; k <= radius; k++) {
          const j = i + k;
          if (j < 0 || j >= n || !isTorso[j]) continue;
          const weight = radius + 1 - Math.abs(k);
          sumL += samples[j].l * weight;
          sumR += samples[j].r * weight;
          sumW += weight;
        }
        if (sumW > 0) {
          nextL[i] = sumL / sumW;
          nextR[i] = sumR / sumW;
        }
      }
      for (let i = 0; i < n; i++) {
        if (!isTorso[i]) continue;
        samples[i].l = nextL[i];
        samples[i].r = nextR[i];
      }
    })();
    // A sleeve hem can fall between two samples and become one long triangle.
    // That triangle stretches the gray edge into a shelf. Step the edge across.
    const eased = [samples[0]];
    for (let i = 1; i < samples.length; i++) {
      const prev = eased[eased.length - 1];
      const next = samples[i];
      const jump = Math.max(Math.abs(next.l - prev.l), Math.abs(next.r - prev.r));
      if (jump > 6) {
        const parts = Math.ceil(jump / 4);
        for (let k = 1; k < parts; k++) {
          const t = k / parts;
          eased.push({
            y: prev.y + (next.y - prev.y) * t,
            l: prev.l + (next.l - prev.l) * t,
            r: prev.r + (next.r - prev.r) * t
          });
        }
      }
      eased.push(next);
    }
    samples.length = 0;
    eased.forEach(function (row) { samples.push(row); });
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
      const span = Math.hypot(dx, dy);
      if (span < 0.0004) return;
      // A steep sleeve hem is already covered by the front and back grids.
      // A lip across that jump sticks out as a break in the side seam.
      if (!force && Math.abs(dx) > Math.abs(dy) * 3 && Math.abs(dx) > 0.012) return;
      const segs = Math.max(4, Math.ceil(span / 0.02));
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
      map: makeTex(frontSrc),
      alphaTest: 0.5,
      premultipliedAlpha: true,
      side: THREE.DoubleSide
    });
    const backMat = new THREE.MeshBasicMaterial({
      map: makeTex(backSrc),
      alphaTest: 0.5,
      premultipliedAlpha: true,
      side: THREE.DoubleSide
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

  // One solid cap. u = ((ang + PI) / (2*PI) + 0.25) % 1 with ang = atan2(x, z),
  // so the front is u=0.75, the center back seam is u=0.25, and the texture
  // seam sits on the empty right side. v=0 is the sweatband.
  function makeCap(crownImg, billImg, light) {
    const baseRx = 0.168;
    const baseRz = 0.156;
    const height = 0.158;
    const rings = 40;
    const segs = 96;
    const crownPos = [];
    const crownUv = [];
    const crownCol = [];
    const crownIdx = [];

    function radK(t) {
      // Mid-profile dome: full width at the sweatband, rounding in toward the button.
      const elev = t * Math.PI * 0.5;
      return Math.pow(Math.cos(elev), 0.78);
    }
    function angOf(j) {
      // Start at the wearer's right so the mesh seam matches the texture seam.
      let ang = Math.PI / 2 + (j / segs) * Math.PI * 2;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      return ang;
    }
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = height * Math.sin(t * Math.PI * 0.5);
      const k = radK(t);
      for (let j = 0; j <= segs; j++) {
        const ang = angOf(j);
        const fromBack = Math.PI - Math.abs(ang);
        let yy = y;
        // A soft opening above the strap. The falloff is smooth so the edge does not spike.
        const backness = Math.max(0, 1 - fromBack / 0.85);
        if (backness > 0 && t < 0.22) {
          const lift = 0.03 * Math.pow(backness, 1.6) * Math.pow(1 - t / 0.22, 1.3);
          yy += lift;
        }
        crownPos.push(Math.sin(ang) * baseRx * k, yy, Math.cos(ang) * baseRz * k);
        crownUv.push(j / segs, t);
        const light = 0.78 + 0.22 * (0.55 + 0.45 * Math.max(0, Math.cos(ang) * 0.65 + t * 0.5));
        crownCol.push(light, light, light);
      }
    }
    const stride = segs + 1;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        crownIdx.push(a, c, b, b, c, d);
      }
    }
    function geo(pos, uv, col, idx) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    function texOf(img) {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.flipY = true;
      tex.needsUpdate = true;
      return tex;
    }
    const cloth = new THREE.MeshBasicMaterial({
      map: texOf(crownImg),
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const billCloth = new THREE.MeshBasicMaterial({
      map: texOf(billImg),
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo(crownPos, crownUv, crownCol, crownIdx), cloth));

    // Pre-curved bill, attached only across the front panels.
    const arc0 = -0.96;
    const arc1 = 0.96;
    const bSeg = 28;
    const bRing = 14;
    const billPos = [];
    const billUv = [];
    const billCol = [];
    const billIdx = [];
    function billPoint(f, ang, under) {
      const narrow = 1 - 0.16 * f;
      const x = Math.sin(ang) * baseRx * narrow;
      const along = Math.max(0, Math.cos(ang));
      const forward = 0.002 + f * 0.112 * (0.45 + 0.55 * along);
      const z = Math.cos(ang) * baseRz * (1 - 0.05 * f) + forward;
      const y = 0.012 - f * f * (0.01 + 0.028 * along) - (under ? 0.003 : 0);
      return [x, y, z];
    }
    for (let s = 0; s <= bRing; s++) {
      const f = s / bRing;
      for (let i = 0; i <= bSeg; i++) {
        const ang = arc0 + (arc1 - arc0) * (i / bSeg);
        const p = billPoint(f, ang, false);
        billPos.push(p[0], p[1], p[2]);
        billUv.push(i / bSeg, 1 - f);
        const shade = 0.9 - 0.18 * f;
        billCol.push(shade, shade, shade);
      }
    }
    const bStride = bSeg + 1;
    for (let s = 0; s < bRing; s++) {
      for (let i = 0; i < bSeg; i++) {
        const a = s * bStride + i;
        const b = a + 1;
        const c = a + bStride;
        const d = c + 1;
        billIdx.push(a, b, c, b, d, c);
      }
    }
    // Underside and the thin leading edge, so the bill reads as a brim.
    const underBase = billPos.length / 3;
    for (let s = 0; s <= bRing; s++) {
      const f = s / bRing;
      for (let i = 0; i <= bSeg; i++) {
        const ang = arc0 + (arc1 - arc0) * (i / bSeg);
        const p = billPoint(f, ang, true);
        billPos.push(p[0], p[1], p[2]);
        billUv.push(i / bSeg, 1 - f);
        billCol.push(0.55, 0.55, 0.55);
      }
    }
    for (let s = 0; s < bRing; s++) {
      for (let i = 0; i < bSeg; i++) {
        const a = underBase + s * bStride + i;
        const b = a + 1;
        const c = a + bStride;
        const d = c + 1;
        billIdx.push(a, c, b, b, c, d);
      }
    }
    group.add(new THREE.Mesh(geo(billPos, billUv, billCol, billIdx), billCloth));

    // Strap across the lower back, under the center seam.
    const strapPos = [];
    const strapUv = [];
    const strapCol = [];
    const strapIdx = [];
    const sSeg = 16;
    for (let row = 0; row <= 1; row++) {
      for (let i = 0; i <= sSeg; i++) {
        const ang = Math.PI - 0.5 + (i / sSeg) * 1.0;
        const a = ang > Math.PI ? ang - Math.PI * 2 : ang;
        const y = row === 0 ? 0.0 : 0.02;
        strapPos.push(Math.sin(a) * baseRx * 1.012, y, Math.cos(a) * baseRz * 1.012);
        strapUv.push(i / sSeg, row);
        strapCol.push(0.72, 0.72, 0.72);
      }
    }
    for (let i = 0; i < sSeg; i++) {
      strapIdx.push(i, i + 1, i + sSeg + 1, i + 1, i + sSeg + 2, i + sSeg + 1);
    }
    group.add(new THREE.Mesh(geo(strapPos, strapUv, strapCol, strapIdx), billCloth));

    const button = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 18, 12),
      new THREE.MeshBasicMaterial({ color: light ? '#f3f3f3' : '#141414', toneMapped: false })
    );
    button.scale.set(1, 0.72, 1);
    button.position.set(0, height + 0.004, 0);
    group.add(button);

    const box = new THREE.Box3().setFromObject(group);
    group.userData.top = box.max.y;
    group.userData.bottom = box.min.y;
    group.userData.width = box.max.x - box.min.x;
    group.userData.setName = function () {};
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
      async function loadSet(color) {
        const crown = await loadImage(window.SHOP_BASE + 'assets/gear/cap-atlas-' + color + '.png' + v);
        const bill = await loadImage(window.SHOP_BASE + 'assets/gear/cap-bill-' + color + '.png' + v);
        return makeCap(crown, bill, color === 'white');
      }
      shells = { black: await loadSet('black'), white: await loadSet('white') };
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
      contentW = Math.max(0.08, (box.max.x - box.min.x) / 1.02);
      contentH = Math.max(0.04, (box.max.y - box.min.y) / 0.9);
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
