// Re-writes a single-model .vox file's scene graph to instance model 0 on a
// cols x rows grid. The model/palette/material chunks are kept verbatim;
// only the node graph is replaced — instancing via multiple nSHP references
// to the same model, so the file barely grows.
//
// Usage: node scripts/remix-vox.mjs [input.vox] [cols] [rows] [gap] [output.vox]
import { readFileSync, writeFileSync } from 'node:fs';
import { chunk, ntrnChunk, ngrpChunk, nshpChunk } from './voxBuilder.mjs';

const [
  input = 'public/vox/pink_mini_store.vox',
  cols = '2',
  rows = '2',
  gap = '8',
  output = 'public/vox/generated/ministore_2x2.vox',
] = process.argv.slice(2);

const buf = readFileSync(input);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);

if (buf.slice(0, 4).toString() !== 'VOX ') throw new Error(`${input} is not a .vox file`);

// Walk MAIN's children, keeping raw chunk bytes by id.
let off = 8;
const mainContentLen = dv.getInt32(off + 4, true);
const mainChildrenLen = dv.getInt32(off + 8, true);
off += 12 + mainContentLen;
const end = off + mainChildrenLen;

const kept = []; // SIZE/XYZI/RGBA/MATL chunks, verbatim
let modelSize = null;
let modelCount = 0;
while (off < end) {
  const id = buf.slice(off, off + 4).toString();
  const contentLen = dv.getInt32(off + 4, true);
  const childrenLen = dv.getInt32(off + 8, true);
  const total = 12 + contentLen + childrenLen;
  if (id === 'SIZE') {
    modelCount++;
    modelSize = [dv.getInt32(off + 12, true), dv.getInt32(off + 16, true), dv.getInt32(off + 20, true)];
  }
  if (id === 'SIZE' || id === 'XYZI' || id === 'RGBA' || id === 'MATL') {
    kept.push(new Uint8Array(buf.buffer, buf.byteOffset + off, total));
  }
  off += total;
}

if (modelCount !== 1) throw new Error(`Expected a single-model file, found ${modelCount} models`);

// New scene graph: root nTRN -> nGRP -> (nTRN -> nSHP) per grid cell, all
// referencing model 0. Translations position model centers; z keeps the
// model bottom on the ground.
const [sx, sy, sz] = modelSize;
const nCols = parseInt(cols, 10);
const nRows = parseInt(rows, 10);
const pitchX = sx + parseInt(gap, 10);
const pitchY = sy + parseInt(gap, 10);
const graph = [];
const groupChildIds = [];
let nodeId = 2;
const instances = [];
for (let r = 0; r < nRows; r++) {
  for (let c = 0; c < nCols; c++) {
    const tx = Math.round((c - (nCols - 1) / 2) * pitchX);
    const ty = Math.round((r - (nRows - 1) / 2) * pitchY);
    instances.push([tx, ty, Math.ceil(sz / 2)]);
  }
}
for (const t of instances) {
  groupChildIds.push(nodeId);
  graph.push(ntrnChunk(nodeId, nodeId + 1, { translation: t }), nshpChunk(nodeId + 1, 0));
  nodeId += 2;
}
const graphChunks = [ntrnChunk(0, 1), ngrpChunk(1, groupChildIds), ...graph];

// Assemble
function concat(arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
const children = concat([...kept.filter(isId('SIZE', 'XYZI')), ...graphChunks, ...kept.filter(isId('RGBA', 'MATL'))]);
const header = new Uint8Array(8);
header.set([0x56, 0x4f, 0x58, 0x20]); // "VOX "
new DataView(header.buffer).setInt32(4, 150, true);
const file = concat([header, chunk('MAIN', new Uint8Array(0), children)]);
writeFileSync(output, file);
console.log(`${output}: ${(file.length / 1024).toFixed(1)} KB — ${instances.length} instances of ${sx}x${sy}x${sz}`);

function isId(...ids) {
  return (bytes) => ids.includes(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]));
}
