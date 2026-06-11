export interface VoxModel {
  size: [number, number, number];
  voxels: Array<[number, number, number, number]>;
}

export interface BuildVoxOptions {
  models: VoxModel[];
  translations?: Array<[number, number, number] | undefined>;
  palette?: Array<[number, number, number, number]>;
  materials?: Array<[number, Record<string, string>]>;
  sceneGraph?: boolean;
}

export function chunk(id: string, content?: Uint8Array, children?: Uint8Array): Uint8Array;
export function sizeChunk(x: number, y: number, z: number): Uint8Array;
export function xyziChunk(voxels: Array<[number, number, number, number]>): Uint8Array;
export function rgbaChunk(colors: Array<[number, number, number, number]>): Uint8Array;
export function ntrnChunk(
  nodeId: number,
  childNodeId: number,
  options?: {
    translation?: [number, number, number];
    rotation?: number;
    layerId?: number;
    name?: string;
    hidden?: boolean;
  }
): Uint8Array;
export function ngrpChunk(nodeId: number, childNodeIds: number[]): Uint8Array;
export function nshpChunk(nodeId: number, modelId: number): Uint8Array;
export function matlChunk(materialId: number, dictObj: Record<string, string>): Uint8Array;
export function buildVox(options: BuildVoxOptions): Uint8Array<ArrayBuffer>;
