import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { dress, makeWeaveNormal, makeEmblemNormal } from '../js/dress.js';

const loader = new GLTFLoader();
const cache = new Map();
const tex = {};
let renderer;
let scene;
let camera;
let pmrem;

function loadGLB(url) {
  if (cache.has(url)) return Promise.resolve(cache.get(url).clone(true));
  return new Promise(function (resolve, reject) {
    loader.load(url, function (gltf) {
      cache.set(url, gltf.scene);
      resolve(gltf.scene.clone(true));
    }, undefined, reject);
  });
}

function loadImage(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function imageTexture(THREE, img) {
  const t = new THREE.Texture(img);
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

async function boot() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setPixelRatio(1);
  renderer.setSize(64, 64, false);
  document.body.appendChild(renderer.domElement);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#fbfbfb');
  camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);

  pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.045).texture;

  const wordWhite = await loadImage('/assets/logo/wordmark-white.png');
  const wordBlack = await loadImage('/assets/logo/wordmark-black.png');
  const emblem = await loadImage('/assets/logo/emblem-mask.png');
  tex.wordWhite = imageTexture(THREE, wordWhite);
  tex.wordBlack = imageTexture(THREE, wordBlack);
  tex.emblemMask = imageTexture(THREE, emblem);
  tex.emblemMask.colorSpace = THREE.NoColorSpace;
  tex.emblemNormal = makeEmblemNormal(THREE, emblem);
  tex.weave = makeWeaveNormal(THREE);
  tex.wordWhiteImg = wordWhite;
  tex.wordBlackImg = wordBlack;
  window.__ready = true;
}

function resetScene() {
  while (scene.children.length) scene.remove(scene.children[0]);
  scene.add(new THREE.AmbientLight('#fffaf6', 0.62));
  const key = new THREE.DirectionalLight('#fff8f2', 1.85);
  key.position.set(-1.4, 2.4, 2.2);
  const fill = new THREE.DirectionalLight('#e7edf5', 0.7);
  fill.position.set(2.2, 1.2, 1.6);
  const rim = new THREE.DirectionalLight('#ffffff', 0.85);
  rim.position.set(-0.2, 1.6, -2.2);
  scene.add(key, fill, rim);
}

function frameObject(object, yaw, fill) {
  object.rotation.set(0, yaw || 0, 0);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const vFov = camera.fov * Math.PI / 180;
  const distY = (size.y * 0.5) / Math.tan(vFov / 2);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distX = (size.x * 0.5) / Math.tan(hFov / 2);
  const dist = Math.max(distX, distY) / (fill || 0.86);
  camera.position.set(center.x, center.y + size.y * 0.02, center.z + dist);
  camera.near = dist / 80;
  camera.far = dist * 8;
  camera.lookAt(center.x, center.y, center.z);
  camera.updateProjectionMatrix();

  const shadow = shadowTexture();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, size.z) * 1.8, Math.max(size.x, size.z) * 1.15),
    new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(center.x, box.min.y - 0.004, center.z + size.z * 0.05);
  scene.add(plane);
}

let shadowTex;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 120);
  grd.addColorStop(0, 'rgba(0,0,7,0.28)');
  grd.addColorStop(1, 'rgba(0,0,7,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

async function renderGarment(job) {
  resetScene();
  const root = await loadGLB('/models/' + job.model + '.glb');
  dress(root, THREE, tex, { color: job.color, name: job.name || '' });
  scene.add(root);
  const w = job.width || 1800;
  const h = job.height || 2250;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameObject(root, job.yaw || 0.18, job.fill || 0.9);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

function canvasTexture(canvas, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function forSaleCanvas(color) {
  const c = document.createElement('canvas');
  c.width = 1536;
  c.height = 2048;
  const ctx = c.getContext('2d');
  const dark = color === 'black';
  ctx.fillStyle = dark ? '#141418' : '#f6f5f2';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = dark ? 'rgba(251,251,251,0.16)' : 'rgba(0,0,7,0.12)';
  ctx.lineWidth = 10;
  ctx.strokeRect(48, 48, c.width - 96, c.height - 96);
  const logo = dark ? tex.wordWhiteImg : tex.wordBlackImg;
  const lw = 1080;
  const lh = lw * (logo.height / logo.width);
  ctx.drawImage(logo, (c.width - lw) / 2, 220, lw, lh);
  ctx.fillStyle = dark ? '#fbfbfb' : '#000007';
  ctx.font = '700 188px Inter, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOR SALE', c.width / 2, 1180);
  ctx.strokeStyle = dark ? 'rgba(251,251,251,0.35)' : 'rgba(0,0,7,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c.width / 2, 1560, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '500 42px Inter, Helvetica, Arial, sans-serif';
  ctx.fillStyle = dark ? '#d5d5d8' : '#3c3c42';
  ctx.fillText('YOUR NAME', c.width / 2, 1760);
  ctx.font = '500 28px Inter, Helvetica, Arial, sans-serif';
  ctx.fillStyle = dark ? '#8d8d93' : '#6b6b70';
  ctx.fillText('PHOTO AND CONTACT ADDED AT ORDER', c.width / 2, 1848);
  return c;
}

function openHouseCanvas(color) {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 2100;
  const ctx = c.getContext('2d');
  const dark = color === 'black';
  ctx.fillStyle = dark ? '#101012' : '#fbfbfb';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = dark ? '#fbfbfb' : '#000007';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 210px Inter, Helvetica, Arial, sans-serif';
  ctx.fillText('OPEN', c.width / 2, 430);
  ctx.fillText('HOUSE', c.width / 2, 680);
  const grad = ctx.createLinearGradient(180, 0, c.width - 180, 0);
  grad.addColorStop(0, '#9A0007');
  grad.addColorStop(0.5, '#EF0207');
  grad.addColorStop(1, '#9A0007');
  ctx.fillStyle = grad;
  for (let i = 0; i < 3; i++) {
    const x = 260 + i * 320;
    ctx.beginPath();
    ctx.moveTo(x, 980);
    ctx.lineTo(x + 210, 1140);
    ctx.lineTo(x, 1300);
    ctx.lineTo(x + 70, 1140);
    ctx.closePath();
    ctx.fill();
  }
  const logo = dark ? tex.wordWhiteImg : tex.wordBlackImg;
  const lw = 820;
  const lh = lw * (logo.height / logo.width);
  ctx.drawImage(logo, (c.width - lw) / 2, 1560, lw, lh);
  return c;
}

function cardCanvas(color) {
  const c = document.createElement('canvas');
  c.width = 1050;
  c.height = 600;
  const ctx = c.getContext('2d');
  const dark = color === 'black';
  ctx.fillStyle = dark ? '#141418' : '#fbfbfb';
  roundRect(ctx, 0, 0, c.width, c.height, 36);
  ctx.fill();
  const logo = dark ? tex.wordWhiteImg : tex.wordBlackImg;
  const lw = 760;
  const lh = lw * (logo.height / logo.width);
  ctx.drawImage(logo, 80, 150, lw, lh);
  const grad = ctx.createLinearGradient(80, 0, 420, 0);
  grad.addColorStop(0, '#9A0007');
  grad.addColorStop(1, '#EF0207');
  ctx.fillStyle = grad;
  ctx.fillRect(80, 470, 180, 8);
  ctx.fillStyle = dark ? '#c8c8cc' : '#3a3a40';
  ctx.font = '500 34px Inter, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('REAL ESTATE', 80, 520);
  return c;
}

function boardMesh(width, height, depth, faceCanvas, materialKind) {
  const face = canvasTexture(faceCanvas);
  const isMetal = materialKind === 'aluminum';
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: face,
    roughness: isMetal ? 0.34 : 0.62,
    metalness: isMetal ? 0.42 : 0.02,
    clearcoat: isMetal ? 0.35 : 0.06,
    clearcoatRoughness: 0.4
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: isMetal ? '#d5d6d8' : '#eceae6',
    roughness: isMetal ? 0.28 : 0.75,
    metalness: isMetal ? 0.85 : 0
  });
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mats = [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  return mesh;
}

async function renderSign(job) {
  resetScene();
  const group = new THREE.Group();
  if (job.product === 'a-frame') {
    group.add(buildAFrame(job.color));
  } else if (job.product === 'open-house') {
    const face = openHouseCanvas(job.color);
    group.add(boardMesh(0.305, 0.457, 0.006, face, 'plastic'));
  } else {
    const face = forSaleCanvas(job.color);
    const depth = job.product === 'aluminum' ? 0.0022 : 0.008;
    const board = boardMesh(0.457, 0.61, depth, face, job.product === 'aluminum' ? 'aluminum' : 'plastic');
    group.add(board);
    if (job.product === 'aluminum') {
      const holeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.5, metalness: 0.4 });
      for (const x of [-0.16, 0.16]) {
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 24), holeMat);
        hole.rotation.x = Math.PI / 2;
        hole.position.set(x, 0.27, 0);
        group.add(hole);
      }
    }
  }
  scene.add(group);
  const w = job.width || 1800;
  const h = job.height || 2200;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameObject(group, job.yaw == null ? 0.42 : job.yaw, job.fill || 0.86);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

function buildAFrame(color) {
  const group = new THREE.Group();
  const dark = color === 'black';
  const frameMat = new THREE.MeshStandardMaterial({
    color: dark ? '#1a1a1e' : '#f4f4f2',
    roughness: 0.45,
    metalness: dark ? 0.15 : 0.05
  });
  const face = openHouseCanvas(color);
  const panelGeo = new THREE.BoxGeometry(0.42, 0.62, 0.012);
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: canvasTexture(face),
    roughness: 0.55,
    metalness: 0.02
  });
  const edge = new THREE.MeshStandardMaterial({ color: dark ? '#2a2a30' : '#e7e5e1', roughness: 0.6 });
  const front = new THREE.Mesh(panelGeo, [edge, edge, edge, edge, faceMat, edge]);
  front.position.set(0, 0.42, 0.16);
  front.rotation.x = -0.18;
  const back = new THREE.Mesh(panelGeo, edge);
  back.position.set(0, 0.42, -0.16);
  back.rotation.x = 0.18;
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 20), frameMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.74, 0);
  group.add(front, back, hinge);
  for (const z of [-0.28, 0.28]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.04), frameMat);
    foot.position.set(0, 0.08, z);
    group.add(foot);
  }
  return group;
}

async function renderCards(job) {
  resetScene();
  const group = new THREE.Group();
  const face = canvasTexture(cardCanvas(job.color));
  const dark = job.color === 'black';
  const edge = new THREE.MeshStandardMaterial({ color: dark ? '#2c2c32' : '#dedcd7', roughness: 0.55 });
  const front = new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.42, metalness: 0.04, clearcoat: 0.2, clearcoatRoughness: 0.45 });
  const backMat = new THREE.MeshStandardMaterial({ color: dark ? '#101014' : '#f7f6f3', roughness: 0.7 });
  const layers = job.layers || 10;
  for (let i = 0; i < layers; i++) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.089, 0.051, 0.0004), [edge, edge, edge, edge, front, backMat]);
    card.position.y = i * 0.0012;
    card.rotation.x = -0.7;
    card.rotation.z = (i - layers / 2) * 0.012;
    group.add(card);
  }
  scene.add(group);
  const w = job.width || 1800;
  const h = job.height || 1400;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameObject(group, job.yaw == null ? 0.7 : job.yaw, 0.82);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

async function renderGroup(job) {
  resetScene();
  const group = new THREE.Group();
  let x = 0;
  for (const item of job.items) {
    const root = await loadGLB('/models/' + item.model + '.glb');
    dress(root, THREE, tex, { color: item.color, name: item.name || '' });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.position.x = x - box.min.x;
    if (item.model === 'cap') root.position.y = 0.02;
    group.add(root);
    x += size.x + (item.gap || 0.08);
  }
  scene.add(group);
  const w = job.width || 2400;
  const h = job.height || 1600;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameObject(group, job.yaw || 0.22, job.fill || 0.88);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

window.renderJob = async function (job) {
  try {
    if (job.kind === 'garment') return await renderGarment(job);
    if (job.kind === 'sign') return await renderSign(job);
    if (job.kind === 'cards') return await renderCards(job);
    if (job.kind === 'group') return await renderGroup(job);
    throw new Error('Unknown job ' + job.kind);
  } catch (err) {
    return 'ERROR ' + (err && err.message ? err.message : err);
  }
};

boot().catch(function (err) {
  window.__bootError = String(err && err.stack || err);
  window.__ready = true;
});
