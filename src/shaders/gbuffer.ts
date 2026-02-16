import * as THREE from "three";
import { AttributeDesc } from "../types";

/**
 * G-Buffer shader
 */

const gBufferShaderVS = /* glsl */ `
precision highp float;

#ifdef USE_INSTANCING
in vec3 color;
in vec3 emissive;
#endif
layout (location = 3) in vec3 tangent;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

out vec2 vUv;
out vec3 vPosition;

#ifdef USE_INSTANCING
out vec3 vColor;
out vec3 vEmissive;
#endif

out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

#ifdef USE_NORMAL_MAP
out mat3 TBN;
#else
out vec3 vNormal;
#endif

void main() {
  #ifdef USE_INSTANCING
  mat4 mMatrix = modelMatrix * instanceMatrix;
  mat4 mvMatrix = viewMatrix * mMatrix;
  #else
  mat4 mMatrix = modelMatrix;
  mat4 mvMatrix = modelViewMatrix;
  #endif

  #ifdef USE_NORMAL_MAP
  vec3 T = normalize(vec3(mvMatrix * vec4(tangent,   0.0)));
  vec3 N = normalize(vec3(mvMatrix * vec4(normal,    0.0)));
  // re-orthogonalize T with respect to N
  T = normalize(T - dot(T, N) * N);
  // then retrieve perpendicular vector B with the cross product of T and N
  vec3 B = cross(N, T);
  TBN = mat3(T, B, N);
  #else
  vNormal = (mvMatrix * vec4(normal, 0.0)).xyz;
  #endif

  vUv = uv;

  vec4 posVS = mvMatrix * vec4(position, 1.0);
  vPosition = posVS.xyz;

  vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
  vec4 previousPosVS = previousViewMatrix * previousPosWS;
  vPreviousPositionCS = projectionMatrix * previousPosVS;

  gl_Position = projectionMatrix * posVS;

  vPositionCS = gl_Position;

  #ifdef USE_INSTANCING
  vColor = color;
  vEmissive = emissive;
  #endif
}
`;

const gBufferShaderFS = /* glsl */ `
precision highp float;

layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec3 vPosition;
in vec2 vUv;
in vec4 vPositionCS;
in vec4 vPreviousPositionCS;

#ifdef USE_INSTANCING
in vec3 vColor;
in vec3 vEmissive;
#endif

#ifdef USE_NORMAL_MAP
in mat3 TBN;
#else
in vec3 vNormal;
#endif

#ifdef USE_MAP
uniform sampler2D map;
#else
uniform vec3 color;
#endif

#ifdef USE_NORMAL_MAP
uniform sampler2D normalMap;
#endif

#ifdef USE_ORM_MAP
uniform sampler2D roughnessMap; // Actually ORM
#else
uniform float roughness;
uniform float metalness;
#endif

#ifdef USE_EMISSION_MAP
uniform sampler2D emissiveMap;
#else
uniform vec3 emissive;
#endif
uniform float emissiveIntensity;

void main() {
  #ifdef USE_MAP
  vec3 diffuse = texture(map, vUv).rgb;
  #else
  #ifdef USE_INSTANCING
  vec3 diffuse = vColor;
  vec3 emissive0 = vEmissive;
  #else
  vec3 diffuse = color;
  vec3 emissive0 = emissive;
  #endif
  #endif

  #ifdef USE_NORMAL_MAP
  vec3 normal = texture(normalMap, vUv).xyz * 2.0 - 1.0;
  normal = normalize(TBN * normal);
  #else
  vec3 normal = normalize(vNormal);
  #endif

  #ifdef USE_ORM_MAP
  vec3 orm = texture(roughnessMap, vUv).rgb;
  orm.b = 1.0 - orm.b; // Invert metalness value coming from texture
  #else
  vec3 orm = vec3(1.0, roughness, metalness);
  #endif

  #ifdef USE_EMISSION_MAP
  vec3 emissive0 = texture(emissiveMap, vUv).rgb;
  #endif

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
  gEmission = vec4(1.0 * emissive0, 0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

export const getVariantKey = (
  useMap: boolean,
  useNormalMap: boolean,
  useOrmMap: boolean,
  useEmissionMap: boolean,
  useInstancing: boolean,
) => {
  return (
    (useInstancing ? 16 : 0) |
    (useMap ? 8 : 0) |
    (useNormalMap ? 4 : 0) |
    (useOrmMap ? 2 : 0) |
    (useEmissionMap ? 1 : 0)
  );
};

export const gBufferShaderVariants: Record<number, THREE.ShaderMaterial> = {};

(() => {
  // Five bits for USE_MAP, USE_NORMAL_MAP, USE_ORM_MAP, USE_EMISSION_MAP, USE_INSTANCING
  for (let use_map = 0; use_map < 2; use_map++) {
    for (let use_normal_map = 0; use_normal_map < 2; use_normal_map++) {
      for (let use_orm_map = 0; use_orm_map < 2; use_orm_map++) {
        for (
          let use_emission_map = 0;
          use_emission_map < 2;
          use_emission_map++
        ) {
          for (let use_instancing = 0; use_instancing < 2; use_instancing++) {
            const key = getVariantKey(
              !!use_map,
              !!use_normal_map,
              !!use_orm_map,
              !!use_emission_map,
              !!use_instancing,
            );

            const defines: Record<string, string> = {};
            const materialKeys: string[] = [];
            const uniforms: Record<string, THREE.IUniform> = {
              previousWorldMatrix: { value: new THREE.Matrix4() },
              previousViewMatrix: { value: new THREE.Matrix4() },
            };

            const addMaterialKey = (key: string, value: any) => {
              materialKeys.push(key);
              uniforms[key] = { value };
            };

            if (use_map) {
              defines.USE_MAP = "";
              addMaterialKey("map", null);
            } else {
              addMaterialKey("color", new THREE.Color());
            }
            if (use_normal_map) {
              defines.USE_NORMAL_MAP = "";
              addMaterialKey("normalMap", null);
            }
            if (use_orm_map) {
              defines.USE_ORM_MAP = "";
              addMaterialKey("roughnessMap", null);
            } else {
              addMaterialKey("roughness", 0.001);
              addMaterialKey("metalness", 0.0);
            }
            if (use_emission_map) {
              defines.USE_EMISSION_MAP = "";
              addMaterialKey("emissiveMap", null);
            } else {
              addMaterialKey("emissive", new THREE.Color());
            }
            if (use_instancing) {
              defines.USE_INSTANCING = "";
            }
            addMaterialKey("emissiveIntensity", 1.0);

            gBufferShaderVariants[key] = new THREE.ShaderMaterial({
              vertexShader: gBufferShaderVS,
              fragmentShader: gBufferShaderFS,
              side: THREE.FrontSide,
              glslVersion: "300 es",
              depthWrite: true,
              stencilWrite: true,
              stencilFunc: THREE.AlwaysStencilFunc,
              stencilZPass: THREE.ReplaceStencilOp,
              stencilFail: THREE.ReplaceStencilOp,
              stencilZFail: THREE.ReplaceStencilOp,
              stencilFuncMask: 0xff,
              stencilWriteMask: 0xff,
              stencilRef: 1,
              defines,
              uniforms,
              userData: {
                materialKeys,
              },
              name: Object.keys(defines).join(", "),
            });
          }
        }
      }
    }
  }

  console.log("G-Buffer shader variants", gBufferShaderVariants);
})();

export const gBufferShaderAttributes: AttributeDesc[] = [
  { name: "color", size: 3 },
  { name: "emissive", size: 3 },
];
