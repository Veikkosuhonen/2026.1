import * as THREE from "three";

// import { buildingMaterial } from "../materials/building";
import { datalakeMaterialInstanced } from "../materials/datalake";
import { boxInstance, cylinderInstance, lampPost, sphereInstance } from "../common/objects";

export class Shard {
  topLeft: THREE.Vector2;
  bottomRight: THREE.Vector2;

  constructor(
    topLeft: THREE.Vector2,
    bottomRight: THREE.Vector2,
  ) {
    this.topLeft = topLeft;
    this.bottomRight = bottomRight;
  }

  toObject3D() {
    const obj = new THREE.Object3D();
    const b = sphereInstance();
    b.material.customShader = datalakeMaterialInstanced;
    const center = new THREE.Vector2()
      .addVectors(this.topLeft, this.bottomRight)
      .multiplyScalar(0.5);
    b.position.set(center.x, 0, center.y);
    b.scale.set(
      10.0,
      10.0,
      10.0,
    );
    obj.add(b);

    // b.add(lampPost())

    return obj;
  }
}
