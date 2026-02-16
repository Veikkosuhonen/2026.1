import * as THREE from "three";
import { Road } from "./Road";
import { LANE_WIDTH } from "./constants";

const carColors = [0xffffff, 0xff1111, 0x1111ff, 0x111111, 0xaaaaaaa, 0xcccccc];

export const carLightPositions: THREE.Vector3[] = []

export class Car {
  road: Road;
  position: number;
  lane: number;
  object: THREE.Object3D;
  lights: THREE.PointLight[] = [];
  direction: number = 1.0;
  speed: number;

  constructor(road: Road, position: number, lane: number) {
    this.road = road;
    this.position = position;
    this.lane = lane - 0.5;
    this.speed = 1.0 + road.lanes / 4 + Math.random();

    this.object = new THREE.Object3D();
    const color = carColors[Math.floor(Math.random() * carColors.length)];
    this.object.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(2, 1.55, 4.7),
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.1 }),
      ),
    );
    this.object.position.set(road.start.x, 0.8, road.start.y);
    this.object.rotateOnAxis(
      new THREE.Vector3(0, 1, 0),
      Math.atan2(road.direction.x, road.direction.y),
    );

    this.lights[0] = new THREE.PointLight(0xffffff, 15.0);
    this.object.add(this.lights[0]);
    this.lights[0].userData.dynamic = true;
    this.lights[0].userData.flickerIntensity = 0.0;

    this.lights[1] = new THREE.PointLight(0xff1111, 13.0);
    this.object.add(this.lights[1]);
    this.lights[1].userData.dynamic = true;
    this.lights[1].userData.flickerIntensity = 0.0;
  }

  update(deltaTime: number) {
    this.position += this.direction * deltaTime * this.speed;
    if (this.position > this.road.length) {
      this.position = this.road.length;
      this.direction = -1.0;
      this.lane = -this.lane;
    } else if (this.position < 0.0) {
      this.position = 0.0;
      this.direction = 1.0;
      this.lane = -this.lane;
    }
    const offset = this.road.direction.clone().multiplyScalar(this.position);
    const laneOffset = new THREE.Vector2(
      this.road.direction.y,
      -this.road.direction.x,
    ).multiplyScalar(-this.lane * LANE_WIDTH);
    this.object.position.set(
      this.road.start.x + offset.x + laneOffset.x,
      0.8,
      this.road.start.y + offset.y + laneOffset.y,
    );
    const lightOffset = this.road.direction.clone().multiplyScalar(2.5 * this.direction);
    this.lights[0].position.set(
      this.object.position.x + lightOffset.x,
      this.object.position.y,
      this.object.position.z + lightOffset.y,
    );
    this.lights[1].position.set(
      this.object.position.x - lightOffset.x,
      this.object.position.y,
      this.object.position.z - lightOffset.y,
    );
  }
}
