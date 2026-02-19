import * as THREE from 'three';
import { ISheet, ISheetObject, types } from '@theatre/core';
import studio from '@theatre/studio';
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
    enabled: types.boolean(pass.enabled),
  }

  const obj = sheet.object(pass.name || "RenderPass" , props);

  obj.onValuesChange((values) => {
    Object.entries(values).forEach(([k, value]) => {
      const key = k as keyof Pass;
      if (typeof value === 'number') {
        // @ts-ignore
        pass[key] = value;
      } else if (typeof value === 'boolean') {
        // @ts-ignore
        pass[key] = value;
      } else if (value) {
        (pass[key] as any as THREE.Color).set(value.r, value.g, value.b);
      }
    });
  });
}

export const connectCameraToTheatre = (camera: THREE.PerspectiveCamera, sheet: ISheet, controls?: any) => {
  const obj = sheet.object(camera.name || "Camera", {
    position: theatreVector3(camera.position),
    rotation: theatreEuler(camera.rotation),
    fov: types.number(camera.fov, { nudgeMultiplier: 1 }),
  });

  obj.onValuesChange((values) => {
    camera.position.set(values.position.x, values.position.y, values.position.z);
    camera.rotation.set(d2r(values.rotation.x), d2r(values.rotation.y), d2r(values.rotation.z));
    camera.fov = values.fov;
    camera.updateProjectionMatrix();
    // Sync CameraControls' internal lat/lon so it doesn't overwrite Theatre.js rotation
    if (controls && typeof controls._setOrientation === 'function') {
      controls._setOrientation();
    }
  });

  return obj;
}

export const connectThreeObjectToTheatre = (object: THREE.Object3D, sheet: ISheet) => {
  const obj = sheet.object(object.name || "Object3D", {
    position: theatreVector3(object.position),
    rotation: theatreEuler(object.rotation),
  });

  obj.onValuesChange((values) => {
    object.position.set(values.position.x, values.position.y, values.position.z);
    object.rotation.set(d2r(values.rotation.x), d2r(values.rotation.y), d2r(values.rotation.z));
  });
}

/**
 * Add a keyframe at the current sequence position with the camera's current transform.
 * Automatically sequences props if they aren't already sequenced.
 */
export const addCameraKeyframe = (
  camera: THREE.PerspectiveCamera,
  cameraObj: ISheetObject,
  sheet: ISheet,
) => {
  const pos = sheet.sequence.position;
  const { x: px, y: py, z: pz } = camera.position;
  const rx = r2d(camera.rotation.x);
  const ry = r2d(camera.rotation.y);
  const rz = r2d(camera.rotation.z);

  // Note: props must be sequenced in the Studio UI first (right-click → "Sequence all").
  // If a prop is not sequenced, `set()` will update its static value instead of creating a keyframe.
  studio.transaction(({ set }) => {
    set(cameraObj.props.position.x, px);
    set(cameraObj.props.position.y, py);
    set(cameraObj.props.position.z, pz);
    set(cameraObj.props.rotation.x, rx);
    set(cameraObj.props.rotation.y, ry);
    set(cameraObj.props.rotation.z, rz);
    set(cameraObj.props.fov, camera.fov);
  });

  console.log(
    `[Theatre] Added camera keyframe at t=${pos.toFixed(2)}s`,
    `pos=(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`,
    `rot=(${rx.toFixed(2)}°, ${ry.toFixed(2)}°, ${rz.toFixed(2)}°)`,
  );
};

const theatreVector3 = (vector: THREE.Vector3) => types.compound({ x: vector.x, y: vector.y, z: vector.z });

const theatreEuler = (euler: THREE.Euler) => types.compound({ x: r2d(euler.x), y: r2d(euler.y), z: r2d(euler.z) });

const d2r = (degrees: number) => degrees / 180 * Math.PI;
const r2d = (radians: number) => radians / Math.PI * 180;