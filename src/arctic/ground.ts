import * as THREE from "three";
import { datalakeMaterial } from "../materials/datalake";

export const createGround = (width: number, height: number) => {
  const geometry = new THREE.PlaneGeometry(width, height, 550, 550);
  const ground = new THREE.Mesh(geometry, datalakeMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(width / 2, -4, height / 2);
  ground.frustumCulled = false;
  return ground;
}