import * as THREE from "three";
import { screenVS } from "./screenVS";

/**
 * Partially adapted from https://github.com/RoundedGlint585/ScreenSpaceReflection/blob/master/shaders/SSRFragment.glsl
 */
const ssrShaderFS1 = /* glsl */ `
precision highp float;

#define RANDOM_SCALE vec4(443.897, 441.423, .0973, .1099)

uniform sampler2D reflectionSource;
uniform sampler2D gColorAo;
uniform sampler2D gNormalRoughness;
uniform sampler2D gPositionMetalness;
uniform sampler2D velocity;
uniform sampler2D brdfLUT;
uniform mat4 projection;
uniform mat4 inverseProjection;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 resolution;
uniform float u_time;

layout (location = 0) out vec4 FragColor;

vec3 random3(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * RANDOM_SCALE.xyz);
  p3 += dot(p3, p3.yxz + 19.19);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

const int MAX_STEPS = 200;

const int N_SAMPLES = 0;

float pointToLineDistance(vec3 x0, vec3 x1, vec3 x2) {
  //x0: point, x1: linePointA, x2: linePointB
  //https://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
  return length(cross(x0 - x1, x0 - x2)) / length(x2 - x1);
}

float pointPlaneDistance(vec3 point, vec3 planePoint, vec3 planeNormal){
  // https://mathworld.wolfram.com/Point-PlaneDistance.html
  //// https://en.wikipedia.org/wiki/Plane_(geometry)
  //// http://paulbourke.net/geometry/pointlineplane/
  float a = planeNormal.x, b = planeNormal.y, c = planeNormal.z;
  float x0 = point.x, y0 = point.y, z0 = point.z;
  float x = planePoint.x, y = planePoint.y, z = planePoint.z;
  float d =- (a * x + b * y + c * z);
  float distance = (a * x0 + b * y0 + c * z0 + d) / sqrt(a * a + b * b + c * c);
  return distance;
}

vec2 viewPositionToXY(vec3 viewPosition) {
  vec2 xy;
  vec4 clip = projection * vec4(viewPosition, 1);
  xy = clip.xy;//clip
  float clipW = clip.w;
  xy /= clipW;//NDC
  xy = (xy + 1.) / 2.;//uv
  xy *= resolution;//screen
  return xy;
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

struct HitData {
  vec2 screenPos;
  float isHit;
};

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;

  vec3 albedo = texture(gColorAo, uv).rgb;
  vec4 normalRoughness = texture(gNormalRoughness, uv);
  vec4 positionMetalness = texture(gPositionMetalness, uv);
  float metalness = positionMetalness.w;
  float roughness = normalRoughness.w;

  if (roughness > 0.5) {
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
    // vec2 jitterSeed = uv + float(i) + u_time * 0.01;
    // vec3 jitter = roughness * roughness * (2.0 * random3(jitterSeed).xyz - 1.0);
    vec3 sampleReflection = normalize(R);

    HitData hitData = HitData(vec2(0.0), 0.0);

    vec3 viewPosition = positionVS;

    vec2 d0 = gl_FragCoord.xy;
    vec2 d1;

    vec3 viewNormal = N;

    vec3 viewIncidentDir = normalize(viewPosition);
    vec3 viewReflectDir = sampleReflection;

    const float maxDistance = 180.0;
    float maxReflectRayLen = maxDistance / dot(-viewIncidentDir, viewNormal);

    vec3 d1viewPosition = viewPosition + viewReflectDir * maxReflectRayLen;

    if(d1viewPosition.z > -cameraNear){
      //https://tutorial.math.lamar.edu/Classes/CalcIII/EqnsOfLines.aspx
      float t = (-cameraNear - viewPosition.z) / viewReflectDir.z;
      d1viewPosition = viewPosition + viewReflectDir * t;
    }

    d1 = viewPositionToXY(d1viewPosition);

    float totalLen = length(d1 - d0);
    float xLen = d1.x - d0.x;
    float yLen = d1.y - d0.y;
    float totalStep = max(abs(xLen), abs(yLen));
    float xSpan = 8.0 * xLen / totalStep;
    float ySpan = 8.0 * yLen / totalStep;

    for (float i = 0.0; i < float(MAX_STEPS); i++) {
      if (i >= totalStep) break;
      vec2 xy = vec2(d0.x + i * xSpan, d0.y + i * ySpan);
      if(xy.x < 0. || xy.x > resolution.x || xy.y < 0. || xy.y > resolution.y) break;
      float s = length(xy - d0) / totalLen;
      vec2 uv = xy / resolution;

      vec3 vP = texture(gPositionMetalness, uv).xyz;
      float vZ = vP.z;
      // if (vZ >= cameraFar) continue;
      float cW = projection[2][3] * vZ + projection[3][3];

      float recipVPZ = 1. / viewPosition.z;
      float viewReflectRayZ = 1. / (recipVPZ + s * (1. / d1viewPosition.z - recipVPZ));

      float away = pointToLineDistance(vP, viewPosition, d1viewPosition);

      // float minThickness;
      // vec2 xyNeighbor = xy;
      // xyNeighbor.x += 1.;
      // vec2 uvNeighbor = xyNeighbor / resolution;
      // vec3 vPNeighbor = texture(gPositionMetalness, uvNeighbor).xyz;
      // minThickness = vPNeighbor.x - vP.x;
      // minThickness *= 3.;

      const float thickness = 0.1;
      //float tk = max(minThickness, thickness);

      bool hit = away <= thickness;

      if (hit) {
        vec3 vN = normalize(texture(gNormalRoughness, uv).xyz);
        if (dot(viewReflectDir, vN) >= 0.0) continue;
        // float distance = pointPlaneDistance(vP, viewPosition, viewNormal);
        // if (distance > maxDistance) break;

        hitData.screenPos = uv;
        hitData.isHit = 1.0;
        break;
      }
    }

    if (hitData.isHit == 0.0) {
      continue;
    }

    vec2 reflectionUv = hitData.screenPos - texture(velocity, hitData.screenPos).xy;
    vec3 hitColor = texture(reflectionSource, hitData.screenPos).rgb;

    reflectionColor += hitColor;
    hits += 1.0;
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
    reflectionSource: { value: null },
    gColorAo: { value: null },
    gNormalRoughness: { value: null },
    gPositionMetalness: { value: null },
    velocity: { value: null },
    brdfLUT: { value: null },
    resolution: { value: new THREE.Vector2() },
    u_time: { value: 0.0 },
    projection: { value: new THREE.Matrix4() },
    inverseProjection: { value: new THREE.Matrix4() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
  },
});

ssrShader.onBeforeRender = (
  renderer,
  scene,
  camera: THREE.PerspectiveCamera,
) => {
  ssrShader.uniforms.cameraNear.value = camera.near;
  ssrShader.uniforms.cameraFar.value = camera.far;
};

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
