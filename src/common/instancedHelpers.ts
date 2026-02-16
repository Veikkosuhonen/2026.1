import * as THREE from "three";
import { SceneObject } from "./objects";
import { AttributeDesc } from "../types";
import { gBufferShaderAttributes } from "../shaders/gbuffer";
import { lightningShaderInstanced } from "../shaders/lighting";

export const buildInstanced = (geom: THREE.BufferGeometry, objs: SceneObject[]): THREE.Mesh => {
  const instanced = new THREE.InstancedBufferGeometry();
  instanced.index = geom.index;
  instanced.attributes.position = geom.attributes.position;
  instanced.attributes.normal = geom.attributes.normal;

  const matrixArray = new Float32Array(objs.length * 16);
  const attributeArrays = [] as {
    desc: AttributeDesc;
    array: Float32Array;
  }[];
  const attributeDescs =
    objs[0].material.customShader?.userData?.attributes ??
    (gBufferShaderAttributes as AttributeDesc[]);

  attributeDescs.forEach((attr: any) => {
    attributeArrays.push({
      desc: attr,
      array: new Float32Array(objs.length * attr.size),
    });
  });

  for (let i = 0; i < objs.length; i++) {
    objs[i].matrixWorld.toArray(matrixArray, i * 16);
    attributeArrays.forEach(({ desc, array }) => {
      const attrValue = objs[i].material[desc.name];
      if (typeof attrValue === "number") {
        array.set([attrValue], i * desc.size);
      } else {
        attrValue.toArray(array, i * desc.size);
      }
    });
  }

  instanced.setAttribute(
    "instanceMatrix",
    new THREE.InstancedBufferAttribute(matrixArray, 16),
  );
  attributeArrays.forEach(({ desc, array }) => {
    instanced.setAttribute(
      desc.name,
      new THREE.InstancedBufferAttribute(array, desc.size),
    );
  });

  const mesh = new THREE.Mesh(
    instanced,
    objs[0].material.customShader ?? new THREE.MeshPhysicalMaterial(),
  );

  mesh.userData.instanced = true;

  mesh.frustumCulled = false;

  return mesh;
}

export const buildInstancedLights = (lightDatas: THREE.PointLight[]): THREE.Mesh => {
  const sphereGeometry = new THREE.SphereGeometry();

  const lightInstanced = new THREE.InstancedBufferGeometry();
  lightInstanced.index = sphereGeometry.index;
  lightInstanced.attributes.position = sphereGeometry.attributes.position;

  const matrixArray = new Float32Array(lightDatas.length * 16);
  const colorArray = new Float32Array(lightDatas.length * 3);
  const intensityArray = new Float32Array(lightDatas.length);
  const flickerIntensityArray = new Float32Array(lightDatas.length);

  for (let i = 0; i < lightDatas.length; i++) {
    const light = lightDatas[i];

    light.matrixWorld.toArray(matrixArray, i * 16);
    light.color.toArray(colorArray, i * 3);
    intensityArray[i] = light.intensity;
    flickerIntensityArray[i] = light.userData.flickerIntensity || 0.0;
  }

  lightInstanced.setAttribute(
    "instanceMatrix",
    new THREE.InstancedBufferAttribute(matrixArray, 16),
  );
  lightInstanced.setAttribute(
    "color",
    new THREE.InstancedBufferAttribute(colorArray, 3),
  );
  lightInstanced.setAttribute(
    "intensity",
    new THREE.InstancedBufferAttribute(intensityArray, 1),
  );
  lightInstanced.setAttribute(
    "flickerIntensity",
    new THREE.InstancedBufferAttribute(flickerIntensityArray, 1),
  );

  const lights = new THREE.Mesh(lightInstanced, lightningShaderInstanced);

  lights.frustumCulled = false;

  return lights;
}
