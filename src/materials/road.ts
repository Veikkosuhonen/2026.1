import * as THREE from "three";

const roadShaderFS = /* glsl */ `
precision highp float;

layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec3 vPositionOS;
in float vWidth;
in float vLength;
in vec3 vPosition;
in vec3 vPositionWS;
in vec4 vPositionCS;
in vec4 vPreviousPositionCS;
in vec3 vNormal;
in vec3 vNormalWS;
in vec3 vColor;

// uniform float emissiveIntensity;
// uniform vec3 emissive;

void main() {
  vec3 diffuse = vec3(0.4);

  float distToCenter = abs(vPositionOS.z) * vWidth;
  float distAlongRoad = abs(vPositionOS.x) * vLength;

  float markingWidth = 0.15;
  // Center line
  float centerLine = smoothstep(markingWidth * 1.1, markingWidth, distToCenter);

  // Lane markings
  float laneMarking = step(fract(distToCenter / 3.0), 0.06) * step(markingWidth, distToCenter);
  laneMarking *= step(0.4, fract(distAlongRoad * 0.2));

  diffuse = mix(diffuse, vec3(1.0, 1.0, 1.0), centerLine);
  diffuse = mix(diffuse, vec3(1.0, 1.0, 1.0), laneMarking);

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
  gEmission = vec4(0.0, 0.0, 0.0,0.0);
  gVelocity = vec4(velocity, 0.0, 0.0);
}
`;

const roadShaderVS = /* glsl */ `
precision highp float;

in vec3 tangent;
in float width;
in float length;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

out vec3 vPositionOS;
out vec3 vPosition;
out float vWidth;
out float vLength;
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

  vWidth = width;
  vLength = length;

  vPositionOS = position;
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

export const roadMaterial = new THREE.ShaderMaterial({
  name: "RoadMaterial",
  vertexShader: roadShaderVS,
  fragmentShader: roadShaderFS,
  uniforms: {
    previousWorldMatrix: { value: new THREE.Matrix4() },
    previousViewMatrix: { value: new THREE.Matrix4() },
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
      { name: "width", size: 1 },
      { name: "length", size: 1 },
    ],
  },
});
