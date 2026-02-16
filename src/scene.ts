import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gBufferShaderVariants, getVariantKey } from './shaders/gbuffer';
import { ISheet } from '@theatre/core';
import { connectObjectToTheatre } from './theatreThree';
import { GameState } from './gameState';
import { basicRtMaterial } from './materials/basicRtMaterial';
import { grid } from './arctic/scene';
import { gridMaterial } from './materials/gridMaterial';

export const setupScene = (game: GameState) => {
  const { props, lights, entities } = grid.generate()
  game.scene.add(props)

  if (lights.children.length > 0) {
    game.lights.add(...lights.children)
  }

  if (entities.length > 0) {
    game.entities.push(...entities)
  }

  game.scene.traverse(obj => configureSceneObjects(obj, game))
}

const configureSceneObjects = (object: THREE.Object3D, game: GameState) => {

  if ("t_id" in object.userData) {
    connectObjectToTheatre(object, game.sheet);
  }

  object.userData.previousWorldMatrix = object.matrixWorld;
  if (object.userData.isDynamic) {
    object.onAfterRender = () => {
      object.userData.previousWorldMatrix.copy(object.matrixWorld);
    }
  }

  if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {

    let shader: THREE.Material;

    if (object.material instanceof THREE.MeshPhysicalMaterial) {
      const variantKey = getVariantKey(
        !!object.material.map, 
        !!object.material.normalMap, 
        !!object.material.roughnessMap, 
        !!object.material.emissiveMap, 
        object instanceof THREE.InstancedMesh || object.geometry instanceof THREE.InstancedBufferGeometry || object.userData.instanced
      );

      shader = gBufferShaderVariants[variantKey];
    } else if (object.material instanceof THREE.ShaderMaterial) {
      shader = object.material;
    } else {
      throw new Error(`Unsupported material type ${object.material.type}`);
    }
    
    shader.userData.materialKeys.forEach((key: string) => {
      const materialProperty = (object.material as Record<string, any>)[key];
      if (materialProperty !== undefined) {
        object.userData[key] = materialProperty;
      } else {
        console.warn(`Object missing property ${key}`, object)
      }
    })
    
    object.material = shader;

    object.onBeforeRender = () => {
      object.material.uniforms.previousWorldMatrix.value.copy(object.userData.previousWorldMatrix);

      object.material.userData.materialKeys.forEach((key: string) => {
        object.material.uniforms[key].value = object.userData[key]
      })

      object.material.uniformsNeedUpdate = true
    }
  }
}