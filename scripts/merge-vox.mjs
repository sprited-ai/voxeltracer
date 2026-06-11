// Merges two .vox files into one scene, juxtaposing their models along x.
// The hard part is palette/material identity: file B's used palette indices
// are remapped into slots file A doesn't use, its XYZI voxel bytes are
// rewritten, and its MATL chunks follow the same remap. Lossless as long as
// usedColors(A) + usedColors(B) <= 255.
//
// Usage: node scripts/merge-vox.mjs <a.vox> <b.vox> <output.vox> [gap]
import { readFileSync, writeFileSync } from 'node:fs';
import { chunk, ntrnChunk, ngrpChunk, nshpChunk } from './voxBuilder.mjs';

const [inputA, inputB, output, gapArg = '12'] = process.argv.slice(2);
if (!inputA || !inputB || !output) {
  console.error('Usage: node scripts/merge-vox.mjs <a.vox> <b.vox> <output.vox> [gap]');
  process.exit(1);
}
const gap = parseInt(gapArg, 10);

function parseVox(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
  if (buf.slice(0, 4).toString() !== 'VOX ') throw new Error(`${path} is not a .vox file`);
  let off = 8;
  const mainContentLen = dv.getInt32(off + 4, true);
  const mainChildrenLen = dv.getInt32(off + 8, true);
  off += 12 + mainContentLen;
  const end = off + mainChildrenLen;

  const models = []; // { size: [x,y,z], xyzi: Uint8Array (voxel records, no count) }
  let palette = null; // Uint8Array(1024)
  const matls = []; // { id, dictBytes: Uint8Array }
  let pendingSize = null;

  while (off < end) {
    const id = buf.slice(off, off + 4).toString();
    const contentLen = dv.getInt32(off + 4, true);
    const childrenLen = dv.getInt32(off + 8, true);
    const contentOff = off + 12;
    if (id === 'SIZE') {
      pendingSize = [
        dv.getInt32(contentOff, true),
        dv.getInt32(contentOff + 4, true),
        dv.getInt32(contentOff + 8, true),
      ];
    } else if (id === 'XYZI') {
      const numVoxels = dv.getInt32(contentOff, true);
      const records = new Uint8Array(buf.buffer, buf.byteOffset + contentOff + 4, numVoxels * 4);
      models.push({ size: pendingSize, xyzi: new Uint8Array(records) });
    } else if (id === 'RGBA') {
      palette = new Uint8Array(buf.buffer, buf.byteOffset + contentOff, 1024).slice();
    } else if (id === 'MATL') {
      const matlId = dv.getInt32(contentOff, true);
      matls.push({
        id: matlId,
        dictBytes: new Uint8Array(buf.buffer, buf.byteOffset + contentOff + 4, contentLen - 4).slice(),
      });
    }
    off += 12 + contentLen + childrenLen;
  }
  if (!palette) throw new Error(`${path} has no RGBA palette chunk (legacy default-palette merge not supported)`);
  return { models, palette, matls };
}

function usedIndices(models) {
  const used = new Set();
  for (const m of models) {
    for (let i = 3; i < m.xyzi.length; i += 4) used.add(m.xyzi[i]);
  }
  return used;
}

const A = parseVox(inputA);
const B = parseVox(inputB);

// --- palette remap for B
const usedA = usedIndices(A.models);
const usedB = usedIndices(B.models);
const freeSlots = [];
for (let i = 1; i <= 255; i++) if (!usedA.has(i)) freeSlots.push(i);
if (usedB.size > freeSlots.length) {
  throw new Error(`Not enough free palette slots: A uses ${usedA.size}, B needs ${usedB.size}, free ${freeSlots.length}`);
}
const remap = new Map(); // B index -> merged index
const mergedPalette = A.palette.slice();
let slot = 0;
for (const bIndex of [...usedB].sort((a, b) => a - b)) {
  const target = freeSlots[slot++];
  remap.set(bIndex, target);
  // RGBA chunk entry i corresponds to palette index i + 1
  mergedPalette.set(B.palette.subarray((bIndex - 1) * 4, bIndex * 4), (target - 1) * 4);
}

// rewrite B voxel records
const remappedBModels = B.models.map((m) => {
  const xyzi = m.xyzi.slice();
  for (let i = 3; i < xyzi.length; i += 4) xyzi[i] = remap.get(xyzi[i]);
  return { size: m.size, xyzi };
});

// remap B materials (only those attached to used indices survive)
const i32 = (n) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, n, true);
  return out;
};
const concat = (arrays) => {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};
const matlChunks = [];
for (const { id, dictBytes } of A.matls) {
  if (usedA.has(id)) matlChunks.push(chunk('MATL', concat([i32(id), dictBytes])));
}
for (const { id, dictBytes } of B.matls) {
  if (remap.has(id)) matlChunks.push(chunk('MATL', concat([i32(remap.get(id)), dictBytes])));
}

// --- assemble: all models in a row along x (A's then B's)
const allModels = [...A.models, ...remappedBModels];
const totalWidth = allModels.reduce((w, m) => w + m.size[0], 0) + gap * (allModels.length - 1);
let cursor = -Math.round(totalWidth / 2);
const translations = allModels.map((m) => {
  const t = [cursor + Math.round(m.size[0] / 2), 0, Math.ceil(m.size[2] / 2)];
  cursor += m.size[0] + gap;
  return t;
});

const parts = [];
for (const m of allModels) {
  parts.push(chunk('SIZE', concat([i32(m.size[0]), i32(m.size[1]), i32(m.size[2])])));
  parts.push(chunk('XYZI', concat([i32(m.xyzi.length / 4), m.xyzi])));
}
const groupChildIds = allModels.map((_, i) => 2 + i * 2);
parts.push(ntrnChunk(0, 1), ngrpChunk(1, groupChildIds));
allModels.forEach((_, i) => {
  parts.push(ntrnChunk(2 + i * 2, 3 + i * 2, { translation: translations[i] }), nshpChunk(3 + i * 2, 0 + i));
});
parts.push(chunk('RGBA', mergedPalette), ...matlChunks);

const header = new Uint8Array(8);
header.set([0x56, 0x4f, 0x58, 0x20]);
new DataView(header.buffer).setInt32(4, 150, true);
const file = concat([header, chunk('MAIN', new Uint8Array(0), concat(parts))]);
writeFileSync(output, file);
console.log(
  `${output}: ${(file.length / 1024).toFixed(1)} KB — ${A.models.length}+${B.models.length} models, ` +
    `B palette remapped (${usedB.size} colors into ${freeSlots.length} free slots)`
);
