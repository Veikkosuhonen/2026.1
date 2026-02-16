import RAPIER from '@dimforge/rapier3d';
import * as THREE from 'three';

export const createLines = () => {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });

  const lines = new THREE.Line(geometry, material);

  return {
    lines,

    updateFromBuffer: (buffer: RAPIER.DebugRenderBuffers) => {
      const { vertices, colors } = buffer;
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
  }
}