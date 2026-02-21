import * as THREE from "three";
import { screenVS } from "./screenVS";

const glitchShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform vec2 u_resolution;
uniform float u_time;
uniform float intensity;
uniform float scanlineIntensity;
uniform float colorShiftAmount;
uniform float lineShiftAmount;
uniform float bigShiftAmount;
uniform float noiseGrainIntensity;

out vec4 FragColor;

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float randomTime(vec2 co) {
  return random(co + vec2(u_time, 0.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float glitchIntensity = intensity;

  // Block glitch: shift rows of pixels horizontally
  float blockNoise = floor(randomTime(vec2(0.0, floor(uv.y * 20.0))) + 0.5);
  float lineShift = blockNoise * (randomTime(vec2(floor(uv.y * 40.0), 0.0)) - 0.5) * lineShiftAmount * glitchIntensity;

  // Occasional large displacement
  float bigGlitch = step(0.999 - glitchIntensity * 0.1, randomTime(vec2(floor(u_time * 10.0), 0.0)));
  float bigShift = bigGlitch * (randomTime(vec2(floor(uv.y * 8.0), floor(u_time * 10.0))) - 0.5) * bigShiftAmount * glitchIntensity;

  // Pixelate random blocks
  float pixelSize = 4.0;
  vec2 pixelatedUV = vec2(1.0) - floor(uv * u_resolution.xy / pixelSize) * pixelSize / u_resolution.xy;
  uv = randomTime(vec2(floor(uv.y * 10.0) * floor(uv.x * 10.0), floor(u_time * 1.0))) < glitchIntensity * 0.01 ? pixelatedUV : uv;

  vec2 shiftedUV = uv + vec2(lineShift + bigShift, 0.0);

  // Color channel separation (chromatic aberration / RGB shift)
  // Stronger near edges, weaker near center
  float edgeDist = length(uv - 0.5) * 2.0; // 0 at center, ~1.41 at corners
  float edgeFactor = smoothstep(0.0, 1.0, edgeDist);
  float shift = colorShiftAmount * edgeFactor * (0.5 + 0.5 * randomTime(vec2(floor(u_time * 4.0), 0.0)));
  vec2 shiftDir = normalize(uv - 0.5 + 0.001); // radial direction from center
  float r = texture(src, shiftedUV + shiftDir * shift).r;
  float g = texture(src, shiftedUV).g;
  float b = texture(src, shiftedUV - shiftDir * shift).b;
  vec3 color = vec3(r, g, b);

  // Scanlines
  float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
  color -= scanline * scanlineIntensity;

  // Noise grain
  float noise = (randomTime(uv * u_time) - 0.5) * noiseGrainIntensity * glitchIntensity;
  color += noise;

  FragColor = vec4(color, 1.0);
}
`;

export const glitchShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: glitchShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: false,
  uniforms: {
    src: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    u_time: { value: 0.0 },
    intensity: { value: 0.5 },
    scanlineIntensity: { value: 0.05 },
    colorShiftAmount: { value: 0.01 },
    lineShiftAmount: { value: 0.1 },
    bigShiftAmount: { value: 0.3 },
    noiseGrainIntensity: { value: 0.06 },
  },
});
