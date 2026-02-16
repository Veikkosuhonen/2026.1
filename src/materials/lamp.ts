import * as THREE from "three";
import { flicker } from "../shaders/lib/flicker";

const lampShaderFS = /* glsl */ `
precision highp float;

layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec3 vPositionOS;
in vec3 vPosition;
in vec3 vPositionWS;
in vec4 vPositionCS;
in vec4 vPreviousPositionCS;
in vec3 vNormal;
in vec3 vNormalWS;
in vec3 vColor;
in vec3 vEmissive;

// uniform float emissiveIntensity;
// uniform vec3 emissive;

void main() {

  vec3 diffuse = vColor;
  vec3 emissive0 = vEmissive;

  vec3 normalVS = normalize(vNormal);
  vec3 normalWS = normalize(vNormalWS);

  float roughness = 0.51;
  float metallic = 0.0;

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
  gEmission = vec4(1.0 * emissive0, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const lampShaderVS = /* glsl */ `
precision highp float;

in vec3 tangent;
in vec3 color;
in vec3 emissive;
in float flickerIntensity;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

uniform mat4 textProjectionMatrix;
uniform mat4 textViewMatrix;

out vec3 vPositionOS;
out vec3 vPosition;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;
out vec3 vNormalWS;
out vec3 vColor;
out vec3 vEmissive;

${flicker}

uniform sampler2D uiTexture;
uniform float u_time;

void main() {
  mat4 mMatrix = modelMatrix * instanceMatrix;
  mat4 mvMatrix = viewMatrix * mMatrix;

  vec4 lightPositionWS = (mMatrix * vec4(0.0, 0.0, 0.0, 1.0) );
  vec4 lightPositionCS = textProjectionMatrix * textViewMatrix * lightPositionWS;

  vec4 normalWS = mMatrix * vec4(normal, 0.0);
  vNormalWS = normalWS.xyz;

  vec4 normalVS = viewMatrix * normalWS;
  vNormal = normalVS.xyz;

  vPositionOS = position;
  vec4 posWS = mMatrix * vec4(position, 1.0);
  vPositionWS = posWS.xyz;

  vec4 posVS = viewMatrix * posWS;
  vPosition = posVS.xyz;

  vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
  vec4 previousPosVS = previousViewMatrix * previousPosWS;
  vPreviousPositionCS = projectionMatrix * previousPosVS;

  gl_Position = projectionMatrix * posVS;

  vColor = color;

  vec2 uv = lightPositionCS.xy / lightPositionCS.w * 0.5 + 0.5; // Convert to UV coordinates
  vec4 uiTexel = texture(uiTexture, uv);
  float flickerFraction = 0.5 + uiTexel.r * 0.5;

  float flicker = flicker(vec4(lightPositionWS.xyz, u_time), flickerFraction);
  vEmissive = emissive * flicker;

  vPositionCS = gl_Position;
}
`;

export const lampMaterial = new THREE.ShaderMaterial({
  name: "LampMaterial",
  vertexShader: lampShaderVS,
  fragmentShader: lampShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
    uiTexture: { value: null },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
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
    attributes: [
      { name: "color", size: 3 },
      { name: "emissive", size: 3 },
      { name: "flickerIntensity", size: 1 },
    ],
  },
});

lampMaterial.onBeforeRender = (renderer, scene, camera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // lampMaterial.uniforms.u_time.value = beat;
}
