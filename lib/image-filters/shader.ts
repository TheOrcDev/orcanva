// One full-screen triangle pair. Offscreen passes keep the texture's row
// order; the last pass onto the canvas flips it so the picture is upright.
export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform float u_flipY;
out vec2 v_uv;

void main() {
  vec2 uv = a_position * 0.5 + 0.5;
  v_uv = vec2(uv.x, mix(uv.y, 1.0 - uv.y, u_flipY));
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Works on straight (not premultiplied) colour and leaves alpha alone, so
// cut-outs keep their transparency. Every step is skipped at its neutral
// value by the maths itself; the order follows a photo editor's pipeline.
export const ADJUST_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_image;
uniform vec2 u_texel;
uniform vec3 u_gains;
uniform float u_brightnessGamma;
uniform float u_contrast;
uniform float u_shadowsGamma;
uniform float u_highlightsGamma;
uniform float u_saturation;
uniform vec3 u_toneShadows;
uniform vec3 u_toneHighlights;
uniform float u_toneAmount;
uniform float u_fadeScale;
uniform float u_fadeLift;
uniform float u_vignette;
uniform float u_sharpen;
uniform float u_grain;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// Stable per-pixel noise, so grain looks the same for everyone and in exports
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 source = texture(u_image, v_uv);
  vec3 c = source.rgb;

  // Unsharp mask against the four neighbours
  vec3 neighbours = (
    texture(u_image, v_uv + vec2(u_texel.x, 0.0)).rgb +
    texture(u_image, v_uv - vec2(u_texel.x, 0.0)).rgb +
    texture(u_image, v_uv + vec2(0.0, u_texel.y)).rgb +
    texture(u_image, v_uv - vec2(0.0, u_texel.y)).rgb
  ) * 0.25;
  c = clamp(c + (c - neighbours) * u_sharpen, 0.0, 1.0);

  // White balance, midtones, then contrast around mid grey
  c = clamp(c * u_gains, 0.0, 1.0);
  c = pow(c, vec3(u_brightnessGamma));
  c = clamp((c - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  // Shadows and highlights reshape only their end of the luminance range
  float l = dot(c, LUMA);
  float shadows = mix(l, pow(l, u_shadowsGamma), 1.0 - smoothstep(0.0, 0.6, l));
  float tones = mix(
    shadows,
    1.0 - pow(1.0 - shadows, u_highlightsGamma),
    smoothstep(0.4, 1.0, shadows)
  );
  c = clamp(c + (tones - l), 0.0, 1.0);

  l = dot(c, LUMA);
  c = clamp(mix(vec3(l), c, u_saturation), 0.0, 1.0);

  // Split toning: tint the darks and the brights towards two colours
  vec3 tone = (u_toneShadows - 0.5) * (1.0 - l) + (u_toneHighlights - 0.5) * l;
  c = clamp(c + tone * u_toneAmount, 0.0, 1.0);

  c = c * u_fadeScale + u_fadeLift;

  // The vignette follows the frame, darkest in the corners
  float edge = length(v_uv - 0.5) * 1.41421356;
  c *= 1.0 - u_vignette * smoothstep(0.35, 1.0, edge);

  c += (hash(gl_FragCoord.xy) - 0.5) * u_grain;

  outColor = vec4(clamp(c, 0.0, 1.0), source.a);
}
`;
