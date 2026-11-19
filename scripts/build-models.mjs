/**
 * Write compressed garment GLBs used by the closet and by the still renderer.
 * Run: node scripts/build-models.mjs
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { dedup } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';
import { buildTee, buildPolo, buildQuarterZip, buildCap } from './garments.mjs';

const outDir = path.join(process.cwd(), 'models');
fs.mkdirSync(outDir, { recursive: true });

function buildDoc(garment) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const root = doc.createNode('garment');
  const scene = doc.createScene('closet');
  scene.addChild(root);
  doc.getRoot().setDefaultScene(scene);

  for (const part of garment.parts) {
    if (!part.indices.length) continue;
    const pos = doc.createAccessor().setType('VEC3').setArray(part.positions).setBuffer(buffer);
    const nrm = doc.createAccessor().setType('VEC3').setArray(part.normals).setBuffer(buffer);
    const uv = doc.createAccessor().setType('VEC2').setArray(part.uvs).setBuffer(buffer);
    const col = doc.createAccessor().setType('VEC3').setArray(part.colors).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(part.indices).setBuffer(buffer);
    const mat = doc.createMaterial(part.role)
      .setRoughnessFactor(part.role === 'metal' ? 0.32 : 0.78)
      .setMetallicFactor(part.role === 'metal' ? 0.9 : 0)
      .setBaseColorFactor(part.role === 'metal' ? [0.78, 0.79, 0.82, 1] : [0.86, 0.86, 0.86, 1])
      .setDoubleSided(false);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', pos)
      .setAttribute('NORMAL', nrm)
      .setAttribute('TEXCOORD_0', uv)
      .setAttribute('COLOR_0', col)
      .setIndices(idx)
      .setMaterial(mat);
    const mesh = doc.createMesh(part.name).addPrimitive(prim);
    root.addChild(doc.createNode(part.name).setMesh(mesh));
  }

  for (const a of garment.anchors) {
    const node = doc.createNode(a.name)
      .setTranslation(a.translation)
      .setRotation(a.rotation);
    node.setExtras({
      anchor: true,
      role: a.role,
      width: a.size[0],
      height: a.size[1]
    });
    root.addChild(node);
  }
  return doc;
}

const jobs = [
  ['t-shirt', buildTee()],
  ['polo', buildPolo()],
  ['quarter-zip', buildQuarterZip()],
  ['cap', buildCap()]
];

const io = new NodeIO();
for (const [name, garment] of jobs) {
  const doc = buildDoc(garment);
  await doc.transform(dedup());
  const file = path.join(outDir, name + '.glb');
  await io.write(file, doc);
  const tris = garment.parts.reduce((n, p) => n + p.indices.length / 3, 0);
  const bytes = fs.statSync(file).size;
  console.log(name, Math.round(tris), 'tris', (bytes / 1024).toFixed(1) + ' KB');
}
