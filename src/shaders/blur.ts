import * as THREE from "three";
import { screenVS } from "./screenVS";

const gauss9xBlurFS = /* glsl */ `
precision highp float;

uniform sampler2D src;

uniform vec2 u_resolution;

uniform vec2 u_blurDirection;

out vec4 fragColor;

const float gaussian_9[9] = float[](
	0.003906250000,
	0.03125000000,
	0.1093750000,
	0.2187500000,
	0.2734375000,
	0.2187500000,
	0.1093750000,
	0.03125000000,
	0.003906250000
);

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  for (int i = 0; i <= 9; i++) {
    vec2 offset = u_blurDirection * vec2(float(i - 4)) * texelSize;
    color += texture(src, uv + offset) * gaussian_9[i];
  }
  color /= 9.0;

  fragColor = color;
}
`;

const blur4xFS = /* glsl */ `
precision highp float;

uniform sampler2D src;

uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 offset = vec2(float(i), float(j)) * texelSize;
      color += texture(src, uv + offset);
    }
  }
  color /= 9.0;

  fragColor = color;
}
`

export const gauss9xBlurShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: gauss9xBlurFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  uniforms: {
    src: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    u_blurDirection: { value: new THREE.Vector2() },
  },
});

export const blur4xShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: blur4xFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  uniforms: {
    src: { value: null },
    u_resolution: { value: new THREE.Vector2() },
  },
});