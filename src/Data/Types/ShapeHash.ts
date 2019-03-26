import { Matrix4 } from "three";

export default interface ShapeHash {
  modelIndex: number;
  rotation: number[],
  translation: number[],
  size: number[],
  pos: number[],
  byteOffset: number
}
