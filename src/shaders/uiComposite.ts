import * as THREE from "three";
import { screenVS } from "./screenVS";

const uiCompositeShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D uiTexture;
uniform vec2 u_resolution;

out vec4 FragColor;

void main() {
  vec2 uv = gl_FragCoord.st / u_resolution.st;
  vec4 color = texture(src, uv);

  vec2 uiUv = uv;
  uiUv.x *= u_resolution.x / u_resolution.y; // Adjust for aspect ratio
  uiUv.x -= 0.5; // Center the UI texture

  vec2 texelSize = 1.0 / u_resolution;
  vec4 uiColor = vec4(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      uiColor += texture(uiTexture, uiUv + vec2(float(x), float(y)) * texelSize);
    }
  }
  uiColor /= 9.0;
  float alpha = clamp(uiColor.a * 1.0, 0.0, 0.999);

  vec3 blendedColor = mix(color.rgb, vec3(0.0, 0.0, 0.0), alpha);

  FragColor = vec4(blendedColor, 1.0);
}
`;

export const uiCompositeShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: uiCompositeShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: false,
  uniforms: {
    src: { value: null },
    uiTexture: { value: null },
    u_resolution: { value: new THREE.Vector2() },
  },
});
