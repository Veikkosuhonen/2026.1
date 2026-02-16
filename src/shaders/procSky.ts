import * as THREE from "three";
import { procSky } from "./lib/procSky";

const skyShaderVS = /* glsl */ `
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const procSkyShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D gPositionMetalness;
uniform mat4 inverseProjection;
uniform mat4 inverseViewMatrix;
uniform vec2 u_resolution;

uniform float gamma;
uniform float exposure;
uniform float fogAmount;

out vec4 FragColor;

${procSky}

void main() {
  vec2 st = gl_FragCoord.st / u_resolution;
  vec2 ndc = st * 2.0 - 1.0;
  vec4 clipSpacePosition = vec4(ndc, 1.0, 1.0);
  vec4 viewSpacePos = inverseProjection * clipSpacePosition;
  viewSpacePos /= viewSpacePos.w; // Perspective divide
  vec3 viewDir = normalize(viewSpacePos.xyz);
  vec3 viewDirectionWS = (inverseViewMatrix * vec4(viewDir, 0.0)).xyz;
  vec3 envColor = getSkyColor(viewDirectionWS, 0.0);

  
  float viewZ = texture(gPositionMetalness, st).z;
  viewZ = clamp(-viewZ, 0.0, 10000.0);

  float fogFactor = 1.0 - exp(-viewZ * fogAmount);

  vec3 color = texture(src, st).rgb;

  vec3 fogColor = vec3(0.05, 0.1, 0.15);
  envColor = viewZ > 9999.0 ? envColor : fogColor;

  // Gamma
  envColor = pow(envColor, vec3(1.0 / gamma));


  // Exposure
  envColor = 1.0 - exp(-envColor * exposure);

  color = mix(color, envColor, fogFactor);

  FragColor = vec4(color, 1.0);
}
`;

export const skyShader = new THREE.RawShaderMaterial({
  vertexShader: skyShaderVS,
  fragmentShader: procSkyShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: false,
  depthTest: false,

  /*stencilWrite: true,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,*/

  uniforms: {
    src: { value: null },
    gPositionMetalness: { value: null },
    envMap: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    inverseProjection: { value: new THREE.Matrix4() },
    inverseViewMatrix: { value: new THREE.Matrix4() },
    gamma: { value: 2.2 },
    exposure: { value: 1.0 },
    fogAmount: { value: 0.01 },
  },
});
