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

export interface CameraFollowController {
  update(deltaTime: number): void;
  readonly enabled: boolean;
}

export const connectCameraFollowToTheatre = (
  camera: THREE.PerspectiveCamera,
  sheet: ISheet,
  lightEntity: { getInstancePosition(i: number): THREE.Vector3; getInstanceQuaternion(i: number): THREE.Quaternion; count: number },
): CameraFollowController => {
  const state = {
    enabled: false,
    followIndex: 0,
    offset: new THREE.Vector3(0, 10, -20),
    smoothing: 0.05,
  };

  const obj = sheet.object("Camera Follow", {
    enabled: types.boolean(false),
    followIndex: types.number(0, { nudgeMultiplier: 1, range: [0, lightEntity.count - 1] }),
    offsetX: types.number(0, { nudgeMultiplier: 1 }),
    offsetY: types.number(10, { nudgeMultiplier: 1 }),
    offsetZ: types.number(-20, { nudgeMultiplier: 1 }),
    smoothing: types.number(0.05, { nudgeMultiplier: 0.01, range: [0.001, 1.0] }),
  });

  obj.onValuesChange((values) => {
    state.enabled = values.enabled;
    state.followIndex = Math.floor(Math.max(0, Math.min(values.followIndex, lightEntity.count - 1)));
    state.offset.set(values.offsetX, values.offsetY, values.offsetZ);
    state.smoothing = values.smoothing;
  });

  const _targetPos = new THREE.Vector3();
  const _lookAtTarget = new THREE.Vector3();
  const _currentLookAt = new THREE.Vector3();
  let _initialized = false;

  return {
    update(_deltaTime: number) {
      if (!state.enabled) {
        _initialized = false;
        return;
      }

      const idx = state.followIndex;
      const boidPos = lightEntity.getInstancePosition(idx);
      const boidQuat = lightEntity.getInstanceQuaternion(idx);

      // Target camera position = boid position + offset rotated by boid orientation
      _targetPos.copy(state.offset).applyQuaternion(boidQuat).add(boidPos);

      if (!_initialized) {
        camera.position.copy(_targetPos);
        _currentLookAt.copy(boidPos);
        _initialized = true;
      }

      // Smooth follow position
      camera.position.lerp(_targetPos, state.smoothing);

      // Smooth look-at target
      _currentLookAt.lerp(boidPos, state.smoothing);
      camera.lookAt(_currentLookAt);
      camera.updateProjectionMatrix();
    },
    get enabled() {
      return state.enabled;
    },
  };
};

export const connectShaderToTheatre = (
  material: THREE.ShaderMaterial,
  uniforms: string[],
  sheet: ISheet,
  name?: string,
): ISheetObject => {
  const props: Record<string, any> = {};

  for (const key of uniforms) {
    const entry = material.uniforms[key];
    if (entry === undefined) {
      console.warn(`[Theatre] Uniform "${key}" not found on material "${material.name}"`);
      continue;
    }

    const v = entry.value;

    if (typeof v === 'boolean') {
      props[key] = types.boolean(v);
    } else if (typeof v === 'number') {
      props[key] = types.number(v, { nudgeMultiplier: Math.abs(v) * 0.05 || 0.01 });
    } else if (v instanceof THREE.Color) {
      props[key] = types.rgba({ r: v.r, g: v.g, b: v.b, a: 1.0 });
    } else if (v instanceof THREE.Vector4) {
      props[key] = types.compound({ x: types.number(v.x, { nudgeMultiplier: 0.01 }), y: types.number(v.y, { nudgeMultiplier: 0.01 }), z: types.number(v.z, { nudgeMultiplier: 0.01 }), w: types.number(v.w, { nudgeMultiplier: 0.01 }) });
    } else if (v instanceof THREE.Vector3) {
      props[key] = types.compound({ x: types.number(v.x, { nudgeMultiplier: 0.01 }), y: types.number(v.y, { nudgeMultiplier: 0.01 }), z: types.number(v.z, { nudgeMultiplier: 0.01 }) });
    } else if (v instanceof THREE.Vector2) {
      props[key] = types.compound({ x: types.number(v.x, { nudgeMultiplier: 0.01 }), y: types.number(v.y, { nudgeMultiplier: 0.01 }) });
    } else {
      console.warn(`[Theatre] Uniform "${key}" has unsupported type, skipping`);
    }
  }

  const obj = sheet.object(name ?? (material.name || 'ShaderMaterial'), props);

  obj.onValuesChange((values) => {
    for (const key of Object.keys(values)) {
      const value = (values as any)[key];
      const uniform = material.uniforms[key];
      if (!uniform) continue;

      if (typeof value === 'number' || typeof value === 'boolean') {
        uniform.value = value;
      } else if ('r' in value && 'g' in value && 'b' in value) {
        // RGBA from Theatre → THREE.Color
        (uniform.value as THREE.Color).setRGB(value.r, value.g, value.b);
      } else if ('w' in value) {
        (uniform.value as THREE.Vector4).set(value.x, value.y, value.z, value.w);
      } else if ('z' in value) {
        (uniform.value as THREE.Vector3).set(value.x, value.y, value.z);
      } else if ('x' in value && 'y' in value) {
        (uniform.value as THREE.Vector2).set(value.x, value.y);
      }
    }
  });

  return obj;
};

export const connectObjectVisibilityToTheatre = (object: THREE.Object3D, sheet: ISheet) => {
  const obj = sheet.object(object.name + " Visibility", {
    visible: types.boolean(object.visible),
  });

  obj.onValuesChange((values) => {
    object.visible = values.visible;
  });
}

const theatreVector3 = (vector: THREE.Vector3) => types.compound({ x: vector.x, y: vector.y, z: vector.z });

const theatreEuler = (euler: THREE.Euler) => types.compound({ x: r2d(euler.x), y: r2d(euler.y), z: r2d(euler.z) });

const d2r = (degrees: number) => degrees / 180 * Math.PI;
const r2d = (radians: number) => radians / Math.PI * 180;