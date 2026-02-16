import * as THREE from "three";
import { screenVS } from "./screenVS";

const downsampleShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texelSize = 1.0 / u_resolution;
  float x = texelSize.x;
  float y = texelSize.y;

  // Take 13 samples around current texel:
  // a - b - c
  // - j - k -
  // d - e - f
  // - l - m -
  // g - h - i
  // === ('e' is the current texel) ===
  vec3 a = texture(src, vec2(uv.x - 2.0*x, uv.y + 2.0*y)).rgb;
  vec3 b = texture(src, vec2(uv.x,         uv.y + 2.0*y)).rgb;
  vec3 c = texture(src, vec2(uv.x + 2.0*x, uv.y + 2.0*y)).rgb;

  vec3 d = texture(src, vec2(uv.x - 2.0*x, uv.y)).rgb;
  vec3 e = texture(src, vec2(uv.x,         uv.y)).rgb;
  vec3 f = texture(src, vec2(uv.x + 2.0*x, uv.y)).rgb;

  vec3 g = texture(src, vec2(uv.x - 2.0*x, uv.y - 2.0*y)).rgb;
  vec3 h = texture(src, vec2(uv.x,         uv.y - 2.0*y)).rgb;
  vec3 i = texture(src, vec2(uv.x + 2.0*x, uv.y - 2.0*y)).rgb;

  vec3 j = texture(src, vec2(uv.x - x,     uv.y + y)).rgb;
  vec3 k = texture(src, vec2(uv.x + x,     uv.y + y)).rgb;
  vec3 l = texture(src, vec2(uv.x - x,     uv.y - y)).rgb;
  vec3 m = texture(src, vec2(uv.x + x,     uv.y - y)).rgb;

  // Apply weighted distribution:
  // 0.5 + 0.125 + 0.125 + 0.125 + 0.125 = 1
  // a,b,d,e * 0.125
  // b,c,e,f * 0.125
  // d,e,g,h * 0.125
  // e,f,h,i * 0.125
  // j,k,l,m * 0.5
  // This shows 5 square areas that are being sampled. But some of them overlap,
  // so to have an energy preserving downsample we need to make some adjustments.
  // The weights are the distributed, so that the sum of j,k,l,m (e.g.)
  // contribute 0.5 to the final color output. The code below is written
  // to effectively yield this sum. We get:
  // 0.125*5 + 0.03125*4 + 0.0625*4 = 1
  vec3 downsample = e*0.125;
  downsample += (a+c+g+i)*0.03125;
  downsample += (b+d+f+h)*0.0625;
  downsample += (j+k+l+m)*0.125;

  fragColor = vec4(max(downsample, 0.0001), 1.0);
}
`;


export const downsampleShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: downsampleShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  uniforms: {
    src: { value: null },
    u_resolution: { value: new THREE.Vector2() },
  },
});


const upsampleShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform vec2 u_resolution;
uniform float filterRadius;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  
  // The filter kernel is applied with a radius, specified in texture
  // coordinates, so that the radius will vary across mip resolutions.
  float x = filterRadius;
  float y = filterRadius;

  // Take 9 samples around current texel:
  // a - b - c
  // d - e - f
  // g - h - i
  // === ('e' is the current texel) ===
  vec3 a = texture(src, vec2(uv.x - x, uv.y + y)).rgb;
  vec3 b = texture(src, vec2(uv.x,     uv.y + y)).rgb;
  vec3 c = texture(src, vec2(uv.x + x, uv.y + y)).rgb;

  vec3 d = texture(src, vec2(uv.x - x, uv.y    )).rgb;
  vec3 e = texture(src, vec2(uv.x,     uv.y    )).rgb;
  vec3 f = texture(src, vec2(uv.x + x, uv.y    )).rgb;

  vec3 g = texture(src, vec2(uv.x - x, uv.y - y)).rgb;
  vec3 h = texture(src, vec2(uv.x,     uv.y - y)).rgb;
  vec3 i = texture(src, vec2(uv.x + x, uv.y - y)).rgb;

  // Apply weighted distribution, by using a 3x3 tent filter:
  //  1   | 1 2 1 |
  // -- * | 2 4 2 |
  // 16   | 1 2 1 |
  vec3 upsample = e*4.0;
  upsample += (b+d+f+h)*2.0;
  upsample += (a+c+g+i);
  upsample *= 1.0 / 16.0;

  fragColor = vec4(upsample, 1.0);
}
`;

export const upsampleShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: upsampleShaderFS,

  side: THREE.FrontSide,

  glslVersion: "300 es",

  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
  depthTest: false,

  uniforms: {
    src: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    filterRadius: { value: 0.01 },
  },
});

const bloomMixShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D bloom;

uniform float bloomStrength;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  vec3 srcColor = texture(src, uv).rgb;
  vec3 bloomColor = texture(bloom, uv).rgb;
  srcColor = mix(srcColor, bloomColor, bloomStrength);

  fragColor = vec4(srcColor, 1.0);
}
`;

export const bloomMixShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: bloomMixShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  uniforms: {
    src: { value: null },
    bloom: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    bloomStrength: { value: 0.5 },
  },
});
