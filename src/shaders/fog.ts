import * as THREE from "three";
import { screenVS } from "./screenVS";

const fogShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D gPositionMetalness;
uniform vec2 u_resolution;
uniform float amount;
uniform vec3 fogColor;

out vec4 FragColor;

void main() {
  vec2 st = gl_FragCoord.st / u_resolution.st;

  float viewZ = texture(gPositionMetalness, st).z;
  viewZ = clamp(-viewZ, 0.0, 10000.0);

  float fogFactor = 1.0 - exp(-viewZ * amount);

  vec3 color = texture(src, st).rgb;
  color = mix(color, fogColor, fogFactor);

  FragColor = vec4(color, 1.0);
}
`;

export const fogShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: fogShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: false,
  uniforms: {
    src: { value: null },
    gPositionMetalness: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    amount: { value: 0.01 },
    fogColor: { value: new THREE.Color(0x000000) },
  },
});
