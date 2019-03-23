import { Matrix4 } from "three";

export default class Obj {

  static nullObj: Obj = new Obj('', new Matrix4(), -1, false, undefined);

  name: string;
  hidden: boolean;
  transform: Matrix4;
  children: Obj[] | undefined;
  modelIndex: number;

  constructor(name: string, transform: Matrix4, modelIndex: number, hidden: boolean, children: Obj[] | undefined) {
    this.name = name;
    this.transform = transform;
    this.modelIndex = modelIndex;
    this.hidden = hidden;
    this.children = children;
  }
}
