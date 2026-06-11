// Builds MagicaVoxel .vox byte buffers (VOX version 150).
// Shared by unit tests (src/Data/MagicaVoxel/*.test.ts) and scripts/generate-vox.mjs.
// Format reference: https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt

function str(s) {
  return new TextEncoder().encode(s);
}

function i32(...nums) {
  const buf = new ArrayBuffer(nums.length * 4);
  const view = new DataView(buf);
  nums.forEach((n, i) => view.setInt32(i * 4, n, true));
  return new Uint8Array(buf);
}

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function dict(obj = {}) {
  const entries = Object.entries(obj);
  const parts = [i32(entries.length)];
  for (const [k, v] of entries) {
    const kb = str(k);
    const vb = str(String(v));
    parts.push(i32(kb.length), kb, i32(vb.length), vb);
  }
  return concat(...parts);
}

export function chunk(id, content = new Uint8Array(0), children = new Uint8Array(0)) {
  return concat(str(id), i32(content.length, children.length), content, children);
}

export function sizeChunk(x, y, z) {
  return chunk('SIZE', i32(x, y, z));
}

/** voxels: array of [x, y, z, paletteIndex] */
export function xyziChunk(voxels) {
  const data = new Uint8Array(4 + voxels.length * 4);
  new DataView(data.buffer).setInt32(0, voxels.length, true);
  voxels.forEach((v, t) => data.set(v, 4 + t * 4));
  return chunk('XYZI', data);
}

/** colors: array of [r, g, b, a]; entry i becomes palette index i + 1 */
export function rgbaChunk(colors) {
  const data = new Uint8Array(256 * 4);
  colors.forEach((c, i) => data.set(c, i * 4));
  return chunk('RGBA', data);
}

export function ntrnChunk(nodeId, childNodeId, { translation, rotation, layerId = 0, name, hidden } = {}) {
  const frame = {};
  if (translation) frame._t = translation.join(' ');
  if (rotation !== undefined) frame._r = rotation;
  const attrs = {};
  if (name) attrs._name = name;
  if (hidden) attrs._hidden = '1';
  return chunk('nTRN', concat(i32(nodeId), dict(attrs), i32(childNodeId, -1, layerId, 1), dict(frame)));
}

export function ngrpChunk(nodeId, childNodeIds) {
  return chunk('nGRP', concat(i32(nodeId), dict(), i32(childNodeIds.length, ...childNodeIds)));
}

export function nshpChunk(nodeId, modelId) {
  return chunk('nSHP', concat(i32(nodeId), dict(), i32(1, modelId), dict()));
}

/** dictObj example: { _type: '_metal', _metal: '0.8', _rough: '0.2', _spec: '0.5' } */
export function matlChunk(materialId, dictObj) {
  return chunk('MATL', concat(i32(materialId), dict(dictObj)));
}

/**
 * Assemble a complete .vox file.
 *
 * models:       [{ size: [x, y, z], voxels: [[x, y, z, paletteIndex], ...] }]
 * translations: optional per-model [x, y, z] in MagicaVoxel coordinates
 * palette:      optional array of [r, g, b, a] (entry i = palette index i + 1)
 * materials:    optional array of [materialId, dictObj]
 *
 * A scene graph (root nTRN -> nGRP -> per-model nTRN -> nSHP) is always
 * emitted because the parser requires one.
 */
export function buildVox({ models, translations, palette, materials }) {
  const parts = [];
  models.forEach((m) => {
    parts.push(sizeChunk(...m.size), xyziChunk(m.voxels));
  });
  const groupChildIds = models.map((_, i) => 2 + i * 2);
  parts.push(ntrnChunk(0, 1), ngrpChunk(1, groupChildIds));
  models.forEach((_, i) => {
    const t = translations && translations[i];
    parts.push(ntrnChunk(2 + i * 2, 3 + i * 2, { translation: t }), nshpChunk(3 + i * 2, i));
  });
  if (palette) parts.push(rgbaChunk(palette));
  if (materials) {
    for (const [id, d] of materials) parts.push(matlChunk(id, d));
  }
  const children = concat(...parts);
  return concat(str('VOX '), i32(150), chunk('MAIN', new Uint8Array(0), children));
}
