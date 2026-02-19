export const procSky = /* glsl */ `

vec3 nrand3( vec3 co ) {
    vec3 a = fract( cos( co.x*8.3e-3 + co.y*3.5e-3 + co.z )*vec3(1.3e5, 4.7e5, 2.9e5) );
    vec3 b = fract( sin( co.x*0.3e-3 + co.y*4.6e-3 + co.z )*vec3(8.1e5, 1.0e5, 0.1e5) );
    vec3 c = mix(a, b, 0.5);
    return c;
}

vec4 nrand4( vec4 co ) {
    vec4 a = fract( cos( co.x*8.3e-3 + co.y*3.5e-3 + co.z*1.7e-3 + co.w*2.1e-3 )*vec4(1.3e5, 4.7e5, 2.9e5, 3.1e5) );
    vec4 b = fract( sin( co.x*0.3e-3 + co.y*4.6e-3 + co.z*2.3e-3 + co.w*1.4e-3 )*vec4(8.1e5, 1.0e5, 0.1e5, 5.3e5) );
    return mix(a, b, 0.5);
}

// 4D Voronoi — returns vec2(F1, F2)
vec2 voronoi4d(vec4 p) {
  vec4 cellId = floor(p);
  vec4 localPos = fract(p);

  float d1 = 1e10;
  float d2 = 1e10;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        for (int w = -1; w <= 1; w++) {
          vec4 neighbor = vec4(float(x), float(y), float(z), float(w));
          vec4 featurePoint = nrand4(cellId + neighbor);
          vec4 diff = neighbor + featurePoint - localPos;
          float dist = dot(diff, diff);

          if (dist < d1) {
            d2 = d1;
            d1 = dist;
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }
    }
  }

  return sqrt(vec2(d1, d2));
}

// Rotation matrix around an arbitrary axis
mat3 rotationMatrix(vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  float t = 1.0 - c;

  return mat3(
    t * axis.x * axis.x + c,         t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
    t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c,         t * axis.y * axis.z - s * axis.x,
    t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c
  );
}

vec3 getSkyColor(vec3 viewDirectionWS, float detailLevel) {
  // Simple procedural sky color based on view direction
  float t = max(viewDirectionWS.y, 0.0);

  vec3 horizonColor = vec3(0.75, 0.82, 0.9);
  vec3 zenithColor = vec3(0.1, 0.2, 0.9);

  vec3 col = mix(horizonColor, zenithColor, t) * 0.2;

  // Add sun disk
  vec3 sunDirection = normalize(vec3(1.0, 0.1, 1.0));

  float sunRadius = 0.15;
  float VdotS = dot(viewDirectionWS, sunDirection);
  float sunDisk = smoothstep(0.99 - detailLevel * 0.6, 0.992 + detailLevel * 0.05, VdotS);

  if (sunDisk > 0.0 && detailLevel <= 0.1) {
    // Build a tangent frame around the sun direction
    vec3 up = abs(sunDirection.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, sunDirection));
    vec3 bitangent = cross(sunDirection, tangent);

    vec3 diff = viewDirectionWS - sunDirection;
    float u = dot(diff, tangent);
    float v2 = dot(diff, bitangent);

    float nu = u / sunRadius;
    float nv = v2 / sunRadius;
    float nw = sqrt(max(0.0, 1.0 - nu * nu - nv * nv));

    // Surface normal in world space
    vec3 sunNormal = normalize(nu * tangent + nv * bitangent + nw * sunDirection);
    sunNormal = rotationMatrix(vec3(0.0, 1.0, 0.0), u_time * 0.05) * sunNormal;

    vec2 vor = voronoi4d(vec4(sunNormal * 15.0, u_time * 0.5)) * voronoi4d(vec4(sunNormal * 7.0, u_time * 0.1)) * 1.0;
    float noise = pow(max(0.1, 1.0-vor.y), 0.7);
    noise += 0.2 * (vor.x - vor.y);
    noise = max(0.0, noise);
    sunDisk *= noise;
  }

  // Corona
  sunDisk += smoothstep(0.993, 0.991, VdotS) * smoothstep(0.988, 1.015, VdotS) * (1.0 - detailLevel);

  col += vec3(1.0, 0.15, 0.05) * sunDisk * 30.0 * (1.0 - detailLevel * 0.5);

  float sunGlow = min(2.0, 0.5 / (length(viewDirectionWS - sunDirection) * 4.0 + 0.001));
  col += vec3(1.0, 0.5, 0.1) * sunGlow;

  // Add stars
  if (detailLevel <= 0.1) {
    vec3 seed = viewDirectionWS * (1.0 - detailLevel * 9.0);
    seed = floor(seed * u_resolution.x);
    vec3 rnd = nrand3( seed );
    vec3 starcolor = vec3(pow(rnd.y,40.0));

    starcolor *= pow(viewDirectionWS.y, 0.4);
    starcolor = max(vec3(0.0), starcolor);

    col += starcolor * 2.0;
  }

  return col;
}

`;