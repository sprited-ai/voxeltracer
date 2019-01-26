/**
 * Bytes to String
 * Code is from Stack Overflow answer
 * https://stackoverflow.com/a/3195961
 */
export function b2s(typedArray: Uint8Array): string {
  // @ts-ignore
  return String.fromCharCode.apply(String, typedArray);
}

export function uint8(buffer: ArrayBuffer, byteOffset: number, length: number): Uint8Array {
  return new Uint8Array(buffer, byteOffset, length);
}

// TODO: Phase out
// export function uint32(buffer: ArrayBuffer, byteOffset: number, length: number): Uint32Array {
//   return new Uint32Array(buffer, byteOffset, length);
// }

// TODO: Phase out
// export function int32(buffer: ArrayBuffer, byteOffset: number, length: number): Int32Array {
//   return new Int32Array(buffer, byteOffset, length);
// }

// TODO: Phase out
// export function float32(buffer: ArrayBuffer, byteOffset: number, length: number): Float32Array {
//   return new Float32Array(buffer, byteOffset, length);
// }

export function readStr(buffer: ArrayBuffer, byteOffset: number, length: number) {
  return b2s(uint8(buffer, byteOffset, length));
}

export function readInt(buffer: ArrayBuffer, byteOffset: number) {
  return (new DataView(buffer, byteOffset, 4)).getInt32(0, true);
}

export function readUint(buffer: ArrayBuffer, byteOffset: number) {
  return (new DataView(buffer, byteOffset, 4)).getUint32(0, true);
}

export function readFloat(buffer: ArrayBuffer, byteOffset: number) {
  return (new DataView(buffer, byteOffset, 4)).getFloat32(0, true);
}
