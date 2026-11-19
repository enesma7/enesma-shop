/** Dress a garment GLB: cloth color, weave, chest logo, tonal back emblem, optional name. */

export const GARMENT_COLORS = {
  black: '#141418',
  white: '#f4f3f0'
};

export function makeWeaveNormal(THREE) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 64);
      const weft = 0.5 + 0.5 * Math.sin((y / size) * Math.PI * 64);
      const twill = ((x + y) % 8) < 4 ? 1 : 0.72;
      height[y * size + x] = warp * 0.55 + weft * 0.45 * twill;
    }
  }
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const l = height[y * size + Math.max(0, x - 1)];
      const r = height[y * size + Math.min(size - 1, x + 1)];
      const u = height[Math.max(0, y - 1) * size + x];
      const d = height[Math.min(size - 1, y + 1) * size + x];
      const nx = (l - r) * 1.6;
      const ny = (u - d) * 1.6;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = i * 4;
      img.data[o] = (nx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makeEmblemNormal(THREE, source) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source, 0, 0, size, size);
  const src = ctx.getImageData(0, 0, size, size);
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) height[i] = src.data[i * 4 + 3] / 255;
  const out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + Math.max(0, x - 1)];
      const r = height[y * size + Math.min(size - 1, x + 1)];
      const u = height[Math.max(0, y - 1) * size + x];
      const d = height[Math.min(size - 1, y + 1) * size + x];
      const nx = (l - r) * 3.2;
      const ny = (u - d) * 3.2;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      out.data[o] = (nx / len * 0.5 + 0.5) * 255;
      out.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      out.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      out.data[o + 3] = 255;
    }
  }
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  normalCanvas.getContext('2d').putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(normalCanvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makeNameTexture(THREE, text, black) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = black ? '#f7f7f5' : '#141418';
  ctx.font = '600 86px Inter, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || '').toUpperCase(), canvas.width / 2, canvas.height / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function decalMaterial(THREE, params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  return mat;
}

export function dress(root, THREE, tex, opts) {
  const black = opts.color !== 'white';
  const color = new THREE.Color(black ? GARMENT_COLORS.black : GARMENT_COLORS.white);
  const cloth = new THREE.MeshPhysicalMaterial({
    color,
    roughness: black ? 0.82 : 0.88,
    metalness: 0,
    sheen: black ? 0.28 : 0.12,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(black ? '#9a9aa2' : '#ffffff'),
    vertexColors: true,
    normalMap: tex.weave,
    normalScale: new THREE.Vector2(0.22, 0.22)
  });
  const metal = new THREE.MeshStandardMaterial({
    color: '#c5c7cb',
    metalness: 0.92,
    roughness: 0.28
  });
  root.traverse(function (node) {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const metalPart = node.name === 'qzip_zip' || (node.material && node.material.name === 'metal');
    node.material = metalPart ? metal : cloth;
  });

  const anchors = [];
  root.traverse(function (node) {
    if (node.userData && node.userData.anchor) anchors.push(node);
  });
  anchors.forEach(function (node) {
    const role = node.userData.role;
    const geo = new THREE.PlaneGeometry(node.userData.width, node.userData.height);
    let mat;
    if (role === 'logo' || role === 'name') {
      const map = role === 'logo'
        ? (black ? tex.wordWhite : tex.wordBlack)
        : makeNameTexture(THREE, opts.name, black);
      mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.35,
        depthWrite: false
      });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -4;
      mat.polygonOffsetUnits = -4;
    } else if (role === 'emblem') {
      mat = decalMaterial(THREE, {
        color: black ? '#6a6a72' : '#8a8a84',
        roughness: 0.38,
        metalness: 0.18,
        alphaMap: tex.emblemMask,
        alphaTest: 0.2,
        normalMap: tex.emblemNormal,
        normalScale: new THREE.Vector2(1.25, 1.25)
      });
    }
    const decal = new THREE.Mesh(geo, mat);
    decal.name = 'decal-' + role;
    if (role === 'name') decal.visible = !!(opts.name && String(opts.name).trim());
    decal.position.z = role === 'emblem' ? 0.002 : 0.004;
    decal.renderOrder = 2;
    node.add(decal);
  });
  root.userData.dressColor = black ? 'black' : 'white';
  return root;
}
