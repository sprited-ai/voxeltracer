import { Vector4, Color } from "three";

export default class Material {
  color: Vector4;
  constructor (color: Vector4 = new Vector4()) {
    this.color = color;
  }
  toHash() {
    return {
      color: this.color.toArray()
    };
  }
}
