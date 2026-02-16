import * as THREE from 'three';

const rtShaderFS = /* glsl */ `
precision highp float;

layout (location = 0) out vec4 gColorAo;
layout (location = 1) out vec4 gNormalRoughness;
layout (location = 2) out vec4 gPositionMetalness;
layout (location = 3) out vec4 gEmission;
layout (location = 4) out vec4 gVelocity;

in vec3 vPositionOS;
in vec3 vPositionWS;
in vec2 vUv;
in vec4 vPositionCS;
in vec4 vPreviousPositionCS;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float near;
uniform float far;
uniform vec3 cameraPositionOS;
uniform float u_time;

struct HitData {
    vec3 position;
    vec3 normal;
    vec3 albedo;
    float metalness;
    float roughness;
    vec3 emissive;
    bool isHit;
};

float sphereSDF(vec3 p, float r) {
    p += sin(u_time + p.y * 6.0) * 0.05;
    // p.y += sin(u_time + p.x * 3.0) * 0.03;

    return length(p) - r;
}

float sceneSDF(vec3 p) {
    return sphereSDF(p, 3.0);
}

vec3 estimateNormal(vec3 p) {
    const vec3 eps = vec3(0.005, 0.0, 0.0);
    return normalize(vec3(
        sceneSDF(p + eps.xyy) - sceneSDF(p - eps.xyy),
        sceneSDF(p + eps.yxy) - sceneSDF(p - eps.yxy),
        sceneSDF(p + eps.yyx) - sceneSDF(p - eps.yyx)
    ));
}

HitData raymarch(vec3 origin, vec3 direction) {
    HitData hitData;
    hitData.position = vec3(0.0);
    hitData.normal = vec3(0.0);
    hitData.albedo = vec3(1.0);
    hitData.metalness = 0.0;
    hitData.roughness = 0.15;
    hitData.emissive = vec3(0.0);
    hitData.isHit = false;

    for (int i = 0; i < 256; i++) {
        float dist = sceneSDF(origin);
        if (dist < 0.001) {
            hitData.position = origin;
            hitData.isHit = true;
            hitData.normal = estimateNormal(origin);
            break;
        } else if (dist > 10.0) {
            break;
        }
        origin += direction * dist;
    }

    return hitData;
}

void main() {

    vec3 origin = vPositionOS;
    vec3 direction = normalize(vPositionOS - cameraPositionOS);

    HitData hitData = raymarch(origin, direction);

    if (!hitData.isHit) {
        discard;
    }

    vec3 normalVS = (modelViewMatrix * vec4(hitData.normal, 0.0)).xyz;
    vec3 positionVS = (modelViewMatrix * vec4(hitData.position, 1.0)).xyz;
    vec3 diffuse = hitData.albedo;
    vec3 emissive = hitData.emissive;
  
    vec3 currentPosNDC = vPositionCS.xyz / vPositionCS.w;
    vec3 previousPosNDC = vPreviousPositionCS.xyz / vPreviousPositionCS.w;
    vec2 velocity = currentPosNDC.xy - previousPosNDC.xy;
  
    float ao = 1.0;
    float roughnessM = hitData.roughness;
    float metalnessM = hitData.metalness;
  
    gColorAo = vec4(diffuse, ao);
    gNormalRoughness = vec4(normalVS, roughnessM);
    gPositionMetalness = vec4(positionVS, metalnessM);
    gEmission = vec4(emissive, 0.0);
    gVelocity = vec4(velocity, 0.0, 0.0);

    /* Depth
    float ze = positionVS.z;
    float zc = -ze * (far+near)/(far-near) - 2.0*far*near/(far-near);
    float wc = -ze;

    float zn = zc / wc;

    float a = (far + near) / (far - near);
    float b = 2.0 * far * near / (far - near);
    
    gl_FragDepth = a + b / zn;*/
}
`;

const rtShaderVS = /* glsl */ `
precision highp float;

uniform mat4 previousWorldMatrix;
uniform mat4 previousViewMatrix;

out vec2 vUv;
out vec3 vPositionOS;
out vec3 vPositionWS;
out vec4 vPositionCS;
out vec4 vPreviousPositionCS;

out vec3 vNormal;

void main() { 
    vNormal = (viewMatrix * modelMatrix * vec4(normal, 0.0)).xyz;

    vUv = uv;

    vec4 posWS = modelMatrix * vec4(position, 1.0);

    vPositionOS = position;

    vec4 posVS = viewMatrix * posWS;

    vec4 previousPosWS = previousWorldMatrix * vec4(position, 1.0);
    vec4 previousPosVS = previousViewMatrix * previousPosWS;
    vPreviousPositionCS = projectionMatrix * previousPosVS;

    gl_Position = projectionMatrix * posVS;

    vPositionCS = gl_Position;
}
`;

export const basicRtMaterial = new THREE.ShaderMaterial({
    vertexShader: rtShaderVS,
    fragmentShader: rtShaderFS,
    uniforms: {
        previousWorldMatrix: { value: new THREE.Matrix4() },
        previousViewMatrix: { value: new THREE.Matrix4() },
        cameraPositionOS: { value: new THREE.Vector3() },
        near: { value: 0.1 },
        far: { value: 1000 },
        u_time: { value: 0.0 },
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
});

basicRtMaterial.onBeforeRender = (renderer, scene, camera: THREE.PerspectiveCamera, geometry, object, group) => {
    basicRtMaterial.uniforms.previousViewMatrix.value.copy(camera.userData.previousViewMatrix);
    basicRtMaterial.uniforms.previousWorldMatrix.value.copy(object.userData.previousWorldMatrix);
    basicRtMaterial.uniforms.cameraPositionOS.value.copy(object.worldToLocal(camera.position.clone()));
    basicRtMaterial.uniforms.u_time.value = performance.now() / 1000;
    basicRtMaterial.uniforms.near.value = camera.near;
    basicRtMaterial.uniforms.far.value = camera.far;
}