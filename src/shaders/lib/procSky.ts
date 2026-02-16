export const procSky = /* glsl */ `

vec3 nrand3( vec3 co ) {
	vec3 a = fract( cos( co.x*8.3e-3 + co.y*3.5e-3 + co.z )*vec3(1.3e5, 4.7e5, 2.9e5) );
	vec3 b = fract( sin( co.x*0.3e-3 + co.y*4.6e-3 + co.z )*vec3(8.1e5, 1.0e5, 0.1e5) );
	vec3 c = mix(a, b, 0.5);
	return c;
}

vec3 getSkyColor(vec3 viewDirectionWS, float detailLevel) {
  // Simple procedural sky color based on view direction
  float t = max(viewDirectionWS.y, 0.0);
  vec3 horizonColor = vec3(0.75, 0.82, 0.9);
  vec3 zenithColor = vec3(0.1, 0.2, 0.9);
  vec3 col = mix(horizonColor, zenithColor, t) * 0.3;

  // Add sun disk
  vec3 sunDirection = normalize(vec3(0.0, 1.0, 1.0));
  float sunDisk = smoothstep(0.99, 0.993, dot(viewDirectionWS, sunDirection));
  col += vec3(1.0, 0.5, 0.1) * sunDisk * 100.0;

  float sunGlow = min(10.0, 0.5 / (length(viewDirectionWS - sunDirection) * 2.0 + 0.001));
  col += vec3(1.0, 0.5, 0.1) * sunGlow;

  // Add stars
  if (detailLevel <= 0.1) {
    vec3 seed = viewDirectionWS * (1.0 - detailLevel * 9.0);
    seed = floor(seed * u_resolution.x);
    vec3 rnd = nrand3( seed );
    vec3 starcolor = vec3(pow(rnd.y,40.0));

    starcolor *= pow(viewDirectionWS.y, 0.4);
    starcolor = max(vec3(0.0), starcolor);

    col += starcolor * 10.0;
  }

  return col;
}

`;