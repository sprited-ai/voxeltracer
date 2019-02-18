import Material from "../Materials/Material";
import ndarray from "ndarray";
import DiffuseMaterial from "../Materials/DiffuseMaterial";
import MetallicMaterial from "../Materials/MetallicMaterial";
import MaterialType from "../../Enums/MaterialType";
import GlassMaterial from "../Materials/GlassMaterial";
import EmmissiveMaterial from "../Materials/EmissiveMaterial";

export default class MaterialArray {
  private array: Material[];
  public materialTexture: ndarray
  public constructor() {
    this.array = new Array(256);
    this.materialTexture = ndarray(new Uint8Array(256 * 4), [16, 16, 4]);
  }
  public setAt(index: number, material: Material) {
    this.array[index] = material;

    // Metallic
    // TODO: We are currently ignoring `plastic` bit for now.
    if (material instanceof MetallicMaterial) {
      const typeByte = MaterialType.METAL;
      const weightByte = Math.round(material.weight * 255);
      const roughnessByte = Math.round(material.roughness * 255);
      const specularByte = Math.round(material.specular * 255);
      this.setTexel(index, typeByte, weightByte, roughnessByte, specularByte);
    }
    // Glass
    // TODO: We are currently ignoring `attenuation` value for now.
    else if (material instanceof GlassMaterial) {
      const typeByte = MaterialType.GLASS;
      const weightByte = Math.round(material.weight * 255);
      const roughnessByte = Math.round(material.roughness * 255);
      const refractionByte = Math.round(material.refraction * 255);
      this.setTexel(index, typeByte, weightByte, roughnessByte, refractionByte);
    }
    // Emmission
    // TODO: We are currently ignoring `unit` bit for now.
    else if (material instanceof EmmissiveMaterial) {
      const typeByte = MaterialType.EMISSIVE;
      const weightByte = Math.round(material.weight * 255);
      const fluxByte = Math.round(material.flux * 255);
      const glowByte = Math.round(material.glow * 255);
      this.setTexel(index, typeByte, weightByte, fluxByte, glowByte);
    }
    // Diffuse (default)
    else {
      const typeByte = MaterialType.DIFFUSE;
      this.setTexel(index, typeByte, 0, 0, 0);
    }
  }
  private setTexel(index: number, r: number, g: number, b: number, a: number) {
    // Indicies
    const i = index % 16;
    const j = Math.floor(index / 16);
    this.materialTexture.set(i, j, 0, r);
    this.materialTexture.set(i, j, 1, g);
    this.materialTexture.set(i, j, 2, b);
    this.materialTexture.set(i, j, 3, a);
  }
}
