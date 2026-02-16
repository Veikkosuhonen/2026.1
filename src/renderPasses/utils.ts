import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/Addons.js";

export const fsQuad = new FullScreenQuad();
export const bgCube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
);