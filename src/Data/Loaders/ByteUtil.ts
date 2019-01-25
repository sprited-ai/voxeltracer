/**
 * Bytes to String
 * Code is from Stack Overflow answer
 * https://stackoverflow.com/a/3195961
 */
export function b2s(typedArray: Uint8Array): string {
  const len = typedArray.length;
  const arr = new Array(typedArray.length);
  for (let i = 0; i < len; ++i) {
    arr[i] = typedArray[i];
  }
  return String.fromCharCode.apply(String, arr);
}

export function uint8(buffer: ArrayBuffer, byteOffset: number, length: number): Uint8Array {
  return new Uint8Array(buffer, byteOffset, length);
}

export function uint32(buffer: ArrayBuffer, byteOffset: number, length: number): Uint32Array {
  return new Uint32Array(buffer, byteOffset, length);
}

export function int32(buffer: ArrayBuffer, byteOffset: number, length: number): Int32Array {
  return new Int32Array(buffer, byteOffset, length);
}

export function float32(buffer: ArrayBuffer, byteOffset: number, length: number): Float32Array {
  return new Float32Array(buffer, byteOffset, length);
}

export function readStr(buffer: ArrayBuffer, byteOffset: number, length: number) {
  return b2s(uint8(buffer, byteOffset, length));
}

export function readInt(buffer: ArrayBuffer, byteOffset: number) {
  return int32(buffer, byteOffset, 1)[0];
}

export function readUint(buffer: ArrayBuffer, byteOffset: number) {
  return uint32(buffer, byteOffset, 1)[0];
}

export function readFloat(buffer: ArrayBuffer, byteOffset: number) {
  return float32(buffer, byteOffset, 1)[0];
}
