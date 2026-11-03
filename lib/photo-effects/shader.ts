// Passes for photo effects. They run on the shared filter context with its
// full-screen vertex shader (lib/image-filters/shader.ts). Offscreen passes
// address pixels by gl_FragCoord, so rows keep the mask's order; the last
// pass onto the canvas flips them upright through v_uv.

// Seeds hold the pixel coordinates of the nearest inside pixel found so
// far, or NONE. Fields are at most 4096 px, so 16 bits are plenty.
const SEEDS = `
precision highp usampler2D;
const uint NONE = 65535u;
`;

// Every pixel the photo covers at least half is a seed of itself
export const SEED_SHADER = `#version 300 es
precision highp float;
${SEEDS}
uniform sampler2D u_mask;
out uvec2 outSeed;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  float alpha = texelFetch(u_mask, pixel, 0).a;
  outSeed = alpha >= 0.5 ? uvec2(pixel) : uvec2(NONE);
}
`;

// One step of a jump flood: keep the nearest seed among the eight pixels
// u_step away and this one
export const FLOOD_SHADER = `#version 300 es
precision highp float;
${SEEDS}
uniform usampler2D u_seeds;
uniform int u_step;
out uvec2 outSeed;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_seeds, 0);
  uvec2 best = uvec2(NONE);
  float bestSquared = 1e20;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 at = pixel + ivec2(x, y) * u_step;
      if (any(lessThan(at, ivec2(0))) || any(greaterThanEqual(at, size))) {
        continue;
      }
      uvec2 seed = texelFetch(u_seeds, at, 0).xy;
      if (seed.x == NONE) {
        continue;
      }
      vec2 offset = vec2(seed) - vec2(pixel);
      float squared = dot(offset, offset);
      if (squared < bestSquared) {
        bestSquared = squared;
        best = seed;
      }
    }
  }
  outSeed = best;
}
`;

// The field the colouring passes read: r = the photo's own alpha, g = the
// silhouette (photo and outline together), b = the outline. The outline
// covers everything within u_width px of a seed; seeds sit about half a
// pixel inside the edge, and its last pixel fades for a smooth edge.
export const FIELD_SHADER = `#version 300 es
precision highp float;
${SEEDS}
uniform sampler2D u_mask;
uniform usampler2D u_seeds;
uniform float u_width;
out vec4 outField;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  float alpha = texelFetch(u_mask, pixel, 0).a;
  uvec2 seed = texelFetch(u_seeds, pixel, 0).xy;
  float outline = seed.x == NONE
    ? 0.0
    : clamp(u_width + 1.0 - distance(vec2(seed), vec2(pixel)), 0.0, 1.0);
  outField = vec4(alpha, max(alpha, outline), outline, 1.0);
}
`;

// The same field without an outline: the silhouette is the photo itself
export const PLAIN_FIELD_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
out vec4 outField;

void main() {
  float alpha = texelFetch(u_mask, ivec2(gl_FragCoord.xy), 0).a;
  outField = vec4(alpha, alpha, 0.0, 1.0);
}
`;

// The outline over the glow, drawn behind the photo, in straight colour.
// u_region maps the output onto the part of the field it covers (offset,
// size in uv). u_glow is the field blurred (its g: the silhouette), at a
// reduced size; without a glow it's the field and u_glowGain is 0.
export const HALO_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_field;
uniform sampler2D u_glow;
uniform vec4 u_region;
// Premultiplied
uniform vec4 u_outlineColor;
uniform vec4 u_glowColor;
uniform float u_glowGain;
uniform float u_opacity;

void main() {
  vec2 uv = u_region.xy + v_uv * u_region.zw;
  vec3 field = texture(u_field, uv).rgb;
  vec4 color = u_outlineColor * field.b;
  float glow = clamp(texture(u_glow, uv).g * u_glowGain, 0.0, 1.0);
  color += u_glowColor * glow * (1.0 - color.a);
  // The element's opacity reaches the photo and this separately, so under
  // a see-through photo this would show through more than it should.
  // (1 - a) / (1 - opacity * a), with a the photo's own alpha, gives what
  // flattening the two first and then fading them would.
  float photo = field.r;
  color *= u_opacity < 1.0 ? (1.0 - photo) / (1.0 - u_opacity * photo) : 1.0;
  outColor = color.a > 0.0 ? vec4(color.rgb / color.a, color.a) : vec4(0.0);
}
`;

// The silhouette (photo and outline) in the shadow's colour, blurred or not
export const SHADOW_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform vec4 u_region;
// Straight colour
uniform vec4 u_color;

void main() {
  float silhouette = texture(u_source, u_region.xy + v_uv * u_region.zw).g;
  outColor = vec4(u_color.rgb, u_color.a * silhouette);
}
`;
