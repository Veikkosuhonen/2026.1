import * as THREE from "three";
import { screenVS } from "./screenVS";

/**
 * Partially adapted from https://github.com/RoundedGlint585/ScreenSpaceReflection/blob/master/shaders/SSRFragment.glsl
 */
const ssrShaderFS1 = /* glsl */ `
precision highp float;

#define BINARYSEARCH
#define ADAPTIVE_STEP
#define EXPONENTIAL_STEP

#define RANDOM_SCALE vec4(443.897, 441.423, .0973, .1099)

uniform sampler2D reflectionSource0;
uniform sampler2D reflectionSource1;
uniform sampler2D gColorAo;
uniform sampler2D gNormalRoughness;
uniform sampler2D gPositionMetalness;
uniform sampler2D brdfLUT;
uniform mat4 projection;
uniform mat4 inverseProjection;
uniform vec2 resolution;
uniform float u_time;

layout (location = 0) out vec4 FragColor;

vec3 random3(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * RANDOM_SCALE.xyz);
  p3 += dot(p3, p3.yxz + 19.19);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

const int STEPS = 20;
const int STEPS2 = 30;

const float RAY_STEP = 0.4;
const float BIAS = 0.05;
const int N_SAMPLES = 4;

vec2 vsToScreen(vec3 positionVS) {
  vec4 clipSpacePosition = projection * vec4(positionVS, 1.0);
  vec4 ndc = clipSpacePosition / clipSpacePosition.w;
  return (ndc.xy * 0.5 + 0.5);
}

vec4 SSR(vec3 positionVS, vec3 reflection) {
  vec3 iterStep = RAY_STEP * reflection;
  // Scale iterStep so it's always the same length in screen space
  iterStep /= length(reflection.xy);


  vec3 marchingPosition = positionVS + iterStep;
  float delta = 0.0;
  float depthFromScreen = 0.0;
  vec2 screenPosition = vec2(0.0);

  int i = 0;
  for (; i < STEPS; i++) {
    screenPosition = vsToScreen(marchingPosition);

    if (screenPosition.x < 0.0 || screenPosition.x > 1.0 || screenPosition.y < 0.0 || screenPosition.y > 1.0) {
      return vec4(0.0);
    }


    depthFromScreen = abs(texture(gPositionMetalness, screenPosition).z);
    delta = abs(marchingPosition.z) - depthFromScreen;

    if (abs(delta) < BIAS) {
      return vec4(screenPosition, distance(positionVS, marchingPosition), 1.0);
    }

    #ifdef BINARYSEARCH
    if (delta > 0.0) {
      break;
    }
    #endif

    #ifdef ADAPTIVE_STEP
      float directionSign = sign(abs(marchingPosition.z) - depthFromScreen);
      //this is sort of adapting step, should prevent lining reflection by doing sort of iterative converging
      //some implementation doing it by binary search, but I found this idea more cheaty and way easier to implement
      iterStep = iterStep * (1.0 - RAY_STEP * max(directionSign, 0.0));
      marchingPosition += iterStep * (-directionSign);
    #else
      marchingPosition += iterStep;
    #endif

    #ifdef EXPONENTIAL_STEP
      iterStep *= 1.05;
    #endif
  }

  #ifdef BINARYSEARCH
    for(; i < STEPS2; i++){
      iterStep *= 0.5;
      marchingPosition = marchingPosition - iterStep * sign(delta);
      
      screenPosition = vsToScreen(marchingPosition);
      depthFromScreen = abs(texture(gPositionMetalness, screenPosition).z);
      delta = abs(marchingPosition.z) - depthFromScreen;

      if (abs(delta) < BIAS) {
        return vec4(screenPosition, distance(positionVS, marchingPosition), 1.0);
      }
    }
  #endif

  return vec4(0.0);
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  vec3 albedo = texture(gColorAo, uv).rgb;
  vec4 normalRoughness = texture(gNormalRoughness, uv);
  vec4 positionMetalness = texture(gPositionMetalness, uv);
  float metalness = positionMetalness.w;
  float roughness = normalRoughness.w;

  if (roughness > 0.4) {
    FragColor = vec4(0.0);
    return;
  }

  vec3 positionVS = positionMetalness.xyz;
  vec3 N = normalize(normalRoughness.xyz);

  vec3 V = normalize(-positionVS.xyz);

  vec3 R = normalize(reflect(-V, N));

  vec3 reflectionColor = vec3(0.0);
  float hits = 0.0;
  float avgDist = 0.0;

  for (int i = 0; i < N_SAMPLES; i++) {
    vec2 jitterSeed = uv + float(i) + u_time * 0.1;
    vec3 jitter = roughness * roughness * (2.0 * random3(jitterSeed).xyz - 1.0);
    vec3 sampleReflection = normalize(R + jitter);
    vec4 ssrResult = SSR(positionVS, sampleReflection);
    vec2 screenPos = ssrResult.xy;
    float dist = ssrResult.z;
    float hit = ssrResult.w;

    if (hit == 0.0) {
      continue;
    }

    vec3 hitColor = texture(reflectionSource0, screenPos).rgb + texture(reflectionSource1, screenPos).rgb;

    reflectionColor += hitColor;
    hits += 1.0;
    avgDist += dist;
  }

  if (hits == 0.0) {
    FragColor = vec4(0.0);
    return;
  }

  reflectionColor /= hits;

  float NdotV = max(dot(N, V), 0.0);

  // Cook-Torrance BRDF
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, albedo, metalness);

  vec3 kS = fresnelSchlickRoughness(NdotV, F0, roughness);

  vec2 envBRDF = texture(brdfLUT, vec2(NdotV, roughness)).rg;
  vec3 ssrSpecular = reflectionColor * (kS * envBRDF.x + envBRDF.y);

  FragColor = vec4(ssrSpecular, hits/float(N_SAMPLES));
}
`;

export const ssrShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: ssrShaderFS1,
  side: THREE.FrontSide,
  glslVersion: "300 es",

  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,

  uniforms: {
    reflectionSource0: { value: null },
    reflectionSource1: { value: null },
    gColorAo: { value: null },
    gNormalRoughness: { value: null },
    gPositionMetalness: { value: null },
    brdfLUT: { value: null },
    resolution: { value: new THREE.Vector2() },
    u_time: { value: 0.0 },
    projection: { value: new THREE.Matrix4() },
    inverseProjection: { value: new THREE.Matrix4() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
  },
});

const ssrResolveShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D ssr;
uniform sampler2D specular;
uniform vec2 resolution;

out vec4 FragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  vec4 ssr = texture(ssr, uv);

  vec4 specular = texture(specular, uv);

  float ssrContribution = ssr.a;

  vec3 color = mix(specular.rgb, ssr.rgb, ssrContribution);

  FragColor = vec4(color, 1.0);
}
`;

export const ssrResolveShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: ssrResolveShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",

  depthTest: false,
  depthWrite: false,
  transparent: true,
  blending: THREE.AdditiveBlending,

  stencilWrite: true,
  stencilFunc: THREE.EqualStencilFunc,
  stencilZPass: THREE.KeepStencilOp,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilFuncMask: 0xff,
  stencilWriteMask: 0xff,
  stencilRef: 1,

  uniforms: {
    ssr: { value: null },
    specular: { value: null },
    resolution: { value: new THREE.Vector2() },
  },
});