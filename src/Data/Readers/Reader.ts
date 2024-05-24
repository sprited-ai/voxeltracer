import { uint8, b2s } from "./ByteUtil";

export default class Reader {
  protected byteOffset: number = 0;
  protected buffer: ArrayBuffer;

  constructor(buffer:ArrayBuffer) {
    this.buffer = buffer;
  }

  skip(byteLength: number) {
    this.byteOffset += byteLength;
  }

  peekStr(byteLength: number): string {
    return b2s(uint8(this.buffer, this.byteOffset, byteLength));
  }

  readInt(): number {
    const result = (new DataView(this.buffer, this.byteOffset, 4)).getInt32(0, true);
    this.byteOffset += 4;
    return result;
  }
  
  readUint(): number {
    const result = (new DataView(this.buffer, this.byteOffset, 4)).getUint32(0, true);
    this.byteOffset += 4;
    return result;
  }

  readFloat(): number {
    const result = (new DataView(this.buffer, this.byteOffset, 4)).getFloat32(0, true);
    this.byteOffset += 4;
    return result;
  }

  readStr(byteLength: number): string {
    const result = b2s(uint8(this.buffer, this.byteOffset, byteLength));
    this.byteOffset += byteLength;
    return result;
  }

  readBytes(byteLength: number): Uint8Array {
    const result = new Uint8Array(this.buffer, this.byteOffset, byteLength);
    this.byteOffset += byteLength;
    return result;
  }
}
