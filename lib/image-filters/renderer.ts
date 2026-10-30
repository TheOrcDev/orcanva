import type { Size } from "@/lib/document/geometry";
import { MAX_FILTER_SIDE } from "@/lib/image-filters/output-size";
import type { FilterUniforms } from "@/lib/image-filters/resolve";
import {
  ADJUST_SHADER,
  BLUR_SHADER,
  VERTEX_SHADER,
} from "@/lib/image-filters/shader";

export type FilterSource = HTMLImageElement | HTMLCanvasElement;

interface Program {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
}

// An offscreen texture the blur passes draw into
interface PassTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

// One WebGL2 context for the whole editor (browsers cap how many a page
// may hold). Each draw lands in a caller-owned 2D canvas, which Konva and
// the export clone then share.
interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  adjust: Program;
  blur: Program;
  passes: [PassTarget, PassTarget];
  maxSide: number;
}

const POSITION_ATTRIBUTE = 0;
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
// Recently used source textures; a scrub reuses the same one every frame
const MAX_TEXTURES = 6;
// Blurs narrower than this (in output pixels) aren't visible
const MIN_BLUR_SIGMA = 0.5;
// Blur passes run small enough that the kernel is at most this wide (in
// their own pixels), which keeps a wide blur to a few taps
const BLUR_PASS_SIGMA = 3;

let renderer: Renderer | null = null;
let unsupported = false;
const textures = new Map<string, WebGLTexture>();
const sourceIds = new WeakMap<FilterSource, number>();
let nextSourceId = 0;

const compile = (
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Could not create a filter shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Filter shader failed to compile: ${log}`);
  }
  return shader;
};

const link = (gl: WebGL2RenderingContext, fragment: string): Program => {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, POSITION_ATTRIBUTE, "a_position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Filter program failed to link: ${gl.getProgramInfoLog(program)}`
    );
  }
  return { locations: new Map(), program };
};

const location = (
  gl: WebGL2RenderingContext,
  { locations, program }: Program,
  name: string
): WebGLUniformLocation | null => {
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  return locations.get(name) ?? null;
};

const createPassTarget = (gl: WebGL2RenderingContext): PassTarget => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return { framebuffer: gl.createFramebuffer(), height: 0, texture, width: 0 };
};

const sizePassTarget = (
  gl: WebGL2RenderingContext,
  target: PassTarget,
  size: Size
) => {
  if (target.width === size.width && target.height === size.height) {
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size.width,
    size.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    target.texture,
    0
  );
  target.width = size.width;
  target.height = size.height;
};

const createRenderer = (): Renderer | null => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    // Colour stays straight; drawImage onto the 2D canvas converts it
    premultipliedAlpha: false,
    stencil: false,
  });
  if (!gl) {
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(POSITION_ATTRIBUTE);
  gl.vertexAttribPointer(POSITION_ATTRIBUTE, 2, gl.FLOAT, false, 0, 0);
  // Premultiplied, so sampling between pixels and mip levels never picks
  // up the colour of transparent ones; the adjust pass undoes it
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const created: Renderer = {
    adjust: link(gl, ADJUST_SHADER),
    blur: link(gl, BLUR_SHADER),
    canvas,
    gl,
    maxSide: Math.min(MAX_FILTER_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    passes: [createPassTarget(gl), createPassTarget(gl)],
  };
  // A lost GPU context takes its textures with it; start over next draw
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    if (renderer === created) {
      renderer = null;
      textures.clear();
    }
  });
  return created;
};

const getRenderer = (): Renderer | null => {
  if (renderer?.gl.isContextLost()) {
    renderer = null;
    textures.clear();
  }
  if (renderer || unsupported) {
    return renderer;
  }
  try {
    renderer = createRenderer();
  } catch {
    renderer = null;
  }
  unsupported = renderer === null;
  return renderer;
};

const naturalSize = (source: FilterSource): Size =>
  source instanceof HTMLImageElement
    ? { height: source.naturalHeight, width: source.naturalWidth }
    : { height: source.height, width: source.width };

// The browser's high-quality resampler beats sampling a much larger
// texture with plain bilinear filtering
const resampled = (source: FilterSource, size: Size): TexImageSource => {
  const natural = naturalSize(source);
  if (natural.width === size.width && natural.height === size.height) {
    return source;
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);
  }
  return canvas;
};

const textureFor = (
  { gl }: Renderer,
  source: FilterSource,
  size: Size
): WebGLTexture => {
  let id = sourceIds.get(source);
  if (id === undefined) {
    id = nextSourceId;
    nextSourceId += 1;
    sourceIds.set(source, id);
  }
  const key = `${id}:${size.width}x${size.height}`;
  const cached = textures.get(key);
  if (cached) {
    // Re-insert so the map's order stays least recently used first
    textures.delete(key);
    textures.set(key, cached);
    gl.bindTexture(gl.TEXTURE_2D, cached);
    return cached;
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Mip levels let the blur read a prefiltered, smaller copy
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const pixels = resampled(source, size);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.generateMipmap(gl.TEXTURE_2D);
  if (pixels instanceof HTMLCanvasElement && pixels !== source) {
    // Release the scratch copy's memory now rather than at GC
    pixels.width = 0;
    pixels.height = 0;
  }

  textures.set(key, texture);
  for (const [oldKey, oldTexture] of textures) {
    if (textures.size <= MAX_TEXTURES) {
      break;
    }
    gl.deleteTexture(oldTexture);
    textures.delete(oldKey);
  }
  return texture;
};

const setUniforms = (
  gl: WebGL2RenderingContext,
  program: Program,
  uniforms: FilterUniforms,
  size: Size
) => {
  const at = (name: string) => location(gl, program, name);
  gl.uniform1i(at("u_image"), 0);
  gl.uniform1f(at("u_flipY"), 1);
  gl.uniform2f(at("u_texel"), 1 / size.width, 1 / size.height);
  gl.uniform3fv(at("u_gains"), uniforms.gains);
  gl.uniform1f(at("u_brightnessGamma"), uniforms.brightnessGamma);
  gl.uniform1f(at("u_contrast"), uniforms.contrast);
  gl.uniform1f(at("u_shadowsGamma"), uniforms.shadowsGamma);
  gl.uniform1f(at("u_highlightsGamma"), uniforms.highlightsGamma);
  gl.uniform1f(at("u_saturation"), uniforms.saturation);
  gl.uniform3fv(at("u_toneShadows"), uniforms.toneShadows);
  gl.uniform3fv(at("u_toneHighlights"), uniforms.toneHighlights);
  gl.uniform1f(at("u_toneAmount"), uniforms.toneAmount);
  gl.uniform1f(at("u_fadeScale"), uniforms.fadeScale);
  gl.uniform1f(at("u_fadeLift"), uniforms.fadeLift);
  gl.uniform1f(at("u_vignette"), uniforms.vignette);
  gl.uniform1f(at("u_sharpen"), uniforms.sharpen);
  gl.uniform1f(at("u_grain"), uniforms.grain);
};

// Gaussian blur in two passes at a reduced size; returns the blurred
// texture, or null when the filter has no visible blur
const blurred = (
  { blur, gl, passes }: Renderer,
  source: WebGLTexture,
  uniforms: FilterUniforms,
  size: Size
): WebGLTexture | null => {
  const sigma = uniforms.blur * Math.max(size.width, size.height);
  if (sigma < MIN_BLUR_SIGMA) {
    return null;
  }
  const scale = Math.max(1, sigma / BLUR_PASS_SIGMA);
  const reduced = {
    height: Math.max(1, Math.ceil(size.height / scale)),
    width: Math.max(1, Math.ceil(size.width / scale)),
  };
  const [horizontal, vertical] = passes;
  sizePassTarget(gl, horizontal, reduced);
  sizePassTarget(gl, vertical, reduced);

  const at = (name: string) => location(gl, blur, name);
  gl.useProgram(blur.program);
  gl.viewport(0, 0, reduced.width, reduced.height);
  gl.uniform1i(at("u_image"), 0);
  gl.uniform1f(at("u_flipY"), 0);
  gl.uniform1f(at("u_sigma"), sigma / scale);

  gl.bindFramebuffer(gl.FRAMEBUFFER, horizontal.framebuffer);
  gl.bindTexture(gl.TEXTURE_2D, source);
  gl.uniform2f(at("u_step"), 1 / reduced.width, 0);
  gl.uniform1f(at("u_lod"), Math.log2(scale));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindFramebuffer(gl.FRAMEBUFFER, vertical.framebuffer);
  gl.bindTexture(gl.TEXTURE_2D, horizontal.texture);
  gl.uniform2f(at("u_step"), 0, 1 / reduced.height);
  gl.uniform1f(at("u_lod"), 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return vertical.texture;
};

// Largest side a filtered image may have on this GPU
export const maxFilterSide = (): number =>
  getRenderer()?.maxSide ?? MAX_FILTER_SIDE;

// Draws `source` through the filter into `target` at the target's size.
// Returns false when this browser can't run filters (no WebGL2).
export const renderFilter = (
  source: FilterSource,
  uniforms: FilterUniforms,
  target: HTMLCanvasElement
): boolean => {
  const current = getRenderer();
  const context = target.getContext("2d");
  if (!current || !context) {
    return false;
  }
  const { canvas, gl } = current;
  const size = { height: target.height, width: target.width };

  gl.activeTexture(gl.TEXTURE0);
  const texture = textureFor(current, source, size);
  const input = blurred(current, texture, uniforms, size) ?? texture;
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, size.width, size.height);
  gl.bindTexture(gl.TEXTURE_2D, input);
  gl.useProgram(current.adjust.program);
  setUniforms(gl, current.adjust, uniforms, size);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Copy out while the drawing buffer is still valid (same task)
  context.clearRect(0, 0, size.width, size.height);
  context.drawImage(canvas, 0, 0);
  return true;
};
