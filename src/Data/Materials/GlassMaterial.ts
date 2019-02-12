import Material from "./Material";

export default class GlassMaterial extends Material{
  weight: number;
  roughness: number;
  refraction: number;
  attenuation: number;
  constructor (weight: number, roughness: number, refraction: number, attenuation: number) {
    super();
    this.weight = weight;
    this.roughness = roughness;
    this.refraction = refraction;
    this.attenuation = attenuation;
  }
}
