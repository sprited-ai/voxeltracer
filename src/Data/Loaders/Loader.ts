import VoxelScene from "../Models/VoxelScene";
import VoxelArt from "../Models/VoxelArt";
import Material from "../Models/Material";
import MaterialArray from "../Arrays/MaterialArray";
import MagicaVoxelContext from "./MagicaVoxelContext";
import Context from "./Context";

export default class Loader {

  private decoders: { [_: string]: Context }  = {
    'vox': new MagicaVoxelContext()
  }

  private getPotentialDecoders(url: string, buffer: ArrayBuffer): Context[] {
    const decoders: Context[] = [];
    if (url.endsWith('.vox')) {
      decoders.push(this.decoders.vox);
    }
    return decoders;
  }

  public loadUrl(url: string): Promise<VoxelScene> {
    const request = new Request(url, {
      headers: new Headers({'Content-Type': 'application/octet-stream'})
    });

    return fetch(request).then((response) => {
      if (!response.ok) {
        throw Error(`Unable to download, server returned ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer().then((buffer) => {
        let decoders = this.getPotentialDecoders(url, buffer);

        if (!decoders.length) {
          throw "Was unable to find a decoder for the file.";
        }

        let scene: VoxelScene | null = null;
        for (let i = 0; i < decoders.length; ++i) {
          const decoder = decoders[i];
          scene = decoder.decode(buffer);
          if (scene) {
            break;
          }
        }

        if (!scene) {
          throw "Unable to read the file.";
        }

        return scene;
      });
    });
  }
}
