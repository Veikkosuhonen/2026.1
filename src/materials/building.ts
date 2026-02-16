import * as THREE from "three";
import { flicker } from "../shaders/lib/flicker";

const buildingShaderFS = /* glsl */ `
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
in vec3 vNormalWS;
in vec3 vColor;

uniform float u_time;
uniform mat4 textProjectionMatrix;
uniform mat4 projectionMatrix;
uniform mat4 textViewMatrix;
uniform vec3 cameraPositionWS;
uniform float near;
uniform float far;

${flicker}

uniform sampler2D uiTexture;

void main() {
  vec3 diffuse = vColor;

  vec3 normalVS = normalize(vNormal);
  vec3 normalWS = normalize(vNormalWS);

  float isRoof = step(0.5, normalWS.y);
  float isWall = 1.0 - isRoof;

  float floorN = floor(vPositionWS.y * 0.666 + 0.2);
  float isWindowRow = mod(floorN, 2.0);

  float windowXY = vPositionWS.x + vPositionWS.z;
  vec3 windowCornerPosition = floor(vec3(vPositionWS.x, floorN, vPositionWS.z));
  float windowId = floor(windowXY + 100.0 * floorN);
  float windowSeed = sin(10.0 * windowId + 10.0 * floorN);
  float isWindowCol = step(0.3, mod(windowXY, 1.0));


  // Sometimes long vertical window
  float vertical = step(35.0, mod(windowId, 40.0));
  isWindowRow = min(1.0, isWindowRow + vertical);
  // Taller window segments on vertical section
  floorN = vertical > 0.0 ? floor(floorN / 4.0) : floorN;

  mat4 vpMatrix = projectionMatrix * textViewMatrix;
  vec4 lightPositionCS = vpMatrix * vec4(windowCornerPosition, 1.0);
  vec2 uv = lightPositionCS.xy / lightPositionCS.w * 0.5 + 0.5; // Convert to UV coordinates
  vec4 uiTexel = texture(uiTexture, uv);
  float flickerFraction = uiTexel.r;
  float flicker = flicker(vec4(vec3(floorN, windowId, 1.0), u_time), flickerFraction);

  float isWindow = isWall * isWindowRow * isWindowCol;

  float isLit = flicker * step(0.0, mod(windowId, 5.0));
 
  float roughness = 1.0 - isWindow * 0.9;
  float metallic = 0.0;
  vec3 emissive = step(fract(windowSeed), 0.95) > 0.0 ? vec3(1.0, 0.75, 0.25) : vec3(0.9, 0.4, 0.9) * 3.0;
  float emissiveIntensity = isWindow * isLit;

  vec3 orm = vec3(1.0, roughness, metallic);

  vec3 currentPosNDC = vPositionCS.xyz / vPositionCS.w;
  vec3 previousPosNDC = vPreviousPositionCS.xyz / vPreviousPositionCS.w;
  vec2 velocity = currentPosNDC.xy - previousPosNDC.xy;

  vec3 position = vPosition;

  float ao = orm.r;
  float roughnessM = orm.g;
  float metalnessM = orm.b;

  gColorAo = vec4(diffuse, ao);
  gNormalRoughness = vec4(normalVS, roughnessM);
  gPositionMetalness = vec4(position, metalnessM);
  gEmission = vec4(emissive * emissiveIntensity, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const buildingShaderVS = /* glsl */ `
precision highp float;

in vec3 tangent;
in vec3 color;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

out vec3 vPosition;
out vec2 vUv;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;
out vec3 vNormalWS;
out vec3 vColor;

void main() {
  //#ifdef USE_INSTANCING
  mat4 mMatrix = modelMatrix * instanceMatrix;
  mat4 mvMatrix = viewMatrix * mMatrix;
  //#else
  //mat4 mMatrix = modelMatrix;
  //mat4 mvMatrix = modelViewMatrix;
  //#endif

  vec4 normalWS = mMatrix * vec4(normal, 0.0);
  vNormalWS = normalWS.xyz;

  vec4 normalVS = viewMatrix * normalWS;
  vNormal = normalVS.xyz;

  vUv = uv;

  vColor = color;

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

export const buildingMaterial = new THREE.ShaderMaterial({
  name: "BuildingMaterial",
  vertexShader: buildingShaderVS,
  fragmentShader: buildingShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
    uiTexture: { value: null },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
    cameraPositionWS: { value: new THREE.Vector3() },
    near: { value: 0.1 },
    far: { value: 1000 },
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
    attributes: [{ name: "color", size: 3 }],
  },
});

buildingMaterial.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // buildingMaterial.uniforms.u_time.value = beat;
  buildingMaterial.uniforms.cameraPositionWS.value.copy(camera.position);
  buildingMaterial.uniforms.u_time.value = performance.now() / 1000;
  buildingMaterial.uniforms.near.value = camera.near;
  buildingMaterial.uniforms.far.value = camera.far;
}
