export const flicker = /* glsl */ `
float flicker(vec4 co, float fraction) {
  float seed = fract(sin(dot(co, vec4(12.9898, 78.233, -23.112, 31.6831))) * 43758.5453);
  float flicker = step(1.0 - fraction, seed); // Flicker effect
  return flicker;
}
`;