import * as THREE from "three";
import { screenVS } from "./screenVS";

const motionblurShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D gVelocity;
uniform vec2 u_resolution;
uniform float amount;

layout (location = 0) out vec4 FragColor;

const float N_SAMPLES = 8.0;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  
  vec2 velocity = amount * texture(gVelocity, uv).xy;


  vec3 color = texture(src, uv).rgb;
  float totalWeight = 1.0;

  if (abs(velocity.x) < 0.0001 && abs(velocity.y) < 0.0001) {
    FragColor = vec4(color, 1.0);
    return;
  }

  for (int i = 1; i < int(N_SAMPLES); i++) {
    float t = float(i) / N_SAMPLES;
    vec2 offset = t * velocity;
    float weight = 1.0 - float(i) / (N_SAMPLES + 2.0);
    totalWeight += weight;
    color += texture(src, uv + offset).rgb * weight;
  }

  color /= totalWeight;

  FragColor = vec4(color, 1.0);
}
`;

export const motionBlurShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: motionblurShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",

  uniforms: {
    src: { value: null },
    gVelocity: { value: null },
    gPositionMetalness: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    amount: { value: 1.0 },
  },
});