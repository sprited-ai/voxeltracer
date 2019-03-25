import { Matrix4 } from "three";

export default interface ShapeHash {
  modelIndex: number;
  transform: number[];
  size: number[],
  pos: number[],
  byteOffset: number
}
