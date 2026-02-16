import * as THREE from "three";
import { generate } from "./city";
import { generateHighway } from "./highway";
import { boxInstance, SceneObject } from "../common/objects";
import { Road } from "./Road";
import { Car, carLightPositions } from "./Car";
import { AttributeDesc } from "../types";
import { gBufferShaderAttributes } from "../shaders/gbuffer";
import { lightningShaderInstanced } from "../shaders/lighting";
import { Entity } from "~/common/entity";

export type BlockGen = () => THREE.Object3D;

type GeneratorResult = {
  props: THREE.Object3D;
  lights: THREE.Object3D;
  entities: Entity[];
};

export const grid = {
  width: 0, // 200,
  height: 0, // 200,

  generate(): GeneratorResult {
    console.time("generate");

    const group = new THREE.Group();
    const lights = new THREE.Group();
    const entities: Entity[] = [];

    // Ground
    /*const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width * 100, this.height * 100),
      new THREE.MeshPhysicalMaterial(),
    );
    ground.material.color.multiplyScalar(0.6);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.width / 2, -4, this.height / 2);
    ground.frustumCulled = false;
    group.add(ground);*/

    // Highways
    const highways = [
      { dir: new THREE.Vector2(1, 0), bridgeHeight: 8 },
      { dir: new THREE.Vector2(0, 1), bridgeHeight: 16 },
    ].map(({ dir, bridgeHeight }) => {
      const { obj: highway, path } = generateHighway(
          400+this.width,
          400+this.height,
        dir,
      );
      highway.position.set(0, bridgeHeight, 0);
      path.points.forEach((p) => (p.y = bridgeHeight));
      group.add(highway);
      return path;
    });

    // City
    const instancedObjs = []; //generate(this.width, this.height, highways);
    instancedObjs.forEach((obj) => group.add(obj.toObject3D()));

    const carLightDatas: THREE.PointLight[] = [];

    // Cars
    instancedObjs
      .filter((obj) => obj instanceof Road)
      .forEach((road) => {
        for (let lane = 1; lane <= road.lanes / 2; lane++) {
          for (let pos = 0; pos < road.length; pos += 10) {
            if (Math.random() > 0.2) continue;

            const car = new Car(road, pos, lane);
            entities.push(car);
            group.add(car.object);

            car.lights.forEach((light) => {
              light.scale.setScalar(3 * light.intensity);
              light.updateMatrixWorld();
              carLightDatas.push(light);
              carLightPositions.push(light.position); // now their indexes match
            });
          }
        }
      });

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
      dynamicLights: carLightDatas.length,
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
        group.add(this.buildInstanced(new THREE.BoxGeometry(), boxes));
      }
    });

    if (spheres.length > 0) {
      group.add(this.buildInstanced(new THREE.SphereGeometry(1, 16, 8), spheres));
    }

    if (cylinders.length > 0) {
      group.add(
        this.buildInstanced(new THREE.CylinderGeometry(1, 1, 1, 16), cylinders),
      );
    }

    lights.position.copy(group.position);
    if (staticLightDatas.length > 0) {
      lights.add(this.buildInstancedLights(staticLightDatas));
    }
    if (carLightDatas.length > 0) {
      const carLights = this.buildInstancedLights(carLightDatas);
      carLights.userData.carLights = true;
      lights.add(carLights);
    }

    console.timeEnd("generate");

    return {
      props: group,
      lights,
      entities,
    };
  },

  buildInstanced(geom: THREE.BufferGeometry, objs: SceneObject[]): THREE.Mesh {
    const instanced = new THREE.InstancedBufferGeometry();
    instanced.index = geom.index;
    instanced.attributes.position = geom.attributes.position;
    instanced.attributes.normal = geom.attributes.normal;

    const matrixArray = new Float32Array(objs.length * 16);
    const attributeArrays = [] as {
      desc: AttributeDesc;
      array: Float32Array;
    }[];
    const attributeDescs =
      objs[0].material.customShader?.userData?.attributes ??
      (gBufferShaderAttributes as AttributeDesc[]);
    console.log(attributeDescs);

    attributeDescs.forEach((attr: any) => {
      attributeArrays.push({
        desc: attr,
        array: new Float32Array(objs.length * attr.size),
      });
    });

    for (let i = 0; i < objs.length; i++) {
      objs[i].matrixWorld.toArray(matrixArray, i * 16);
      attributeArrays.forEach(({ desc, array }) => {
        const attrValue = objs[i].material[desc.name];
        if (typeof attrValue === "number") {
          array.set([attrValue], i * desc.size);
        } else {
          attrValue.toArray(array, i * desc.size);
        }
      });
    }

    instanced.setAttribute(
      "instanceMatrix",
      new THREE.InstancedBufferAttribute(matrixArray, 16),
    );
    attributeArrays.forEach(({ desc, array }) => {
      instanced.setAttribute(
        desc.name,
        new THREE.InstancedBufferAttribute(array, desc.size),
      );
    });

    const mesh = new THREE.Mesh(
      instanced,
      objs[0].material.customShader ?? new THREE.MeshPhysicalMaterial(),
    );

    mesh.userData.instanced = true;

    mesh.frustumCulled = false;

    return mesh;
  },

  buildInstancedLights(lightDatas: THREE.PointLight[]): THREE.Mesh {
    const sphereGeometry = new THREE.SphereGeometry();

    const lightInstanced = new THREE.InstancedBufferGeometry();
    lightInstanced.index = sphereGeometry.index;
    lightInstanced.attributes.position = sphereGeometry.attributes.position;

    const matrixArray = new Float32Array(lightDatas.length * 16);
    const colorArray = new Float32Array(lightDatas.length * 3);
    const intensityArray = new Float32Array(lightDatas.length);
    const flickerIntensityArray = new Float32Array(lightDatas.length);

    for (let i = 0; i < lightDatas.length; i++) {
      const light = lightDatas[i];

      light.matrixWorld.toArray(matrixArray, i * 16);
      light.color.toArray(colorArray, i * 3);
      intensityArray[i] = light.intensity;
      flickerIntensityArray[i] = light.userData.flickerIntensity || 0.0;
    }

    lightInstanced.setAttribute(
      "instanceMatrix",
      new THREE.InstancedBufferAttribute(matrixArray, 16),
    );
    lightInstanced.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3),
    );
    lightInstanced.setAttribute(
      "intensity",
      new THREE.InstancedBufferAttribute(intensityArray, 1),
    );
    lightInstanced.setAttribute(
      "flickerIntensity",
      new THREE.InstancedBufferAttribute(flickerIntensityArray, 1),
    );

    const lights = new THREE.Mesh(lightInstanced, lightningShaderInstanced);

    lights.frustumCulled = false;

    return lights;
  },
};
