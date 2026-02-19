import * as THREE from "three";
import { buildInstanced, buildInstancedLights } from "~/common/instancedHelpers";
import { cylinderInstance, SceneObject, sphereInstance } from "~/common/objects";
import { solidstateMaterialInstanced } from "~/materials/solidstate";

/*
    variables : F A B
    constants : x X z Z [ ]
*/

type LSystem = {
  axiom: string;
  rules: Record<string, string>;
};


const system2 = {
  axiom: "Am",
  rules: {
    "A": "F[XBm][xBm]",
    "B": "F[ZAm][zAm]",
    'm': 'M',
  },
};

const cylinderLength = 2.0;
const cylinderThickness = 3.0;
const angle = Math.PI / 6;
const angleTapering = 1.0;
const lengthTapering = 0.8;
const thicknessTapering = 0.85;

const evaluateLSystem = (system: LSystem, iterations: number): string => {
  let result = system.axiom;
  for (let i = 0; i < iterations; i++) {
    let newResult = "";
    for (const char of result) {
      newResult += system.rules[char] ?? char;
    }
    result = newResult;
  }
  return result;
}

export const createLSystemPlant = (position: THREE.Vector3) => {
  console.time("generateLSystem");
  const instructions = evaluateLSystem(system2, 13);
  const cylinderObjects: SceneObject[] = [];
  const sphereObjects: SceneObject[] = [];
  const lightsObjects: THREE.PointLight[] = [];

  const stack: { position: THREE.Vector3; rotation: THREE.Euler; thickness: number; len: number; angle: number; key: number }[] = [];
  let currentPosition = position.clone();
  let currentRotation = new THREE.Euler(0, 0, 0);
  let currentThickness = cylinderThickness;
  let currentLen = cylinderLength;
  let currentAngle = angle;
  let currentKey = 0.0;

  for (const char of instructions) {
    if (char === "F") {
      const forward = new THREE.Vector3(0, currentLen, 0).applyEuler(currentRotation);
      
      const cylinder = cylinderInstance();
      cylinder.material.customShader = solidstateMaterialInstanced;
      cylinder.material.emissiveIntensity = 0.0;
      cylinder.material.keyData = new THREE.Vector4(1.0, 0.0, 1.0, currentKey);
      cylinder.position.copy(currentPosition).add(forward);
      cylinder.rotation.copy(currentRotation);
      cylinder.scale.set(currentThickness, currentLen, currentThickness);
      cylinder.updateMatrixWorld();

      
      cylinderObjects.push(cylinder);

      // Move forward
      currentPosition.add(forward.multiplyScalar(2.0));
      currentThickness *= thicknessTapering;
      currentLen *= lengthTapering;
      currentAngle *= angleTapering;
      currentRotation.y += (Math.random() - 0.5) * 0.2;
      currentKey += 1.0 + Math.random();
    } else if (char === "Z") {
      currentRotation.z += currentAngle;
    } else if (char === "z") {
      currentRotation.z -= currentAngle;
    } else if (char === "X") {
      currentRotation.x += currentAngle;
    } else if (char === "x") {
      currentRotation.x -= currentAngle;
    } else if (char === "[") {
      stack.push({ position: currentPosition.clone(), rotation: currentRotation.clone(), thickness: currentThickness, len: currentLen, angle: currentAngle, key: currentKey });
    } else if (char === "]") {
      const state = stack.pop();
      if (state) {
        currentPosition.copy(state.position);
        currentRotation.copy(state.rotation);
        currentThickness = state.thickness;
        currentLen = state.len;
        currentAngle = state.angle;
        currentKey = state.key;
      }
    } else if (char === "m" || char === "M") {
      const sphere = sphereInstance();
      sphere.position.copy(currentPosition);
      sphere.rotation.copy(currentRotation);
      sphere.material.customShader = solidstateMaterialInstanced;
      sphere.material.emissiveIntensity = 20.0;
      sphere.material.keyData = new THREE.Vector4(1.0, 1.0, 1.0, currentKey);

      const size = Math.pow(currentThickness * 2.0, 0.8) / 8.0;

      sphere.scale.setScalar(size);
      sphere.updateMatrixWorld();
      sphereObjects.push(sphere);

      /*if (char === "m" && Math.random() < 0.1) {
        const light = new THREE.PointLight(0xff88bb, 0.5);
        light.scale.setScalar(4 * light.intensity);

        light.position.copy(currentPosition);
        light.updateMatrixWorld();
        lightsObjects.push(light);
      }*/
    }
  }

  const instancedCylinders = buildInstanced(new THREE.CylinderGeometry(0.1, 0.1, cylinderLength, 20, 4), cylinderObjects);
  const instancedSpheres = sphereObjects.length > 0 ? buildInstanced(new THREE.SphereGeometry(1, 16, 12), sphereObjects) : null;
  const instancedLights = buildInstancedLights(lightsObjects);
  console.timeEnd("generateLSystem");

  const group = new THREE.Group();
  group.add(instancedCylinders);
  if (instancedSpheres) group.add(instancedSpheres);
  
  return {
    group,
    lights: instancedLights,
  };
}