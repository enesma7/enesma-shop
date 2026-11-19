/** Small mesh helpers for the shop garment builder. No dependencies. */

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function fract(n) {
  return n - Math.floor(n);
}

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

export function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x, y) {
  return noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.15;
}

export function wrinkle(x, y, seed) {
  const n = fbm(x * 6.5 + seed, y * 4.2 + seed * 0.3);
  const fold = Math.sin(x * 22 + y * 3.1 + seed) * Math.sin(y * 13 + seed);
  return (n - 0.5) * 0.010 + fold * 0.0035;
}

export function vadd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function vsub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function vmul(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function vdot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function vcross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
export function vlen(a) {
  return Math.hypot(a[0], a[1], a[2]);
}
export function vnorm(a) {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Quaternion x,y,z,w rotating +Z onto the unit normal n. */
export function quatFromZ(n) {
  const z = [0, 0, 1];
  const c = clamp(vdot(z, n), -1, 1);
  if (c > 0.99999) return [0, 0, 0, 1];
  if (c < -0.99999) return [0, 1, 0, 0];
  const axis = vnorm(vcross(z, n));
  const s = Math.sqrt((1 + c) * 2);
  const inv = 1 / s;
  return [axis[0] * inv, axis[1] * inv, axis[2] * inv, s * 0.5];
}

export function computeNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const abx = positions[ib] - positions[ia];
    const aby = positions[ib + 1] - positions[ia + 1];
    const abz = positions[ib + 2] - positions[ia + 2];
    const acx = positions[ic] - positions[ia];
    const acy = positions[ic + 1] - positions[ia + 1];
    const acz = positions[ic + 2] - positions[ia + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    n[ia] += nx; n[ia + 1] += ny; n[ia + 2] += nz;
    n[ib] += nx; n[ib + 1] += ny; n[ib + 2] += nz;
    n[ic] += nx; n[ic + 1] += ny; n[ic + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (l < 1e-8) {
      n[i] = 0; n[i + 1] = 0; n[i + 2] = 1;
    } else {
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
  }
  return n;
}

function dist3(positions, ia, ib) {
  const a = ia * 3;
  const b = ib * 3;
  return Math.hypot(positions[a] - positions[b], positions[a + 1] - positions[b + 1], positions[a + 2] - positions[b + 2]);
}

/**
 * Build a grid surface. posFn(v, u) -> [x,y,z] with v,u in 0..1.
 * colorFn(v, u, p) -> [r,g,b] optional.
 */
export function gridMesh(rows, cols, posFn, colorFn, flip) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const stride = cols + 1;
  for (let i = 0; i <= rows; i++) {
    const v = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const p = posFn(v, u);
      positions.push(p[0], p[1], p[2]);
      uvs.push(p[0] / 0.0045, p[1] / 0.0045);
      const c = colorFn ? colorFn(v, u, p) : [1, 1, 1];
      colors.push(c[0], c[1], c[2]);
    }
  }
  const indices = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      if (dist3(positions, a, b) < 1e-5 || dist3(positions, a, c) < 1e-5 || dist3(positions, b, d) < 1e-5) continue;
      if (flip) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const pos = Float32Array.from(positions);
  const index = Uint32Array.from(indices);
  return {
    positions: pos,
    uvs: Float32Array.from(uvs),
    colors: Float32Array.from(colors),
    indices: index,
    normals: computeNormals(pos, index)
  };
}

export function finalize(name, role, mesh) {
  return {
    name,
    role,
    positions: mesh.positions,
    normals: mesh.normals,
    uvs: mesh.uvs,
    colors: mesh.colors,
    indices: mesh.indices
  };
}

export function quadBezier(a, b, c, t) {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
    u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]
  ];
}

export function quadTangent(a, b, c, t) {
  const u = 1 - t;
  return vnorm([
    2 * u * (b[0] - a[0]) + 2 * t * (c[0] - b[0]),
    2 * u * (b[1] - a[1]) + 2 * t * (c[1] - b[1]),
    2 * u * (b[2] - a[2]) + 2 * t * (c[2] - b[2])
  ]);
}
