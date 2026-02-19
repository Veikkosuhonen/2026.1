import * as THREE from "three";
import { generate } from "./arctic";
import { createGround } from "./ground";
import { Entity } from "~/common/entity";
import { SceneObject } from "~/common/objects";
import { buildInstanced, buildInstancedLights } from "../common/instancedHelpers";
import { createLightEntities } from "./lightEntities";
import { createLSystemPlant } from "./lSystemPlants";

export type BlockGen = () => THREE.Object3D;

type GeneratorResult = {
  props: THREE.Object3D;
  lights: THREE.Object3D;
  entities: Entity[];
};

export const grid = {
  width: 200,
  height: 200,

  generate(): GeneratorResult {
    console.time("generate");

    const group = new THREE.Group();
    const lights = new THREE.Group();
    const entities: Entity[] = [];

    // Ground
    group.add(createGround(this.width, this.height))

    // Dynamic instanced lights
    const { entity, instancedLights, instancedObjects } = createLightEntities();
    console.log(instancedLights)
    group.add(instancedObjects);
    lights.add(instancedLights);
    entities.push(entity);

    // L-System Plants
    const { group: lSystemGroup, lights: lSystemLights } = createLSystemPlant(new THREE.Vector3(100, -4, 100));
    group.add(lSystemGroup);
    lights.add(lSystemLights);

    const instancedObjs = []//generate(this.width, this.height);
    instancedObjs.forEach((obj) => group.add(obj.toObject3D()));

    const dynamicLightDatas: THREE.PointLight[] = [];

    const staticLightDatas: THREE.PointLight[] = [];

    const boxes: SceneObject[] = [];
    const spheres: SceneObject[] = [];
    const cylinders: SceneObject[] = [];

    const toRemove: THREE.Object3D[] = [];

    group.traverse((obj) => {
      obj.updateMatrixWorld();
      let remove = true;

      if (obj.userData.box) {
        boxes.push(obj as SceneObject);
      } else if (obj.userData.sphere) {
        spheres.push(obj as SceneObject);
      } else if (obj.userData.cylinder) {
        cylinders.push(obj as SceneObject);
      } else {
        remove = false;
      }

      if (remove) {
        toRemove.push(obj);
      }

      if (obj instanceof THREE.PointLight && !obj.userData.dynamic) {
        obj.scale.setScalar(4 * obj.intensity);
        obj.updateMatrixWorld();

        staticLightDatas.push(obj);
      }
    });

    toRemove.forEach((obj) => obj.removeFromParent());

    console.table({
      boxes: boxes.length,
      spheres: spheres.length,
      cylinders: cylinders.length,
      lights: staticLightDatas.length,
      dynamicLights: dynamicLightDatas.length,
      entities: entities.length,
    });

    const boxInstancingGroups: Record<string, SceneObject[]> = {};
    boxes.forEach((b) => {
      const shaderName = b.material.customShader?.name ?? "default";
      boxInstancingGroups[shaderName] = boxInstancingGroups[shaderName] || [];
      boxInstancingGroups[shaderName].push(b);
    });
    Object.entries(boxInstancingGroups).forEach(([shaderName, boxes]) => {
      console.log(shaderName, boxes.length);
      if (boxes.length > 0) {
        group.add(buildInstanced(new THREE.BoxGeometry(), boxes));
      }
    });

    if (spheres.length > 0) {
      group.add(buildInstanced(new THREE.SphereGeometry(1, 64, 48), spheres));
    }
    
    if (cylinders.length > 0) {
      group.add(
          buildInstanced(new THREE.CylinderGeometry(1, 1, 1, 16), cylinders),
      );
    }

    lights.position.copy(group.position);

    console.timeEnd("generate");

    return {
      props: group,
      lights,
      entities,
    };
  },
};
