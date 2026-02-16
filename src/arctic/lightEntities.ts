import * as THREE from "three";
import { Entity } from "~/common/entity";
import { buildInstanced, buildInstancedLights } from "~/common/instancedHelpers";
import { SceneObject, sphereInstance } from "~/common/objects";
import { MATRIX } from "~/math";

export const createLightEntities = () => {

  const dynamicLightDatas: THREE.PointLight[] = [];
  const objects: SceneObject[] = [];

  for (let i = 0; i < 142; i++) {
    const light = new THREE.PointLight(0xaabbff, 20.0);
    light.position.set(
      (Math.random()) * 200,
      Math.random() * 10 + 1,
      (Math.random()) * 200
    );
    light.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5),
      (Math.random() - 0.5),
      (Math.random() - 0.5)
    );

    light.userData.flickerIntensity = Math.random() * 0.5;
    light.scale.setScalar(4 * light.intensity);

    light.updateMatrixWorld();
    console.log(light.matrixWorld)

    dynamicLightDatas.push(light);

    const object = sphereInstance()
    object.scale.setScalar(0.3);
    object.material.emissive.setHex(0xaabbff).multiplyScalar(5);
    object.position.copy(light.position);
    object.updateMatrixWorld();
  
    objects.push(object);
  }

  const instancedObjects = buildInstanced(new THREE.SphereGeometry(1, 64, 48), objects);
  const instancedLights = buildInstancedLights(dynamicLightDatas);

  const entity = {
    center: new THREE.Vector3(100, 5, 100),

    update(deltaTime: number) {
      const objectsMatrixAttrib = instancedObjects.geometry.getAttribute("instanceMatrix");
      objectsMatrixAttrib.needsUpdate = true;
      const objectsBuffer = objectsMatrixAttrib.array as Float32Array;
      const lightsMatrixAttrib = instancedLights.geometry.getAttribute("instanceMatrix");
      lightsMatrixAttrib.needsUpdate = true;
      const lightsBuffer = lightsMatrixAttrib.array as Float32Array;

      for (let i = 0; i < dynamicLightDatas.length; i++) {
        const light = dynamicLightDatas[i];
        const object = objects[i];

        // Random walk

        light.userData.velocity.x += (Math.random() - 0.5) * deltaTime * 0.1;
        light.userData.velocity.y += (Math.random() - 0.5) * deltaTime * 0.1;
        light.userData.velocity.z += (Math.random() - 0.5) * deltaTime * 0.1;

        // Pull towards center
        const toCenter = new THREE.Vector3().subVectors(entity.center, light.position);
        light.userData.velocity.addScaledVector(toCenter, deltaTime * 0.001);

        light.position.addScaledVector(light.userData.velocity, deltaTime);
        if (light.position.y < 1) {
          light.position.y = 1;
          light.userData.velocity.y *= -0.5;
        }

        object.position.copy(light.position);

        MATRIX.fromArray(objectsBuffer, i * 16);
        MATRIX.setPosition(light.position);
        MATRIX.toArray(objectsBuffer, i * 16);

        MATRIX.fromArray(lightsBuffer, i * 16);
        MATRIX.setPosition(light.position);
        MATRIX.toArray(lightsBuffer, i * 16);
      }
    }
  };

  return {
    entity,
    instancedLights,
    instancedObjects,
  };
}