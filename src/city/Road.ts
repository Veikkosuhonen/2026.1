import * as THREE from "three";
import { boxInstance, lampPost } from "../common/objects";
import { LAMPPOST_INTERVAL, LANE_WIDTH } from "./constants";
// import { roadMaterial } from "../materials/road";
import { datalakeMaterial as roadMaterial } from "../materials/datalake";
import { gridMaterial } from "../materials/gridMaterial";

export class Road {
  height = 0.0;
  thickness = 1.0;
  start: THREE.Vector2;
  end: THREE.Vector2;
  topLeft: THREE.Vector2;
  bottomRight: THREE.Vector2;
  width: number;
  direction: THREE.Vector2;
  lanes: number;
  intersections: { position: THREE.Vector2; road: Road }[] = [];
  length: number;

  constructor(
    start: THREE.Vector2,
    end: THREE.Vector2,
    lanes: number,
    direction: THREE.Vector2,
  ) {
    this.start = start;
    this.end = end;
    this.lanes = lanes;
    this.direction = direction;

    this.width = lanes * LANE_WIDTH;
    const halfWidth = 0.5 * this.width;
    const perpendicular = new THREE.Vector2(
      direction.y,
      direction.x,
    ).multiplyScalar(halfWidth);

    this.topLeft = new THREE.Vector2(start.x, start.y).sub(perpendicular);
    this.bottomRight = new THREE.Vector2(end.x, end.y).add(perpendicular);

    this.length = start.distanceTo(end);
  }

  toObject3D() {
    const obj = new THREE.Object3D();

    const b = boxInstance();
    b.material.customShader = roadMaterial;
    b.material.width = this.width;
    b.material.length = this.length;

    const center = new THREE.Vector2()
      .addVectors(this.start, this.end)
      .multiplyScalar(0.5);
    b.position.set(center.x, this.height - this.thickness / 2, center.y);
    b.scale.set(this.start.distanceTo(this.end), this.thickness, this.width);
    const angleY = Math.atan2(this.direction.y, this.direction.x);
    b.rotation.set(0, angleY, 0);
    obj.add(b);

    // this.getLampPosts().forEach(lamp => obj.add(lamp));
    return obj;
  }

  getLampPosts() {
    const numLamps = Math.floor(this.length / LAMPPOST_INTERVAL);
    const offset = this.direction.clone().multiplyScalar(length / numLamps);
    const lamps = [];
    for (let i = 0; i < numLamps; i++) {
      const position = this.start.clone().add(offset.clone().multiplyScalar(i));
      const lamp = lampPost();
      lamp.position.set(position.x, 0, position.y);
      lamps.push(lamp);
    }
    return lamps;
  }
}
