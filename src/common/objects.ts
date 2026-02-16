import * as THREE from "three";
import { lampMaterial } from "../materials/lamp";

export class ObjectMaterialData {
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  [key: string]: any;
  customShader?: THREE.ShaderMaterial;

  constructor() {
    this.color = new THREE.Color(0xffffff);
    this.emissive = new THREE.Color(0x000000);
    this.emissiveIntensity = 0.0;
  }
}

export type SceneObject = THREE.Object3D & {
  material: ObjectMaterialData;
};

export const lampPost = () => {
  const b = baseObject();
  const pole = cylinderInstance();
  pole.scale.set(0.1, 5.0, 0.1);
  pole.position.add({ x: 0.0, y: 2.5, z: 0.0 });

  const rnd = Math.random();
  const color = rnd > 0.5 ? 0xffccaa : 0xffaa77;

  const lamp = sphereInstance();
  lamp.material.emissive.setHex(color).multiplyScalar(20.0);
  lamp.material.flickerIntensity = 1.0;
  lamp.material.customShader = lampMaterial
  lamp.scale.setScalar(0.4);
  lamp.position.add({ x: 0, y: 5.0, z: 0.0 });
  b.add(lamp);

  const light = new THREE.PointLight(color, 40.0);
  light.userData.flickerIntensity = lamp.material.flickerIntensity;
  lamp.add(light);

  b.add(pole);

  return b;
};

export const redLamp = () => {
  const b = baseObject();
  const pole = cylinderInstance();
  pole.scale.set(0.1, 5.0, 0.1);
  pole.position.add({ x: 0.0, y: 2.5, z: 0.0 });

  const color = 0xff0000;

  const lamp = sphereInstance();
  lamp.material.emissive.setHex(color).multiplyScalar(2);
  lamp.material.flickerIntensity = 1.0;
  lamp.material.customShader = lampMaterial
  lamp.scale.setScalar(0.3);
  lamp.position.add({ x: 0, y: 5.0, z: 0.0 });
  b.add(lamp);

  const light = new THREE.PointLight(color, 20.0);
  light.userData.flickerIntensity = lamp.material.flickerIntensity;
  lamp.add(light);

  b.add(pole);

  return b;
}

export const boxInstance = () => {
  const b = baseObject();
  b.userData.box = true;
  return b;
};

export const sphereInstance = () => {
  const b = baseObject();
  b.userData.sphere = true;
  return b;
};

export const cylinderInstance = () => {
  const b = baseObject();
  b.userData.cylinder = true;
  return b;
};

function baseObject() {
  const b = new THREE.Object3D() as SceneObject;
  b.material = new ObjectMaterialData();
  return b;
}
