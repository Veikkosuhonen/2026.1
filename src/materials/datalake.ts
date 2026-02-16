import * as THREE from "three";

const datalakeShaderFS = /* glsl */ `
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
in vec3 vPositionOffset;

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
  vec3 diffuse = vec3(1.0);

  vec3 normalVS = normalize(vNormal);
  vec3 normalWS = normalize(vNormalWS);

  vec4 terrainData = terrain(vUv);
  float roughness = clamp(0.1, 1.0, terrainData.w);
  diffuse = mix(diffuse, vec3(1.0), roughness);

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

  float glow = 0.0;
  float depth = 0.0;

  for (int i = 0; i < 200; i++) {
    vec3 offset = 0.5 * vPositionOffset * (1.0 - depth / 10.0); // Reduce wave influence with depth
    vec3 samplePos = vPositionWS - offset + refractDir * float(i) * 0.05;
    // 3d grid pattern
    vec3 grid = fract(samplePos/2.0 + 0.5) - 0.5;
    vec3 dist = abs(grid);
    const float thickness = 0.03;
    const float smoothing = 0.01;
    vec3 mask = smoothstep(0.5 - thickness - smoothing, 0.5 - thickness, dist);
    float isGrid = clamp(mask.x * mask.y + mask.y * mask.z + mask.z * mask.x, 0.0, 1.0);

    depth = length(samplePos - vPositionWS);

    // isGrid *= max(0.0, smoothstep(4.0, 0.0, abs(depth - pulseDepth))); // Add pulse effect

    glow += isGrid * exp(-depth * 0.5);
  }
  glow = clamp(glow, 0.0, 6.0);
  glow *= max(1.0 - fresnel * 2.0, 0.0);
  glow *= 1.0 - roughness; // Reduce glow with roughness

  float metallic = 0.0;
  vec3 emissive = palette(
    vUv.y + u_time * 0.05,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.00, 0.33, 0.67)
  );
  float emissiveIntensity = 0.0;//  glow;

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
  gEmission = vec4(emissive * emissiveIntensity, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const datalakeShaderVS = /* glsl */ `
precision highp float;

in vec3 tangent;
in vec3 color;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;
uniform float u_time;

out vec3 vPosition;
out vec2 vUv;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;
out vec3 vNormalWS;
out vec3 vColor;
out vec3 vPositionOffset;

#define PI 3.1415926535897932384626433832795
#define _WaveA vec4(0.5, 0.5, 0.05, 21.0)
#define _WaveB vec4(0.5, 0.41, 0.06, 16.1)
#define _WaveC vec4(0.5, 0.32, 0.05, 12.2)
#define _WaveD vec4(0.5, 0.23, 0.05, 10.3)
#define _WaveE vec4(0.5, 0.24, 0.05, 6.4)
#define _WaveF vec4(0.5, 0.25, 0.05, 4.5)
#define _WaveG vec4(0.5, 0.16, 0.05, 2.6)
#define _WaveH vec4(0.5, 0.27, 0.05, 1.7)
#define _WaveI vec4(0.5, 0.38, 0.05, 0.8)

#define _WaveBend 0.1
#define _WaveBendLength 0.1
#define _WaveShape 0.4
#define _WaveAmp 0.8
#define _WaveScale 2.0

vec3 GerstnerWave(
    vec4 wave, vec3 p, inout vec3 tangent, inout vec3 binormal, inout float peak
) {

  wave.w *= _WaveScale;
  p.x += sin(p.z / wave.w / _WaveBendLength) * wave.w * _WaveBend;

  vec2 d = normalize(wave.xy);

  float steepness = wave.z;
  float wavelength = wave.w;
  float k = 2. * PI / wavelength;
  float c = sqrt(9.8 / k);
  
  float f = k * (dot(d, p.xz) - c * u_time);
  float a = steepness / (k * _WaveShape);

  float sinf = sin(f);
  float cosf = cos(f);
  float ssinf = steepness * sinf;
  float scosf = steepness * cosf;

  peak += ssinf;

  tangent += vec3(
    -d.x * d.x * ssinf,
    d.x * scosf,
    -d.x * d.y * ssinf
  );
  binormal += vec3(
    -d.x * d.y * ssinf,
    d.y * scosf,
    -d.y * d.y * ssinf
  );
  return vec3(
    d.x * (a * cosf),
    a * sinf,
    d.y * (a * cosf)
  );
}

vec2 triplanar(vec3 normal, vec3 position) {
  vec3 absNormal = abs(normal);
  vec3 weights = absNormal / (absNormal.x + absNormal.y + absNormal.z);
  vec2 uvX = position.yz;
  vec2 uvY = position.xz;
  vec2 uvZ = position.xy;
  return uvX * weights.x + uvY * weights.y + uvZ * weights.z;
}

vec3 getTangent(vec3 normal) {
  // Choose a helper vector that is not parallel to the normal
  // If normal is effectively parallel to world-up (0,1,0), use world-right (1,0,0)
  vec3 helper = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  
  // Generate tangent
  vec3 tangent = normalize(cross(normal, helper));
  
  return tangent;
}

void main() {
  #ifdef USE_INSTANCING
    mat4 mMatrix = modelMatrix * instanceMatrix;
    mat4 mvMatrix = viewMatrix * modelMatrix;
  #else
    mat4 mMatrix = modelMatrix;
    mat4 mvMatrix = modelViewMatrix;
  #endif

  vec4 normalWS = normalize( mMatrix * vec4(normal, 0.0) );
  vec3 tangentWS = getTangent(normalWS.xyz);
  vec3 binormalWS = -normalize(cross(normalWS.xyz, tangentWS));

  //vec4 normalWS = vec4(0., 1., 0., 0.);
  //vec4 tangentWS = vec4(1. ,0. ,0., 0.);
  //vec3 binormalWS = vec3(0., 0., 1.);
  vec4 posWS = mMatrix * vec4(position, 1.0);

  // Determine uv based on the original normal and position
  vUv = triplanar(normalWS.xyz, posWS.xyz);

  float peak = 0.0;  
  vPositionOffset = vec3(0., 0., 0.);
  vPositionOffset += GerstnerWave(_WaveA, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveB, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveC, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveD, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveE, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveF, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveG, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveH, posWS.xyz, tangentWS, binormalWS, peak);
  vPositionOffset += GerstnerWave(_WaveI, posWS.xyz, tangentWS, binormalWS, peak);
  posWS.xyz += vPositionOffset;

  normalWS.xyz = normalize(cross(binormalWS, tangentWS));

  vNormalWS = normalWS.xyz;
  vPositionWS = posWS.xyz;

  vec4 normalVS = viewMatrix * normalWS;
  vNormal = normalVS.xyz;

  vColor = color;

  vec4 posVS = viewMatrix * posWS;
  vPosition = posVS.xyz;

  vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
  vec4 previousPosVS = previousViewMatrix * previousPosWS;
  vPreviousPositionCS = projectionMatrix * previousPosVS;

  gl_Position = projectionMatrix * posVS;

  vPositionCS = gl_Position;
}
`;

export const datalakeMaterialInstanced = new THREE.ShaderMaterial({
  name: "DatalakeMaterial",
  vertexShader: datalakeShaderVS,
  fragmentShader: datalakeShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
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

export const datalakeMaterial = new THREE.ShaderMaterial({
  name: "DatalakeMaterial",
  vertexShader: datalakeShaderVS,
  fragmentShader: datalakeShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
    u_time: { value: 0.0 },
    textProjectionMatrix: { value: new THREE.Matrix4() },
    textViewMatrix: { value: new THREE.Matrix4() },
    cameraPositionWS: { value: new THREE.Vector3() },
    near: { value: 0.1 },
    far: { value: 1000 },
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
    attributes: [{ name: "color", size: 3 }],
  },
});

datalakeMaterialInstanced.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // iceMaterial.uniforms.u_time.value = beat;
  datalakeMaterialInstanced.uniforms.cameraPositionWS.value.copy(camera.position);
  datalakeMaterialInstanced.uniforms.u_time.value = performance.now() / 1000;
  datalakeMaterialInstanced.uniforms.near.value = camera.near;
  datalakeMaterialInstanced.uniforms.far.value = camera.far;
}


datalakeMaterial.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, group) => {
  // const t = player.currentTime;
  // const bpm = player.bpm;
  // const bps = bpm / 60;
  // const beat = Math.floor(2 * t * bps);
  // iceMaterial.uniforms.u_time.value = beat;
  datalakeMaterial.uniforms.cameraPositionWS.value.copy(camera.position);
  datalakeMaterial.uniforms.u_time.value = performance.now() / 1000;
  datalakeMaterial.uniforms.near.value = camera.near;
  datalakeMaterial.uniforms.far.value = camera.far;
}
