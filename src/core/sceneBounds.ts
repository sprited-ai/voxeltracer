import { Box3, Matrix4, Vector3 } from 'three';
import VoxelScene from '../Data/Models/VoxelScene';
import Obj from '../Data/Models/Obj';

/** World-space AABB of every visible model box in the scene. */
export function computeSceneBounds(scene: VoxelScene): Box3 {
  const box = new Box3();
  const walk = (obj: Obj, parent: Matrix4) => {
    if (obj.hidden) return;
    const matrix = parent.clone().multiply(obj.transform);
    if (obj.modelIndex !== -1) {
      const model = scene.models[obj.modelIndex];
      const local = new Box3(
        new Vector3(model.pos.x, model.pos.y, model.pos.z),
        new Vector3(
          model.pos.x + model.size.x,
          model.pos.y + model.size.y,
          model.pos.z + model.size.z
        )
      );
      local.applyMatrix4(matrix);
      box.union(local);
    }
    obj.children?.forEach((child) => walk(child, matrix));
  };
  walk(scene.rootObj, new Matrix4());
  if (box.isEmpty()) {
    box.set(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  }
  return box;
}
