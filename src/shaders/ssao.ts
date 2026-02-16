import * as THREE from "three";
import { screenVS } from "./screenVS";

const ssaoShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D gColorAo;
uniform sampler2D gNormalRoughness;
uniform sampler2D gPositionMetalness;
uniform sampler2D noiseTexture;

uniform vec2 u_resolution;
const int kernelSize = 32;
uniform vec3 ssaoKernel[kernelSize];
uniform mat4 projection;

layout (location = 0) out vec4 ao;

const float radius = 1.0;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  /// vec4 colorAo = texture(gColorAo, uv);
  vec3 positionVS = texture(gPositionMetalness, uv).xyz;
  vec3 normalVS = texture(gNormalRoughness, uv).xyz;
  vec2 noiseScale = u_resolution / vec2(12.0);
  vec3 randomVec = texture(noiseTexture, uv * noiseScale).xyz;

  vec3 tangent   = normalize(randomVec - normalVS * dot(randomVec, normalVS));
  vec3 bitangent = cross(normalVS, tangent);
  mat3 TBN       = mat3(tangent, bitangent, normalVS);

  float occlusion = 0.0;
  for (int i = 0; i < kernelSize; i++) {
    // get sample position
    vec3 samplePosVS = TBN * ssaoKernel[i]; // from tangent to view-space

    samplePosVS = positionVS + samplePosVS * radius;
  
    vec4 offsetCS = projection * vec4(samplePosVS, 1.0);

    offsetCS.xyz /= offsetCS.w;               // perspective divide
    offsetCS.xyz  = offsetCS.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0

    float depth = texture(gPositionMetalness, offsetCS.xy).z;
    float rangeCheck = smoothstep(0.0, 1.0, radius / abs(positionVS.z - depth));

    float bias = 0.025;
    occlusion += (depth >= samplePosVS.z + bias ? 1.0 : 0.0) * rangeCheck;
  }

  occlusion = 1.0 - occlusion / float(kernelSize);

  ao = vec4(vec3(occlusion), 1.0);
}
`;

export const ssaoShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: ssaoShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  uniforms: {
    gColorAo: { value: null },
    gNormalRoughness: { value: null },
    gPositionMetalness: { value: null },
    noiseTexture: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    ssaoKernel: { value: new Float32Array(16 * 3) },
    projection: { value: new THREE.Matrix4() },
  },
});
