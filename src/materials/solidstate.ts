import * as THREE from "three";
import { audioManager } from "~/audio";
import { getSequence } from "~/sequence";

const solidstateShaderFS = /* glsl */ `
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
in vec2 vUv;
in float vEmissiveIntensity;

uniform float u_time;
uniform mat4 textProjectionMatrix;
uniform mat4 projectionMatrix;
uniform mat4 textViewMatrix;
uniform vec3 cameraPositionWS;
uniform float near;
uniform float far;

// Using stefan gustavsons cellular noise:

// Cellular noise ("Worley noise") in 2D in GLSL.
// Copyright (c) Stefan Gustavson 2011-04-19. All rights reserved.
// This code is released under the conditions of the MIT license.
// See LICENSE file for details.
// https://github.com/stegu/webgl-noise

// Modulo 289 without a division (only multiplications)
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec3 mod7(vec3 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + 10x) mod 289
vec3 permute(vec3 x) {
  return mod289((34.0 * x + 10.0) * x);
}

// Cellular noise, returning F1 and F2 in a vec2.
// Standard 3x3 search window for good F1 and F2 values
vec2 cellular(vec2 P) {
#define K 0.142857142857 // 1/7
#define Ko 0.428571428571 // 3/7
#define jitter 1.0 // Less gives more regular pattern
	vec2 Pi = mod289(floor(P));
 	vec2 Pf = fract(P);
	vec3 oi = vec3(-1.0, 0.0, 1.0);
	vec3 of = vec3(-0.5, 0.5, 1.5);
	vec3 px = permute(Pi.x + oi);
	vec3 p = permute(px.x + Pi.y + oi); // p11, p12, p13
	vec3 ox = fract(p*K) - Ko;
	vec3 oy = mod7(floor(p*K))*K - Ko;
	vec3 dx = Pf.x + 0.5 + jitter*ox;
	vec3 dy = Pf.y - of + jitter*oy;
	vec3 d1 = dx * dx + dy * dy; // d11, d12 and d13, squared
	p = permute(px.y + Pi.y + oi); // p21, p22, p23
	ox = fract(p*K) - Ko;
	oy = mod7(floor(p*K))*K - Ko;
	dx = Pf.x - 0.5 + jitter*ox;
	dy = Pf.y - of + jitter*oy;
	vec3 d2 = dx * dx + dy * dy; // d21, d22 and d23, squared
	p = permute(px.z + Pi.y + oi); // p31, p32, p33
	ox = fract(p*K) - Ko;
	oy = mod7(floor(p*K))*K - Ko;
	dx = Pf.x - 1.5 + jitter*ox;
	dy = Pf.y - of + jitter*oy;
	vec3 d3 = dx * dx + dy * dy; // d31, d32 and d33, squared
	// Sort out the two smallest distances (F1, F2)
	vec3 d1a = min(d1, d2);
	d2 = max(d1, d2); // Swap to keep candidates for F2
	d2 = min(d2, d3); // neither F1 nor F2 are now in d3
	d1 = min(d1a, d2); // F1 is now in d1
	d2 = max(d1a, d2); // Swap to keep candidates for F2
	d1.xy = (d1.x < d1.y) ? d1.xy : d1.yx; // Swap if smaller
	d1.xz = (d1.x < d1.z) ? d1.xz : d1.zx; // F1 is in d1.x
	d1.yz = min(d1.yz, d2.yz); // F2 is now not in d2.yz
	d1.y = min(d1.y, d1.z); // nor in  d1.z
	d1.y = min(d1.y, d2.x); // F2 is in d1.y, we're done.
	return sqrt(d1.xy);
}// END

vec2 fbm(vec2 st) {
    float gain = 1.0;
    float norm = 0.0;
    vec2 v = vec2(0.0);
    
    for (int i = 0; i < 5; i++) {
        v += gain * cellular(st);
        st += 123.123;
        norm += gain;
        gain /= 2.6;
        st *= 2.0;
    }
    
    return v / norm;
}

float height(vec2 xy) {
    xy /= 6.0;
    xy += 0.9 * fbm(xy.yx - 321.321);
    float v = fbm(xy).y * 2.0 - 1.0;
    return 1.0 - pow(v, 3.0);
}

vec4 terrain(vec2 xy) {
    const vec2 eps = vec2(0.05, 0.0);
    float h0 = height(xy + eps.xy); // Height
    return vec4(
        h0 - height(xy - eps.xy),
        eps.x,
        height(xy + eps.yx) - height(xy - eps.yx),
        1.0-clamp(0.0, 1.0, h0)
    );
}

vec3 rotationAxis(vec3 v) {
  const vec3 up = vec3(0.0, 1.0, 0.0);
  return normalize(cross(up, v));
}

float rotationAngle(vec3 v) {
  const vec3 up = vec3(0.0, 1.0, 0.0);
  return acos(dot(up, v));
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  float cosA = cos(angle);
  float sinA = sin(angle);
  return v * cosA + cross(axis, v) * sinA + axis * dot(axis, v) * (1.0 - cosA);
}

vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
  return a + b*cos( 6.283185*(c*t+d) );
}

float fresnelSchlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec3 diffuse = vec3(0.5);

  vec3 normalVS = normalize(vNormal);
  vec3 normalWS = normalize(vNormalWS);

  vec4 terrainData = terrain(vUv / 10.0);
  float roughness = clamp(0.2, 1.0, pow(terrainData.w, 2.0));

  // Reduce intensity of normal for smoother look
  vec3 newNormal = normalize(terrainData.xyz);
  newNormal.y = newNormal.y * 0.5 + 0.5;
  newNormal.y *= 7.0;
  newNormal = normalize(newNormal);

  // Rotate newly computed normal to match the mesh WS normal.
  float angle = rotationAngle(normalWS);
  vec3 axis = rotationAxis(normalWS);
  vec3 newNormalWS = normalize(rotate(newNormal, axis, angle));

  // Rotate newly computed normal to match the mesh VS normal.
  angle = rotationAngle(normalVS);
  axis = rotationAxis(normalVS);
  vec3 newNormalVS = normalize(rotate(newNormal, axis, angle));

  
  // Raymarch grid
  vec3 viewDir = normalize(cameraPositionWS - vPositionWS);
  vec3 refractDir = refract(-viewDir, newNormalWS, 1.0 / 1.31);

  float fresnel = fresnelSchlick(dot(viewDir, newNormalWS), 0.1);

  // float pulseHeight = 10.0 * (sin(u_time * 2.0) * 0.5 + 0.5);
  float pulseDepth = mod(
    -u_time * 5.0 + vPositionWS.x * 0.1, 
    14.0) 
    - 4.0;

  float metallic = 0.0;
  vec3 emissive = vColor * vEmissiveIntensity;

  vec3 orm = vec3(1.0, roughness, metallic);

  vec3 currentPosNDC = vPositionCS.xyz / vPositionCS.w;
  vec3 previousPosNDC = vPreviousPositionCS.xyz / vPreviousPositionCS.w;
  vec2 velocity = currentPosNDC.xy - previousPosNDC.xy;

  vec3 position = vPosition;

  float ao = orm.r;
  float roughnessM = orm.g;
  float metalnessM = orm.b;

  gColorAo = vec4(diffuse, ao);
  gNormalRoughness = vec4(newNormalVS, roughnessM);
  gPositionMetalness = vec4(position, metalnessM);
  gEmission = vec4(emissive, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const solidstateShaderVS = /* glsl */ `
precision highp float;

in vec3 color;
in float emissiveIntensity;
in vec4 keyData;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;
uniform float u_time;
uniform float u_growthTime;
uniform float loudness;

out vec3 vPosition;
out vec2 vUv;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;
out vec3 vNormalWS;
out vec3 vColor;
out float vEmissiveIntensity;

vec2 triplanar(vec3 normal, vec3 position) {
  vec3 absNormal = abs(normal);
  vec3 weights = absNormal / (absNormal.x + absNormal.y + absNormal.z);
  vec2 uvX = position.yz;
  vec2 uvY = position.xz;
  vec2 uvZ = position.xy;
  return uvX * weights.x + uvY * weights.y + uvZ * weights.z;
}

mat4 scaleMatrix(vec3 scale) {
  return mat4(
    vec4(scale.x, 0.0, 0.0, 0.0),
    vec4(0.0, scale.y, 0.0, 0.0),
    vec4(0.0, 0.0, scale.z, 0.0),
    vec4(0.0, 0.0, 0.0, 1.0)
  );
}

void main() {
  #ifdef USE_INSTANCING
    mat4 mMatrix = modelMatrix * instanceMatrix;
    mat4 mvMatrix = viewMatrix * modelMatrix;
  #else
    mat4 mMatrix = modelMatrix;
    mat4 mvMatrix = modelViewMatrix;
  #endif

  vec4 posOS = vec4(position, 1.0);

  float key = posOS.y + keyData.w;
  float t = min(30.0, u_growthTime + loudness);
  vec3 constantScale = vec3(1.0) - keyData.xyz;
  vec3 keyScale = keyData.xyz * smoothstep(key, key + 6.0, t);
  mMatrix *= scaleMatrix(constantScale + keyScale);

  vec4 normalWS = normalize( mMatrix * vec4(normal, 0.0));

  vec4 posWS = mMatrix * posOS;
  vUv = triplanar(normalWS.xyz, posWS.xyz);

  vNormalWS = normalWS.xyz;
  vPositionWS = posWS.xyz;

  vec4 normalVS = viewMatrix * normalWS;
  vNormal = normalVS.xyz;

  vColor = color;
  vEmissiveIntensity = emissiveIntensity * smoothstep(keyData.w + 6.0, keyData.w - 0.5, t);
  // t is now driven by u_growthTime (Theatre.js) instead of u_time

  vec4 posVS = viewMatrix * posWS;
  vPosition = posVS.xyz;

  vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
  vec4 previousPosVS = previousViewMatrix * previousPosWS;
  vPreviousPositionCS = projectionMatrix * previousPosVS;

  gl_Position = projectionMatrix * posVS;

  vPositionCS = gl_Position;
}
`;

export const solidstateMaterialInstanced = new THREE.ShaderMaterial({
  name: "SolidstateMaterialInstanced",
  vertexShader: solidstateShaderVS,
  fragmentShader: solidstateShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
    u_growthTime: { value: 0.0 },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
    cameraPositionWS: { value: new THREE.Vector3() },
    near: { value: 0.1 },
    far: { value: 1000 },
    loudness: { value: 0.0 },
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
    attributes: [{ name: "color", size: 3 }, { name: "emissiveIntensity", size: 1 }, { name: "keyData", size: 4 }],
  },
});

export const solidstateMaterial = new THREE.ShaderMaterial({
  name: "SolidstateMaterial",
  vertexShader: solidstateShaderVS,
  fragmentShader: solidstateShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
    u_growthTime: { value: 0.0 },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
    cameraPositionWS: { value: new THREE.Vector3() },
    near: { value: 0.1 },
    far: { value: 1000 },
    loudness: { value: 0.0 },
  },
  defines: {
    // USE_INSTANCING: "",
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
    attributes: [{ name: "color", size: 3 }, { name: "emissiveIntensity", size: 1 }, { name: "keyData", size: 4 }],
  },
});

solidstateMaterialInstanced.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // iceMaterial.uniforms.u_time.value = beat;
  solidstateMaterialInstanced.uniforms.cameraPositionWS.value.copy(camera.position);
  solidstateMaterialInstanced.uniforms.u_time.value = getSequence().position;
  solidstateMaterialInstanced.uniforms.near.value = camera.near;
  solidstateMaterialInstanced.uniforms.far.value = camera.far;
  solidstateMaterialInstanced.uniforms.loudness.value = (audioManager.getEnergy() * 10.0 - 10.0);
}


solidstateMaterial.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // iceMaterial.uniforms.u_time.value = beat;
  solidstateMaterial.uniforms.cameraPositionWS.value.copy(camera.position);
  solidstateMaterial.uniforms.u_time.value = getSequence().position;
  solidstateMaterial.uniforms.near.value = camera.near;
  solidstateMaterial.uniforms.far.value = camera.far;
}
