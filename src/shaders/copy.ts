import * as THREE from 'three';
import { screenVS } from './screenVS';
import { alphaT } from 'three/webgpu';

const copyFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform vec2 u_resolution;
uniform float intensity;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  fragColor = texture(src, uv);
  fragColor.a = intensity;
}
`;

export const copyShader = new THREE.RawShaderMaterial({
  glslVersion: "300 es",

  depthWrite: false,
  depthTest: false,

  uniforms: {
    src: { value: null },
    intensity: { value: 1.0 },
    u_resolution: { value: new THREE.Vector2() },
  },
  vertexShader: screenVS,
  fragmentShader: copyFS,
});
