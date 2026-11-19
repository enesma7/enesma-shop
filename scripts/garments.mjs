/**
 * Parametric garment meshes for the ENESMA closet and product renders.
 * Units are meters. Front of each garment faces +Z. Wearer's left is +X.
 * Built for this shop (original geometry), not copied from a third-party model.
 */
import {
  lerp, smoothstep, clamp, wrinkle, gridMesh, finalize,
  vadd, vmul, vnorm, quatFromZ, quadBezier, quadTangent
} from './mesh.mjs';

function halfWidth(t, s) {
  const pinch = Math.sin(clamp(t, 0, 1) * Math.PI) * s.waistPinch;
  const body = lerp(s.hemHalf, s.chestHalf, smoothstep(Math.min(1, t / 0.7)));
  const shoulder = smoothstep((t - 0.74) / 0.26);
  return lerp(body, s.shoulderHalf, shoulder) - pinch * (1 - shoulder);
}

function depthAt(t, s) {
  const belly = Math.sin(clamp(t, 0, 1) * Math.PI);
  return s.depth * (0.42 + 0.58 * belly);
}

function clampNeck(x, y, s) {
  // A shallow crew dip, not an open hole. The collar ring sits in this curve.
  if (Math.abs(x) >= s.neckRx) return y;
  const inside = 1 - (x * x) / (s.neckRx * s.neckRx);
  const dip = s.neckRy * 0.55 * Math.sqrt(Math.max(0, inside));
  return y - dip * smoothstep((y - (s.length - s.neckRy * 1.4)) / (s.neckRy * 1.4));
}

function aoFor(u, v) {
  const edge = Math.min(u, 1 - u);
  const side = 0.78 + 0.22 * smoothstep(edge / 0.12);
  const hem = v < 0.06 ? lerp(0.86, 1, v / 0.06) : 1;
  return side * hem;
}

function buildTorso(s) {
  const rows = 80;
  const cols = 64;
  const samples = [];
  for (let i = 0; i <= rows; i++) {
    const row = [];
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const xNorm = u * 2 - 1;
      const half = halfWidth(t, s);
      const x = xNorm * half;
      let y = s.length * t;
      const sZone = smoothstep((t - 0.7) / 0.3);
      y -= sZone * Math.pow(Math.abs(xNorm), 1.25) * s.shoulderDrop;
      y = clampNeck(x, y, s);
      const depth = depthAt(t, s);
      const center = Math.pow(1 - Math.abs(xNorm), 1.15);
      const wF = wrinkle(x, y, s.seed) * (0.55 + 0.8 * (1 - t)) * (0.45 + center);
      const wB = wrinkle(x, y, s.seed + 4.2) * 0.7 * (0.45 + 0.55 * (1 - t));
      const belly = Math.sin(clamp(t, 0, 1) * Math.PI) * center * 0.028;
      const hemBand = t < 0.045 ? (1 - t / 0.045) * 0.006 : 0;
      const frontZ = depth * 0.55 + belly + wF + hemBand;
      const backZ = -depth * 0.42 - belly * 0.35 + wB - hemBand;
      row.push({ x, y, frontZ, backZ, u, t });
    }
    samples.push(row);
  }

  function sheet(which) {
    return gridMesh(rows, cols, (v, u) => {
      const i = Math.round(v * rows);
      const j = Math.round(u * cols);
      const p = samples[i][j];
      const z = which === 'front' ? p.frontZ : p.backZ;
      return [p.x, p.y, z];
    }, (v, u) => {
      const a = aoFor(u, v);
      return [a, a, a];
    }, which === 'back');
  }

  const front = sheet('front');
  const back = sheet('back');

  const side = buildSides(samples, rows, cols);
  const hem = buildHem(samples, cols);
  return { front, back, side, hem, samples, rows, cols };
}

function buildSides(samples, rows, cols) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  function push(p, ao) {
    positions.push(p.x, p.y, p.z);
    uvs.push(p.x / 0.0045, p.y / 0.0045);
    colors.push(ao, ao, ao);
    return (positions.length / 3) - 1;
  }
  for (let edge = 0; edge < 2; edge++) {
    const j = edge === 0 ? 0 : cols;
    for (let i = 0; i < rows; i++) {
      const a = samples[i][j];
      const b = samples[i + 1][j];
      const ao = 0.72;
      const i0 = push({ x: a.x, y: a.y, z: a.frontZ }, ao);
      const i1 = push({ x: a.x, y: a.y, z: a.backZ }, ao);
      const i2 = push({ x: b.x, y: b.y, z: b.frontZ }, ao);
      const i3 = push({ x: b.x, y: b.y, z: b.backZ }, ao);
      if (edge === 0) indices.push(i0, i1, i2, i2, i1, i3);
      else indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const pos = Float32Array.from(positions);
  const index = Uint32Array.from(indices);
  return {
    positions: pos,
    uvs: Float32Array.from(uvs),
    colors: Float32Array.from(colors),
    indices: index,
    normals: null
  };
}

function buildHem(samples, cols) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  function push(x, y, z) {
    positions.push(x, y, z);
    uvs.push(x / 0.0045, y / 0.0045);
    colors.push(0.8, 0.8, 0.8);
    return (positions.length / 3) - 1;
  }
  const row = samples[0];
  for (let j = 0; j < cols; j++) {
    const a = row[j];
    const b = row[j + 1];
    const i0 = push(a.x, a.y, a.frontZ);
    const i1 = push(b.x, b.y, b.frontZ);
    const i2 = push(a.x, a.y, a.backZ);
    const i3 = push(b.x, b.y, b.backZ);
    indices.push(i0, i2, i1, i1, i2, i3);
  }
  const pos = Float32Array.from(positions);
  const index = Uint32Array.from(indices);
  return { positions: pos, uvs: Float32Array.from(uvs), colors: Float32Array.from(colors), indices: index };
}

function withNormals(mesh) {
  if (!mesh.normals) {
    mesh.normals = computeNormalsSafe(mesh.positions, mesh.indices);
  }
  return mesh;
}

function computeNormalsSafe(positions, indices) {
  return importNormals(positions, indices);
}

import { computeNormals } from './mesh.mjs';
function importNormals(positions, indices) {
  return computeNormals(positions, indices);
}

function sleeveMesh(spec) {
  const rings = spec.rings || 36;
  const segs = spec.segs || 28;
  const a = spec.start;
  const b = spec.bend;
  const c = spec.end;
  let prevN = [0, 0, 1];
  const frames = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const p = quadBezier(a, b, c, t);
    const tangent = quadTangent(a, b, c, t);
    let n = [
      prevN[0] - tangent[0] * (prevN[0] * tangent[0] + prevN[1] * tangent[1] + prevN[2] * tangent[2]),
      prevN[1] - tangent[1] * (prevN[0] * tangent[0] + prevN[1] * tangent[1] + prevN[2] * tangent[2]),
      prevN[2] - tangent[2] * (prevN[0] * tangent[0] + prevN[1] * tangent[1] + prevN[2] * tangent[2])
    ];
    const nl = Math.hypot(n[0], n[1], n[2]);
    if (nl < 1e-4) n = [0, 1, 0];
    else n = [n[0] / nl, n[1] / nl, n[2] / nl];
    const bin = [
      tangent[1] * n[2] - tangent[2] * n[1],
      tangent[2] * n[0] - tangent[0] * n[2],
      tangent[0] * n[1] - tangent[1] * n[0]
    ];
    prevN = n;
    const radius = lerp(spec.r0, spec.r1, t);
    const rib = t > 0.9 ? 1 + (t - 0.9) * 1.8 : 1;
    frames.push({ p, n, bin, radius: radius * rib, t });
  }
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i <= rings; i++) {
    const f = frames[i];
    for (let j = 0; j <= segs; j++) {
      const ang = (j / segs) * Math.PI * 2;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const ridge = spec.rib && f.t > 0.88 ? Math.cos(ang * 12) * 0.0014 : 0;
      const flat = spec.flat || 0.55;
      const rx = f.radius + ridge;
      const rz = f.radius * flat + ridge;
      const x = f.p[0] + f.n[0] * cs * rx + f.bin[0] * sn * rz;
      const y = f.p[1] + f.n[1] * cs * rx + f.bin[1] * sn * rz;
      const z = f.p[2] + f.n[2] * cs * rx + f.bin[2] * sn * rz;
      const wob = wrinkle(x, y, 2.2) * 0.35 * (1 - f.t);
      positions.push(x, y + wob * 0.2, z + wob);
      uvs.push(x / 0.0045, y / 0.0045);
      const ao = 0.9 - (f.t < 0.15 ? 0.08 : 0);
      colors.push(ao, ao, ao);
    }
  }
  const stride = segs + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a0 = i * stride + j;
      const b0 = a0 + 1;
      const c0 = a0 + stride;
      const d0 = c0 + 1;
      indices.push(a0, c0, b0, b0, c0, d0);
    }
  }
  const pos = Float32Array.from(positions);
  const index = Uint32Array.from(indices);
  const nameAt = frames[Math.round(rings * 0.58)];
  const outward = vnorm([nameAt.p[0], 0, nameAt.p[2] * 0.35]);
  const namePos = vadd(nameAt.p, vmul(outward, nameAt.radius + 0.005));
  return {
    mesh: {
      positions: pos,
      uvs: Float32Array.from(uvs),
      colors: Float32Array.from(colors),
      indices: index,
      normals: computeNormals(pos, index)
    },
    namePos,
    nameNormal: outward
  };
}

function torusBand(opts) {
  const seg = opts.seg || 48;
  const tube = opts.tube || 16;
  return gridMesh(tube, seg, (v, u) => {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 2;
    const R = opts.rx;
    const rz = opts.rz || opts.rx;
    const tr = opts.tubeR * (1 + Math.cos(b * opts.ridges) * (opts.ridge || 0));
    const cx = Math.cos(a) * R;
    const cz = Math.sin(a) * rz;
    const radx = Math.cos(a);
    const radz = Math.sin(a);
    const x = cx + radx * Math.cos(b) * tr;
    const z = cz + radz * Math.cos(b) * tr;
    const y = opts.y + Math.sin(b) * tr;
    return [x, y, z];
  }, () => [0.92, 0.92, 0.92]);
}

function poloLeaf(side, neckY) {
  return gridMesh(14, 18, (v, u) => {
    const a = side * (0.05 + u * 1.35);
    const lift = Math.sin(v * Math.PI * 0.9) * 0.055;
    const out = v * 0.028;
    const R = 0.07 + out;
    const x = Math.sin(a) * R * 1.15;
    const z = Math.cos(a) * R * 0.78 + 0.012;
    const curl = v * v * 0.016;
    const y = neckY + 0.01 + lift * (0.35 + 0.65 * Math.sin(u * Math.PI)) - curl;
    return [x, y, z];
  }, (v) => {
    const a = 0.94 - v * 0.05;
    return [a, a, a];
  });
}

function placket(s) {
  const y0 = s.length * 0.52;
  const y1 = s.length * 0.90;
  const z = depthAt(0.7, s) * 0.52 + 0.004;
  return gridMesh(18, 4, (v, u) => {
    const x = (u - 0.5) * 0.022;
    const y = lerp(y0, y1, v);
    const raise = 0.0035 * (1 - Math.abs(u - 0.5) * 1.4);
    return [x, y, z + raise];
  });
}

function button(x, y, z, r) {
  return gridMesh(8, 10, (v, u) => {
    const a = u * Math.PI * 2;
    const b = (v - 0.5) * Math.PI;
    return [
      x + Math.cos(a) * Math.cos(b) * r,
      y + Math.sin(b) * r * 0.55,
      z + Math.sin(a) * Math.cos(b) * r
    ];
  });
}

function mockNeck(s) {
  const y0 = s.length * 0.78;
  const h = 0.058;
  const gap = 0.16;
  return gridMesh(16, 40, (v, u) => {
    const a = gap + u * (Math.PI * 2 - gap * 2);
    const rad = 0.066 - v * 0.004;
    const ridge = Math.cos(v * Math.PI * 10) * 0.0011;
    const x = Math.sin(a) * (rad + ridge);
    const z = Math.cos(a) * (rad + ridge) * 0.86;
    const y = y0 + v * h;
    return [x, y, z];
  });
}

function zipper(s) {
  const y0 = s.length * 0.62;
  const y1 = s.length * 0.94;
  const z = depthAt(0.75, s) * 0.52 + 0.006;
  return gridMesh(24, 2, (v, u) => {
    const x = (u - 0.5) * 0.006;
    const y = lerp(y0, y1, v);
    return [x, y, z];
  });
}

function frontPoint(s, t, x) {
  const yBase = s.length * t;
  const y = clampNeck(x, yBase, s);
  const z = depthAt(t, s) * 0.52 + 0.007;
  return [x, y, z];
}

function backPoint(s, t, x) {
  const y = clampNeck(x, s.length * t, s);
  const z = -depthAt(t, s) * 0.40 - 0.007;
  return [x, y, z];
}

function anchor(name, pos, normal, w, h, role) {
  return {
    name,
    translation: pos,
    rotation: quatFromZ(normal),
    size: [w, h],
    role
  };
}

function packTorso(label, torso) {
  const parts = [
    finalize(label + '_front', 'cloth', torso.front),
    finalize(label + '_back', 'cloth', torso.back),
    finalize(label + '_side', 'cloth', withNormals(torso.side)),
    finalize(label + '_hem', 'cloth', withNormals(torso.hem))
  ];
  return parts;
}

const TEE = {
  length: 0.74,
  hemHalf: 0.235,
  chestHalf: 0.25,
  waistPinch: 0.01,
  underHalf: 0.2,
  shoulderHalf: 0.19,
  shoulderDrop: 0.035,
  depth: 0.085,
  neckRx: 0.062,
  neckRy: 0.032,
  seed: 1.7
};

const POLO = {
  length: 0.72,
  hemHalf: 0.23,
  chestHalf: 0.248,
  waistPinch: 0.016,
  underHalf: 0.2,
  shoulderHalf: 0.18,
  shoulderDrop: 0.04,
  depth: 0.082,
  neckRx: 0.06,
  neckRy: 0.038,
  seed: 3.1
};

const QZIP = {
  length: 0.70,
  hemHalf: 0.228,
  chestHalf: 0.25,
  waistPinch: 0.018,
  underHalf: 0.2,
  shoulderHalf: 0.19,
  shoulderDrop: 0.04,
  depth: 0.09,
  neckRx: 0.058,
  neckRy: 0.032,
  seed: 5.4
};

function flatSleeve(side, s, long) {
  const rows = long ? 36 : 18;
  const cols = 20;
  const sign = side < 0 ? -1 : 1;
  const yTopIn = s.length * 0.9;
  const yBotIn = s.length * (long ? 0.7 : 0.72);
  const xIn = sign * Math.max(0.06, s.shoulderHalf * 0.45);
  const xOut = sign * (s.shoulderHalf + (long ? 0.22 : 0.13));
  const yTopOut = long ? s.length * 0.3 : s.length * 0.8;
  const yBotOut = long ? s.length * 0.08 : s.length * 0.66;
  function point(v, u, lift) {
    const x = lerp(xIn, xOut, u);
    const yTop = lerp(yTopIn, yTopOut, u);
    const yBot = lerp(yBotIn, yBotOut, u);
    const y = lerp(yBot, yTop, v) - u * u * (long ? 0.03 : 0.015);
    const hang = Math.sin(u * Math.PI) * (long ? 0.02 : 0.012);
    const z = 0.02 + lift + hang + wrinkle(x, y, 2.4) * 0.45;
    return [x, y, z];
  }
  const front = gridMesh(rows, cols, (v, u) => point(v, u, 0.012));
  const back = gridMesh(rows, cols, (v, u) => {
    const p = point(v, u, -0.012);
    p[2] = -Math.abs(p[2]) * 0.35 - 0.01;
    return p;
  }, null, true);
  const name = point(0.55, long ? 0.72 : 0.62, 0.02);
  return {
    front,
    back,
    namePos: [name[0], name[1], name[2] + 0.01],
    nameNormal: [sign, 0, 0.35]
  };
}

export function buildTee() {
  const s = TEE;
  const torso = buildTorso(s);
  const parts = packTorso('tee', torso);
  const left = flatSleeve(1, s, false);
  const right = flatSleeve(-1, s, false);
  parts.push(finalize('tee_sleeve_l', 'cloth', left.front));
  parts.push(finalize('tee_sleeve_l_b', 'cloth', left.back));
  parts.push(finalize('tee_sleeve_r', 'cloth', right.front));
  parts.push(finalize('tee_sleeve_r_b', 'cloth', right.back));
  parts.push(finalize('tee_collar', 'cloth', torusBand({
    y: s.length * 0.82, rx: s.neckRx * 0.95, rz: s.neckRx * 0.72, tubeR: 0.02, ridges: 0, seg: 48, tube: 12
  })));
  const logo = pickSurface(torso.samples, 0, s.length * 0.57, 'front');
  const emblem = pickSurface(torso.samples, 0, s.length * 0.78, 'back');
  return {
    parts,
    anchors: [
      anchor('logo', logo, [0, 0, 1], 0.16, 0.042, 'logo'),
      anchor('emblem', emblem, [0, 0, -1], 0.04, 0.04, 'emblem')
    ]
  };
}

export function buildPolo() {
  const s = POLO;
  const torso = buildTorso(s);
  const parts = packTorso('polo', torso);
  const left = flatSleeve(1, s, false);
  const right = flatSleeve(-1, s, false);
  parts.push(finalize('polo_sleeve_l', 'cloth', left.front));
  parts.push(finalize('polo_sleeve_l_b', 'cloth', left.back));
  parts.push(finalize('polo_sleeve_r', 'cloth', right.front));
  parts.push(finalize('polo_sleeve_r_b', 'cloth', right.back));
  const neckY = s.length * 0.90;
  parts.push(finalize('polo_leaf_l', 'cloth', poloLeaf(1, neckY)));
  parts.push(finalize('polo_leaf_r', 'cloth', poloLeaf(-1, neckY)));
  parts.push(finalize('polo_placket', 'cloth', placket(s)));
  const bz = depthAt(0.7, s) * 0.52 + 0.009;
  parts.push(finalize('polo_btn_1', 'cloth', button(0, s.length * 0.80, bz, 0.0055)));
  parts.push(finalize('polo_btn_2', 'cloth', button(0, s.length * 0.74, bz, 0.0055)));
  const logo = pickSurface(torso.samples, 0.09, s.length * 0.66, 'front');
  const emblem = pickSurface(torso.samples, 0, s.length * 0.78, 'back');
  return {
    parts,
    anchors: [
      anchor('logo', logo, [0, 0, 1], 0.072, 0.02, 'logo'),
      anchor('emblem', emblem, [0, 0, -1], 0.038, 0.038, 'emblem'),
      anchor('name', left.namePos, vnorm(left.nameNormal), 0.08, 0.018, 'name')
    ]
  };
}

export function buildQuarterZip() {
  const s = QZIP;
  const torso = buildTorso(s);
  const parts = packTorso('qzip', torso);
  const left = flatSleeve(1, s, true);
  const right = flatSleeve(-1, s, true);
  parts.push(finalize('qzip_sleeve_l', 'cloth', left.front));
  parts.push(finalize('qzip_sleeve_l_b', 'cloth', left.back));
  parts.push(finalize('qzip_sleeve_r', 'cloth', right.front));
  parts.push(finalize('qzip_sleeve_r_b', 'cloth', right.back));
  parts.push(finalize('qzip_collar', 'cloth', mockNeck(s)));
  parts.push(finalize('qzip_zip', 'metal', zipper(s)));
  const logo = pickSurface(torso.samples, 0.09, s.length * 0.64, 'front');
  const emblem = pickSurface(torso.samples, 0, s.length * 0.76, 'back');
  return {
    parts,
    anchors: [
      anchor('logo', logo, [0, 0, 1], 0.062, 0.018, 'logo'),
      anchor('emblem', emblem, [0, 0, -1], 0.036, 0.036, 'emblem'),
      anchor('name', left.namePos, vnorm(left.nameNormal), 0.07, 0.016, 'name')
    ]
  };
}

function pickSurface(samples, x, y, which) {
  let best = samples[0][0];
  let bestD = 1e9;
  for (const row of samples) {
    for (const p of row) {
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  const z = which === 'front' ? best.frontZ + 0.012 : best.backZ - 0.012;
  return [x, y, z];
}

function capPanel(p) {
  const panels = 6;
  const rows = 22;
  const cols = 8;
  const H = 0.112;
  const R = 0.086;
  const center = (p + 0.5) * (Math.PI * 2 / panels);
  // Panel 0 faces +Z (front). center of panel 0 = 0.
  const cAng = p * (Math.PI * 2 / panels);
  return gridMesh(rows, cols, (v, u) => {
    const spread = (Math.PI * 2 / panels) * 0.5;
    const a = cAng + (u - 0.5) * 2 * spread;
    const t = v;
    const edge = Math.min(u, 1 - u);
    const seam = 0.975 + 0.025 * smoothstep(edge / 0.22);
    const rad = Math.cos(t * Math.PI * 0.5) * R * seam;
    const y = Math.sin(t * Math.PI * 0.5) * H;
    const x = Math.sin(a) * rad;
    const z = Math.cos(a) * rad;
    return [x, y, z];
  }, (v, u) => {
    const edge = Math.min(u, 1 - u);
    const seam = 0.8 + 0.2 * smoothstep(edge / 0.18);
    return [seam, seam, seam];
  });
}

function capBrim() {
  const rows = 14;
  const cols = 28;
  const arc = 0.72;
  const len = 0.1;
  const baseR = 0.03;
  function point(v, u, lift) {
    const a = (u - 0.5) * 2 * arc;
    const L = v * len;
    const rad = baseR + L;
    const x = Math.sin(a) * rad;
    const z = Math.cos(a) * rad;
    const curve = -v * v * 0.03;
    const y = 0.07 - v * v * 0.035 + lift;
    return [x, y, z];
  }
  const top = gridMesh(rows, cols, (v, u) => point(v, u, 0.0032), null, true);
  const bottom = gridMesh(rows, cols, (v, u) => point(v, u, 0));
  // Flip bottom winding by reversing index order
  const flipped = new Uint32Array(bottom.indices.length);
  for (let i = 0; i < bottom.indices.length; i += 3) {
    flipped[i] = bottom.indices[i];
    flipped[i + 1] = bottom.indices[i + 2];
    flipped[i + 2] = bottom.indices[i + 1];
  }
  bottom.indices = flipped;
  bottom.normals = computeNormals(bottom.positions, bottom.indices);
  // Outer rim
  const rimPos = [];
  const rimUv = [];
  const rimCol = [];
  const rimIdx = [];
  function push(p) {
    rimPos.push(p[0], p[1], p[2]);
    rimUv.push(p[0] / 0.0045, p[1] / 0.0045);
    rimCol.push(0.9, 0.9, 0.9);
    return rimPos.length / 3 - 1;
  }
  for (let j = 0; j < cols; j++) {
    const u0 = j / cols;
    const u1 = (j + 1) / cols;
    const a = point(1, u0, 0.0032);
    const b = point(1, u1, 0.0032);
    const c = point(1, u0, 0);
    const d = point(1, u1, 0);
    const i0 = push(a); const i1 = push(b); const i2 = push(c); const i3 = push(d);
    rimIdx.push(i0, i2, i1, i1, i2, i3);
  }
  const rimPositions = Float32Array.from(rimPos);
  const rimIndices = Uint32Array.from(rimIdx);
  const rim = {
    positions: rimPositions,
    uvs: Float32Array.from(rimUv),
    colors: Float32Array.from(rimCol),
    indices: rimIndices,
    normals: computeNormals(rimPositions, rimIndices)
  };
  return { top, bottom, rim };
}

function capButton() {
  return gridMesh(8, 12, (v, u) => {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 0.5;
    const r = 0.009 * Math.cos(b);
    return [Math.cos(a) * r, 0.112 + Math.sin(b) * 0.009, Math.sin(a) * r];
  });
}

export function buildCap() {
  const parts = [];
  for (let p = 0; p < 6; p++) {
    parts.push(finalize('cap_panel_' + p, 'cloth', capPanel(p)));
  }
  const brim = capBrim();
  parts.push(finalize('cap_brim_top', 'cloth', brim.top));
  parts.push(finalize('cap_brim_bottom', 'cloth', brim.bottom));
  parts.push(finalize('cap_brim_rim', 'cloth', brim.rim));
  parts.push(finalize('cap_button', 'cloth', capButton()));
  parts.push(finalize('cap_band', 'cloth', torusBand({
    y: 0.012, rx: 0.086, rz: 0.086, tubeR: 0.006, ridges: 0, seg: 40, tube: 8
  })));
  const logoPos = [0, 0.072, 0.078];
  const emblemPos = [0, 0.07, -0.086];
  const namePos = [0.09, 0.045, 0.012];
  return {
    parts,
    anchors: [
      anchor('logo', logoPos, [0, 0.15, 1], 0.046, 0.014, 'logo'),
      anchor('emblem', emblemPos, [0, 0.1, -1], 0.022, 0.022, 'emblem'),
      anchor('name', namePos, [1, 0, 0.15], 0.04, 0.01, 'name')
    ]
  };
}
