import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/Addons.js';

const BRDF_LUT_SIZE = 512;
const BRDF_LUT_CACHE_KEY = `brdfLUT_v1_${BRDF_LUT_SIZE}`;

const canUseLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

const encodeBytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const loadBrdfLUTFromCache = () => {
  if (!canUseLocalStorage()) return null;

  const cached = window.localStorage.getItem(BRDF_LUT_CACHE_KEY);
  if (!cached) return null;

  try {
    const bytes = decodeBase64ToBytes(cached);
    if (bytes.length !== BRDF_LUT_SIZE * BRDF_LUT_SIZE * 4) return null;

    const texture = new THREE.DataTexture(
      bytes,
      BRDF_LUT_SIZE,
      BRDF_LUT_SIZE,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.flipY = false;
    texture.needsUpdate = true;

    return texture;
  } catch {
    return null;
  }
};

const saveBrdfLUTToCache = (bytes: Uint8Array) => {
  if (!canUseLocalStorage()) return;

  try {
    const encoded = encodeBytesToBase64(bytes);
    window.localStorage.setItem(BRDF_LUT_CACHE_KEY, encoded);
  } catch {
    // Ignore cache write failures (quota, private mode, etc.)
  }
};

export const equirectToCube = (renderer: THREE.WebGLRenderer, equirect: THREE.Texture, size: number) => {
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(size);
  return cubeRenderTarget.fromEquirectangularTexture(renderer, equirect);
};

export const cubeToIrradiance = (renderer: THREE.WebGLRenderer, cubeMap: THREE.CubeTexture, size: number) => {
  const start = performance.now();

  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(size);
  const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);

  irradianceShader.uniforms.envMap.value = cubeMap;
  irradianceShader.uniforms.exposure.value = 0.1;
  irradianceShader.uniformsNeedUpdate = true;

  const scene = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), irradianceShader);
  scene.add(box);

  cubeCamera.update(renderer, scene);

  console.log('irradiance map', (performance.now() - start).toFixed(1), "ms");

  return cubeRenderTarget;
}

const irradianceShader = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  side: THREE.BackSide,
  uniforms: {
    envMap: { value: null },
    exposure: { value: 1.0 },
  },
  vertexShader: /* glsl */ `

out vec3 vPosition;

void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,

  fragmentShader: /* glsl */ `

precision highp float;

in vec3 vPosition;

out vec4 FragColor;

uniform samplerCube envMap;
uniform float exposure;

const float PI = 3.14159265359;

void main() {
  vec3 normal = normalize(vPosition);
  vec3 irradiance = vec3(0.0);
  
  vec3 up    = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up         = normalize(cross(normal, right));

  const float sampleDelta = 0.025;
  float nrSamples = 0.0; 
  for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
    for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
      // spherical to cartesian (in tangent space)
      vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
      // tangent space to world
      vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal; 

      irradiance += texture(envMap, sampleVec).rgb * cos(theta) * sin(theta);
      nrSamples++;
    }
  }
  irradiance = PI * irradiance * (1.0 / float(nrSamples));

  // Exposure
  irradiance = 1.0 - exp(-irradiance * exposure);

  FragColor = vec4(irradiance, 1.0);
}

  `,
});

export const equirectToPrefilter = (renderer: THREE.WebGLRenderer, equirect: THREE.Texture) => {
  const start = performance.now();

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const pmrem = pmremGenerator.fromEquirectangular(equirect);

  pmremGenerator.dispose();

  console.log('prefilter map', (performance.now() - start).toFixed(1), "ms");

  return pmrem;
}

export const generateBrdfLUT = (renderer: THREE.WebGLRenderer) => {
  const cachedTexture = loadBrdfLUTFromCache();
  if (cachedTexture) {
    console.log('brdf lut (cached)');
    return cachedTexture;
  }

  const start = performance.now();

  const brdfLUT = new THREE.WebGLRenderTarget(BRDF_LUT_SIZE, BRDF_LUT_SIZE);
  brdfLUT.texture.generateMipmaps = false;

  renderer.setRenderTarget(brdfLUT);
  const fsQuad = new FullScreenQuad();
  fsQuad.material = brdfShader;
  fsQuad.render(renderer);
  fsQuad.dispose();

  const pixels = new Uint8Array(BRDF_LUT_SIZE * BRDF_LUT_SIZE * 4);
  renderer.readRenderTargetPixels(
    brdfLUT,
    0,
    0,
    BRDF_LUT_SIZE,
    BRDF_LUT_SIZE,
    pixels,
  );
  saveBrdfLUTToCache(pixels);

  const texture = brdfLUT.texture;

  renderer.setRenderTarget(null);

  console.log('brdf lut', (performance.now() - start).toFixed(1), "ms");

  return texture;
}

const brdfShader = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: {
    u_resolution: { value: new THREE.Vector2(BRDF_LUT_SIZE, BRDF_LUT_SIZE) },
  },
  vertexShader: /* glsl */ `
void main() {
  gl_Position = vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
precision highp float;

uniform vec2 u_resolution;

out vec2 FragColor;

const float PI = 3.14159265359;

float RadicalInverse_VdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
vec2 Hammersley(uint i, uint N) {
  return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness*roughness;

  float phi = 2.0 * PI * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
  float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

  // from spherical coordinates to cartesian coordinates
  vec3 H;
  H.x = cos(phi) * sinTheta;
  H.y = sin(phi) * sinTheta;
  H.z = cosTheta;

  // from tangent-space vector to world-space sample vector
  vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent   = normalize(cross(up, N));
  vec3 bitangent = cross(N, tangent);

  vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
  return normalize(sampleVec);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
  float a = roughness;
  float k = (a * a) / 2.0;

  float nom   = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = GeometrySchlickGGX(NdotV, roughness);
  float ggx1 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

vec2 IntegrateBRDF(float NdotV, float roughness) {
  vec3 V;
  V.x = sqrt(1.0 - NdotV*NdotV);
  V.y = 0.0;
  V.z = NdotV;

  float A = 0.0;
  float B = 0.0;

  vec3 N = vec3(0.0, 0.0, 1.0);

  const uint SAMPLE_COUNT = 1024u;
  for(uint i = 0u; i < SAMPLE_COUNT; ++i) {
    vec2 Xi = Hammersley(i, SAMPLE_COUNT);
    vec3 H  = ImportanceSampleGGX(Xi, N, roughness);
    vec3 L  = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(L.z, 0.0);
    float NdotH = max(H.z, 0.0);
    float VdotH = max(dot(V, H), 0.0);

    if(NdotL > 0.0) {
      float G = GeometrySmith(N, V, L, roughness);
      float G_Vis = (G * VdotH) / (NdotH * NdotV);
      float Fc = pow(1.0 - VdotH, 5.0);

      A += (1.0 - Fc) * G_Vis;
      B += Fc * G_Vis;
    }
  }
  A /= float(SAMPLE_COUNT);
  B /= float(SAMPLE_COUNT);
  return vec2(A, B);
}
// ----------------------------------------------------------------------------
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 integratedBRDF = IntegrateBRDF(uv.x, uv.y);
  FragColor = integratedBRDF;
}
`,
});