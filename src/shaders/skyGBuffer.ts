import * as THREE from "three";

const skyGBufferShaderVS = /* glsl */ `
precision highp float;

uniform mat4 previousViewMatrix;

out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

void main() {
  vPreviousPositionCS = projectionMatrix * previousViewMatrix * modelMatrix * vec4(position, 1.0);
  vPositionCS = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);

  gl_Position = vPositionCS;
}
`;

const skyGBufferShaderFS = /* glsl */ `
precision highp float;


layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec4 vPositionCS;
in vec4 vPreviousPositionCS;

void main() {
  vec3 currentPosNDC = vPositionCS.xyz / vPositionCS.w;
  vec3 previousPosNDC = vPreviousPositionCS.xyz / vPreviousPositionCS.w;
  vec2 velocity = currentPosNDC.xy - previousPosNDC.xy;

  gColorAo = vec4(0.0);
  gNormalRoughness = vec4(0.0);
  gPositionMetalness = vec4(0.0, 0.0, -100000.0, 0.0);
  gEmission = vec4(0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

export const skyGBufferShader = new THREE.ShaderMaterial({
  vertexShader: skyGBufferShaderVS,
  fragmentShader: skyGBufferShaderFS,
  side: THREE.BackSide,
  glslVersion: "300 es",
  depthTest: true,

  stencilWrite: true,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,

  uniforms: {
    previousViewMatrix: { value: new THREE.Matrix4() },
  },
  name: "Sky gbuffer",
});