import * as THREE from 'three';
import { ISheet, types } from '@theatre/core';
import { RenderPass } from './renderPasses/RenderPass';
import { Pass } from 'three/examples/jsm/Addons.js';

export const connectPassToTheatre = (pass: RenderPass, sheet: ISheet) => {
  const numberValues = Object.fromEntries(
    Object.entries(pass)
    .filter(([k, v]) => typeof v === 'number')
    .map(([key, value]) => [key, types.number(value as number, { nudgeMultiplier: value as number * 0.05 })])
  );

  const colorValues = Object.fromEntries(
    Object.entries(pass)
    .filter(([k, v]) => v instanceof THREE.Color)
    .map(([key, value]) => [key, types.rgba({ r: value.r, g: value.g, b: value.b, a: 1.0 })])
  );

  const props = {
    ...numberValues,
    ...colorValues,
  }

  const obj = sheet.object(pass.name || "RenderPass" , props);

  obj.onValuesChange((values) => {
    Object.entries(values).forEach(([k, value]) => {
      const key = k as keyof Pass;
      if (typeof value === 'number') {
        // @ts-ignore
        pass[key] = value;
      } else if (value) {
        (pass[key] as any as THREE.Color).set(value.r, value.g, value.b);
      }
    });
  });
}

export const connectObjectToTheatre = (object: THREE.Object3D, sheet: ISheet) => {
  const obj = sheet.object(object.name || "Object3D", {
    position: theatreVector3(object.position),
    rotation: theatreEuler(object.rotation),
  });

  obj.onValuesChange((values) => {
    object.position.set(values.position.x, values.position.y, values.position.z);
    object.rotation.set(d2r(values.rotation.x), d2r(values.rotation.y), d2r(values.rotation.z));
  });
}

const theatreVector3 = (vector: THREE.Vector3) => types.compound({ x: vector.x, y: vector.y, z: vector.z });

const theatreEuler = (euler: THREE.Euler) => types.compound({ x: r2d(euler.x), y: r2d(euler.y), z: r2d(euler.z) });

const d2r = (degrees: number) => degrees / 180 * Math.PI;
const r2d = (radians: number) => radians / Math.PI * 180;