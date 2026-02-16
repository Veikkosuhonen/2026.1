import * as THREE from "three";
import { screenVS } from "./screenVS";

const bokehShaderFS = /* glsl */ `
precision highp float;

uniform sampler2D src;
uniform sampler2D gPositionMetalness;

uniform float maxBlur; // max blur amount
uniform float aperture; // aperture - bigger values for shallower depth of field

uniform float nearClip;
uniform float farClip;

uniform float focus;
uniform vec2 u_resolution;

out vec4 FragColor;

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = gl_FragCoord.st / u_resolution.st;
  vec2 aspectcorrect = vec2( 1.0, aspect);

  float viewZ = texture(gPositionMetalness, uv).z;

  float factor = ( focus + viewZ ); // viewZ is <= 0, so this is a difference equation

  vec2 dofblur = vec2 ( clamp( factor * aperture * 0.01, -maxBlur, maxBlur ) );

  vec2 dofblur9 = dofblur * 0.9;
  vec2 dofblur7 = dofblur * 0.7;
  vec2 dofblur4 = dofblur * 0.4;

  vec4 col = vec4(0.0);

  col += texture( src, uv );
  col += texture( src, uv + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur );
  col += texture( src, uv + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur );

  col += texture( src, uv + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
  col += texture( src, uv + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur9 );

  col += texture( src, uv + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
  col += texture( src, uv + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur7 );

  col += texture( src, uv + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2(  0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
  col += texture( src, uv + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur4 );

  FragColor = col / 41.0;
  FragColor.a = 1.0;

  // FragColor = vec4(uv, 1.0, 1.0);
}
`;

export const bokehShader = new THREE.RawShaderMaterial({
  vertexShader: screenVS,
  fragmentShader: bokehShaderFS,
  side: THREE.FrontSide,
  glslVersion: "300 es",
  depthWrite: false,
  uniforms: {
    src: { value: null },
    gPositionMetalness: { value: null },
    u_resolution: { value: new THREE.Vector2() },
    'focus': { value: 1.0 },
		'aperture': { value: 0.01 },
		'maxBlur': { value: 0.01 },
		'nearClip': { value: 1.0 },
		'farClip': { value: 1000.0 },
  },
});
