import Material from "./Material";

export default class EmmissiveMaterial extends Material{
  weight: number;
  flux: number;
  glow: number;
  constructor (weight: number, flux: number, glow: number) {
    super();
    this.weight = weight;
    this.flux = flux;
    this.glow = glow;
  }
}
