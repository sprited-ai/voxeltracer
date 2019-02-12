import Material from "./Material";

export default class MetallicMaterial extends Material{
  weight: number;
  roughness: number;
  specular: number;
  plastic: boolean;
  constructor (weight: number, roughness: number, specular: number, plastic: boolean) {
    super();
    this.weight = weight;
    this.roughness = roughness;
    this.specular = specular;
    this.plastic = plastic;
  }
}
