import * as THREE from 'three';
import { screenVS } from './screenVS';

const thresholdFS = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;

uniform float threshold;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 color = texture(inputTexture, uv);
  vec3 gray = vec3(0.299, 0.587, 0.114);
  float luminance = dot(color.rgb, gray);
  float thresholdResult = step(threshold, luminance);
  fragColor = vec4(thresholdResult * color.rgb, 1.0);
}
`;

export const thresholdShader = new THREE.RawShaderMaterial({
  glslVersion: "300 es",
  uniforms: {
    inputTexture: { value: null },
    threshold: { value: 0.5 },
    u_resolution: { value: new THREE.Vector2() },
  },
  vertexShader: screenVS,
  fragmentShader: thresholdFS,
});
