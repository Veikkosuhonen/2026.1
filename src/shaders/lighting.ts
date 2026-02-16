import * as THREE from "three";
import { flicker } from "./lib/flicker";

const lightningShaderVS = /* glsl */ `
precision highp float;

in vec3 color;
in float intensity;

out vec3 lightPositionVS;
out vec3 vColor;

void main() {
  mat4 mMatrix = modelMatrix;
  mat4 mvMatrix = modelViewMatrix;

  vColor = color * intensity;

  lightPositionVS = (mvMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  gl_Position = projectionMatrix * mvMatrix * vec4(position, 1.0);
}
`;

const lightningShaderInstancedVS = /* glsl */ `
precision highp float;

in mat4 instanceMatrix;
in vec3 color;
in float intensity;

out vec3 lightPositionVS;
out vec3 vColor;

uniform float u_time;

${flicker}

uniform sampler2D uiTexture;

void main() {
  mat4 mMatrix = modelMatrix * instanceMatrix;
  mat4 mvMatrix = viewMatrix * mMatrix;

  vec4 lightPositionVS4 = (mvMatrix * vec4(0.0, 0.0, 0.0, 1.0));
  lightPositionVS = lightPositionVS4.xyz;
  
  vColor = color * intensity;

  gl_Position = projectionMatrix * mvMatrix * vec4(position, 1.0);
}
`;

const lightningShaderFS = /* glsl */ `
precision highp float;

const float PI = 3.14159265359;

uniform vec2 u_resolution;

uniform sampler2D gColorAo;
uniform sampler2D gNormalRoughness;
uniform sampler2D gPositionMetalness;

layout (location = 0) out vec4 diffuseColorOut;
layout (location = 1) out vec4 specularColorOut;

in vec3 lightPositionVS;
in vec3 vColor;

float DistributionGGX(vec3 N, vec3 H, float roughness) {
  float a      = roughness*roughness;
  float a2     = a*a;
  float NdotH  = max(dot(N, H), 0.0);
  float NdotH2 = NdotH*NdotH;

  float num   = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  return num / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r*r) / 8.0;

  float num   = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return num / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2  = GeometrySchlickGGX(NdotV, roughness);
  float ggx1  = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 colorAo = texture(gColorAo, uv);
  vec4 normalRoughness = texture(gNormalRoughness, uv);
  vec4 positionMetalness = texture(gPositionMetalness, uv);

  vec3 albedo = colorAo.rgb;
  vec3 normal = normalRoughness.rgb;
  float roughness = normalRoughness.a;
  vec3 position = positionMetalness.rgb;
  float metalness = positionMetalness.a;

  vec3 N = normalize(normal); // Normal
  vec3 V = normalize(-position); // View direction

  vec3 L = normalize(lightPositionVS - position); // Light direction
  vec3 H = normalize(L + V); // Half vector
  float NDF = DistributionGGX(N, H, roughness); // Normal distribution function
  float G   = GeometrySmith(N, V, L, roughness); // Geometry function

  // Cook-Torrance BRDF
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, albedo, metalness);
  vec3 F = F0 + (1.0 - F0) * pow(clamp(1.0 - max(dot(H, V), 0.0), 0.0, 1.0), 5.0);

  float ndotl = max(dot(N, L), 0.0);

  vec3 numerator    = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * ndotl + 0.0001;
  vec3 specular     = numerator / denominator;

  float dist = length(lightPositionVS - position);
  float attenuation = 1.0 / (1.0 + dist * dist);
  vec3 radiance = vColor * attenuation;

  vec3 kS = F; // Specular contribution, aka energy of reflection
  vec3 kD = vec3(1.0) - kS; // Diffuse contribution
  kD *= 1.0 - metalness;

  vec3 diffuseColor = (kD * albedo / PI) * radiance * ndotl;
  vec3 specularColor = specular * radiance * ndotl;

  diffuseColorOut = vec4(diffuseColor, 1.0);
  // diffuseColorOut = vec4(lightPositionVS/100.0, 1.0);
  // diffuseColorOut = vec4(vColor, 1.0);
  specularColorOut = vec4(specularColor, 1.0);
  // specularColorOut = vec4(lightPositionVS/100.0, 1.0);
  // specularColorOut = vec4(vColor, 1.0);
}
`;

export const lightningShader = new THREE.ShaderMaterial({
  vertexShader: lightningShaderVS,
  fragmentShader: lightningShaderFS,
  side: THREE.BackSide,
  glslVersion: "300 es",
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
  depthTest: false,

  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,

  uniforms: {
    gColorAo: { value: null },
    gNormalRoughness: { value: null },
    gPositionMetalness: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    lightPositionVS: { value: new THREE.Vector3() },
    lightColor: { value: new THREE.Color() },
    //modelViewMatrix: { value: new THREE.Matrix4() },
    //projectionMatrix: { value: new THREE.Matrix4() },
  },
});

export const lightningShaderInstanced = new THREE.ShaderMaterial({
  vertexShader: lightningShaderInstancedVS,
  fragmentShader: lightningShaderFS,
  side: THREE.BackSide,
  glslVersion: "300 es",
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
  depthTest: false,

  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,

  uniforms: {
    gColorAo: { value: null },
    gNormalRoughness: { value: null },
    gPositionMetalness: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    lightPositionVS: { value: new THREE.Vector3() },
    lightColor: { value: new THREE.Color() },
    u_time: { value: 0 },
    uiTexture: { value: null },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
  },
});
