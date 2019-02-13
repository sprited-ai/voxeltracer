import Material from "./Material";

export default class MetallicMaterial extends Material{
  weight: number;
  roughness: number;
  specular: number;
  plastic: boolean;
  constructor(weight: number, roughness: number, specular: number, plastic: boolean) {
    super();
    this.weight = weight || 0;
    this.roughness = roughness || 0;
    this.specular = specular || 0;
    this.plastic = plastic || false;
  }
}
