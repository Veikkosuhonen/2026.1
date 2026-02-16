import * as THREE from "three";

const gridShaderFS = /* glsl */ `
precision highp float;

layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec3 vPosition;
in vec3 vPositionWS;
in vec4 vPositionCS;
in vec4 vPreviousPositionCS;
in vec3 vNormal;

uniform float emissiveIntensity;
uniform vec3 emissive;

void main() {
  vec3 diffuse = vec3(1.0);

  // Grid
  vec2 st0 = vPositionWS.xz;
  // vec2 st1 = vPositionWS.xy * 0.1;
  // vec2 st2 = vPositionWS.zy * 0.1;

  float checkers = mod(floor(st0.x) + floor(st0.y), 2.0);
  diffuse = mix(diffuse, vec3(1.0, 0.9, 0.2), checkers);
  diffuse = mix(vec3(0.5, 0.5, 0.5), diffuse, step(0.05, fract(st0.x*0.5)) * step(0.05, fract(st0.y*0.5)));
  diffuse = mix(diffuse, vec3(1.0), 0.5);
  // diffuse *= step(0.5, mod(st1.x, 1.0)) * step(0.5, mod(st1.y, 1.0));
  // diffuse *= step(0.5, mod(st2.x, 1.0)) * step(0.5, mod(st2.y, 1.0));

  vec3 normal = normalize(vNormal);

  vec3 orm = vec3(1.0, 1.0, 0.0);

  vec3 currentPosNDC = vPositionCS.xyz / vPositionCS.w;
  vec3 previousPosNDC = vPreviousPositionCS.xyz / vPreviousPositionCS.w;
  vec2 velocity = currentPosNDC.xy - previousPosNDC.xy;

  vec3 position = vPosition;

  float ao = orm.r;
  float roughnessM = orm.g;
  float metalnessM = orm.b;

  gColorAo = vec4(diffuse, ao);
  gNormalRoughness = vec4(normal, roughnessM);
  gPositionMetalness = vec4(position, metalnessM);
  gEmission = vec4(emissive * emissiveIntensity, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const gridShaderVS = /* glsl */ `
precision highp float;

layout (location = 3) in vec3 tangent;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

out vec3 vPosition;
out vec2 vUv;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;

void main() {
  //#ifdef USE_INSTANCING
  mat4 mMatrix = modelMatrix * instanceMatrix;
  mat4 mvMatrix = viewMatrix * mMatrix;
  //#else
  //mat4 mMatrix = modelMatrix;
  //mat4 mvMatrix = modelViewMatrix;
  //#endif

  vNormal = (mvMatrix * vec4(normal, 0.0)).xyz;

  vUv = uv;

  vec4 posWS = mMatrix * vec4(position, 1.0);
  vPositionWS = posWS.xyz;

  vec4 posVS = viewMatrix * posWS;
  vPosition = posVS.xyz;

  vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
  vec4 previousPosVS = previousViewMatrix * previousPosWS;
  vPreviousPositionCS = projectionMatrix * previousPosVS;

  gl_Position = projectionMatrix * posVS;

  vPositionCS = gl_Position;
}
`;

export const gridMaterial = new THREE.ShaderMaterial({
  name: "GridMaterial",
  vertexShader: gridShaderVS,
  fragmentShader: gridShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    // emissive: { value: new THREE.Color(0x000000) },
    // emissiveIntensity: { value: 0.0 },
  },
  defines: {
    USE_INSTANCING: "",
  },
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: true,
  transparent: false,
  stencilWrite: true,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
  stencilFail: THREE.ReplaceStencilOp,
  stencilZFail: THREE.ReplaceStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,
  userData: {
    materialKeys: [],
  },
});
