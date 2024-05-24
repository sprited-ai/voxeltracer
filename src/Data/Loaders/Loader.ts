import VoxelScene from "../Models/VoxelScene";
import Context from "./Context";
import MagicaVoxelContext from "../MagicaVoxel/MagicaVoxelContext";

export default class Loader {

  private contexts: { [_: string]: Context }  = {
    'vox': new MagicaVoxelContext()
  }

  // private getPotentialDecoders(url: string, buffer: ArrayBuffer): Context[] {
  //   const contexts: Context[] = [];
  //   if (url.endsWith('.vox')) {
  //     contexts.push(this.contexts.vox);
  //   }
  //   return contexts;
  // }

  public loadBuffer(buffer: ArrayBuffer) {
    // For now, we only support one loader, and that's magicavoxel
    let contexts = [this.contexts.vox];

    if (!contexts.length) {
      throw "Was unable to find a context for the file.";
    }

    let scene: VoxelScene | null = null;
    for (let i = 0; i < contexts.length; ++i) {
      const context = contexts[i];
      scene = context.parseScene(buffer);
      if (scene) {
        break;
      }
    }

    if (!scene) {
      throw "Unable to read the file.";
    }

    return scene;
  }

  public loadFile(file: File): Promise<VoxelScene> {
    const self = this;
    return new Promise(resolve => {
      const fileReader = new FileReader();
      fileReader.onload = function(e) {
        const buffer = fileReader.result as ArrayBuffer;
        let result: VoxelScene | null = null;
        try {
          result = self.loadBuffer(buffer);
        } catch (e) {
          alert(e);
          return;
        }
        resolve(result);
      }
      fileReader.readAsArrayBuffer(file);
    });
  }

  public load(src: string | File): Promise<VoxelScene> {
    if (typeof src === "string") {
      return this.loadUrl(src);
    }
    else {
      return this.loadFile(src);
    }
  }

  public async loadUrl(url: string): Promise<VoxelScene> {
    const request = new Request(url);
    
    // , {
      // Probably not needed. Removing.
      // headers: new Headers({'Content-Type': 'application/octet-stream'})
    // });

    const response = await fetch(request);
  
    if (!response.ok) {
      throw Error(`Unable to download, server returned ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return this.loadBuffer(buffer);
  }
}
