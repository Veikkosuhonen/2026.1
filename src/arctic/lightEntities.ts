import * as THREE from "three";
import { Entity } from "~/common/entity";
import { buildInstanced, buildInstancedLights } from "~/common/instancedHelpers";
import { SceneObject, sphereInstance } from "~/common/objects";
import { MATRIX } from "~/math";

const BOID_COUNT = 100;
const PERCEPTION_RADIUS = 40;
const SEPARATION_RADIUS = 15;
const MAX_SPEED = 3;
const MAX_FORCE = 0.05;

const SEPARATION_WEIGHT = 2.5;
const ALIGNMENT_WEIGHT = 1.0;
const COHESION_WEIGHT = 1.0;
const CENTER_WEIGHT = 0.0005;

export const createLightEntities = () => {

  const dynamicLightDatas: THREE.PointLight[] = [];
  const objects: SceneObject[] = [];

  for (let i = 0; i < BOID_COUNT; i++) {
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

    light.scale.setScalar(4 * light.intensity);

    light.updateMatrixWorld();

    dynamicLightDatas.push(light);

    const object = sphereInstance()
    object.scale.set(0.9, 0.3, 0.3);
    object.material.emissive.setHex(0xaabbff).multiplyScalar(5);
    object.position.copy(light.position);
    object.updateMatrixWorld();
  
    objects.push(object);
  }

  const instancedObjects = buildInstanced(new THREE.SphereGeometry(1, 64, 48), objects);
  const instancedLights = buildInstancedLights(dynamicLightDatas);

  // Reusable vectors to avoid allocations in the update loop
  const _separation = new THREE.Vector3();
  const _alignment = new THREE.Vector3();
  const _cohesion = new THREE.Vector3();
  const _diff = new THREE.Vector3();
  const _steer = new THREE.Vector3();
  const _toCenter = new THREE.Vector3();
  // Pre-allocate acceleration array
  const accelerations: THREE.Vector3[] = [];
  for (let i = 0; i < BOID_COUNT; i++) {
    accelerations.push(new THREE.Vector3());
  }

  const entity = {
    center: new THREE.Vector3(100, 5, 100),
    FORWARD: new THREE.Vector3(1, 0, 0),
    DIR: new THREE.Vector3(1, 0, 0),

    update(deltaTime: number) {
      const objectsMatrixAttrib = instancedObjects.geometry.getAttribute("instanceMatrix");
      objectsMatrixAttrib.needsUpdate = true;
      const objectsBuffer = objectsMatrixAttrib.array as Float32Array;
      const lightsMatrixAttrib = instancedLights.geometry.getAttribute("instanceMatrix");
      lightsMatrixAttrib.needsUpdate = true;
      const lightsBuffer = lightsMatrixAttrib.array as Float32Array;

      // --- Phase 1: Compute boid forces ---
      for (let i = 0; i < BOID_COUNT; i++) {
        const boid = dynamicLightDatas[i];
        const vel = boid.userData.velocity as THREE.Vector3;
        const pos = boid.position;

        _separation.set(0, 0, 0);
        _alignment.set(0, 0, 0);
        _cohesion.set(0, 0, 0);

        let separationCount = 0;
        let perceptionCount = 0;

        for (let j = 0; j < BOID_COUNT; j++) {
          if (i === j) continue;
          const other = dynamicLightDatas[j];
          const dist = pos.distanceTo(other.position);

          if (dist < PERCEPTION_RADIUS) {
            // Alignment: average velocity of neighbors
            _alignment.add(other.userData.velocity as THREE.Vector3);

            // Cohesion: average position of neighbors
            _cohesion.add(other.position);

            perceptionCount++;

            // Separation: steer away from close neighbors
            if (dist < SEPARATION_RADIUS && dist > 0.001) {
              _diff.subVectors(pos, other.position);
              _diff.divideScalar(dist * dist); // weight by inverse square distance
              _separation.add(_diff);
              separationCount++;
            }
          }
        }

        const acc = accelerations[i];
        acc.set(0, 0, 0);

        if (perceptionCount > 0) {
          // Alignment steering
          _alignment.divideScalar(perceptionCount);
          _alignment.normalize().multiplyScalar(MAX_SPEED);
          _alignment.sub(vel);
          _alignment.clampLength(0, MAX_FORCE);
          acc.addScaledVector(_alignment, ALIGNMENT_WEIGHT);

          // Cohesion steering
          _cohesion.divideScalar(perceptionCount);
          _cohesion.sub(pos);
          _cohesion.normalize().multiplyScalar(MAX_SPEED);
          _cohesion.sub(vel);
          _cohesion.clampLength(0, MAX_FORCE);
          acc.addScaledVector(_cohesion, COHESION_WEIGHT);
        }

        if (separationCount > 0) {
          _separation.divideScalar(separationCount);
          _separation.normalize().multiplyScalar(MAX_SPEED);
          _separation.sub(vel);
          _separation.clampLength(0, MAX_FORCE);
          acc.addScaledVector(_separation, SEPARATION_WEIGHT);
        }

        // Pull towards global center
        _toCenter.subVectors(entity.center, pos);
        acc.addScaledVector(_toCenter, CENTER_WEIGHT);

        // Small random jitter for organic feel
        acc.x += (Math.random() - 0.5) * 0.01;
        acc.y += (Math.random() - 0.5) * 0.01;
        acc.z += (Math.random() - 0.5) * 0.01;
      }

      // --- Phase 2: Integrate and update transforms ---
      for (let i = 0; i < BOID_COUNT; i++) {
        const light = dynamicLightDatas[i];
        const object = objects[i];
        const vel = light.userData.velocity as THREE.Vector3;

        // Apply acceleration
        vel.addScaledVector(accelerations[i], deltaTime);

        // Clamp speed
        if (vel.length() > MAX_SPEED) {
          vel.normalize().multiplyScalar(MAX_SPEED);
        }

        // Integrate position
        light.position.addScaledVector(vel, deltaTime);

        // Ground bounce
        if (light.position.y < 1) {
          light.position.y = 1;
          vel.y *= -0.5;
        }

        object.position.copy(light.position);

        // Rotate towards velocity direction
        const speed = vel.length();
        if (speed > 0.01) {
          object.quaternion.setFromUnitVectors(
            entity.FORWARD,
            entity.DIR.copy(vel).divideScalar(speed)
          );
        }

        MATRIX.compose(object.position, object.quaternion, object.scale);
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