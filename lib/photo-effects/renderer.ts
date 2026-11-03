import type { Rect, Size } from "@/lib/document/geometry";
import {
  blurred,
  linkProgram,
  sharedGl,
  uniformLocation,
} from "@/lib/image-filters/renderer";
import type { Program } from "@/lib/image-filters/renderer";
import { floodSteps } from "@/lib/photo-effects/geometry";
import type { EffectsLayout, EffectsPaint } from "@/lib/photo-effects/geometry";
import { drawPhotoMask } from "@/lib/photo-effects/mask";
import type { PhotoMask } from "@/lib/photo-effects/mask";
import {
  FIELD_SHADER,
  FLOOD_SHADER,
  HALO_SHADER,
  PLAIN_FIELD_SHADER,
  SEED_SHADER,
  SHADOW_SHADER,
} from "@/lib/photo-effects/shader";

// A texture with a framebuffer to draw into it
interface Target {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

type TargetKind = "field" | "seeds";

interface Programs {
  seed: Program;
  flood: Program;
  field: Program;
  plainField: Program;
  halo: Program;
  shadow: Program;
}

// Per context: a lost context comes back as a new one, and everything here
// with it
interface State {
  programs: Programs;
  mask: WebGLTexture;
  seeds: [Target, Target];
  // The latest field of the photos edited last, by owner
  fields: Map<object, { key: string; target: Target }>;
  // For one-off fields (preset previews), never kept
  scratch: Target;
}

export interface EffectsJob {
  // Whose effects these are; its field is kept for the next recolouring.
  // Null for one-off drawings (previews), which keep nothing.
  owner: object | null;
  // Everything the field depends on: the same key reuses the owner's field
  fieldKey: string;
  layout: EffectsLayout;
  mask: PhotoMask;
  paint: EffectsPaint;
  // Caller-owned canvases the bitmaps land in (Konva and exports share them)
  halo: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
}

// Which bitmaps were drawn. A blurred shadow is kept at a reduced size,
// since its blur hides the detail.
export interface EffectsOutput {
  halo: boolean;
  shadow: boolean;
}

// Fields kept for recolouring without a new flood: about 5 bytes per
// bitmap px each (with mip levels), so only the photos edited last
const MAX_FIELDS = 2;

const states = new WeakMap<WebGL2RenderingContext, State>();
let maskCanvas: HTMLCanvasElement | null = null;

const createTarget = (gl: WebGL2RenderingContext, kind: TargetKind): Target => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Seeds are integers, read pixel by pixel; fields are blurred from their
  // mip levels
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    kind === "seeds" ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    kind === "seeds" ? gl.NEAREST : gl.LINEAR
  );
  return { framebuffer: gl.createFramebuffer(), height: 0, texture, width: 0 };
};

const sizeTarget = (
  gl: WebGL2RenderingContext,
  target: Target,
  kind: TargetKind,
  size: Size
) => {
  if (target.width === size.width && target.height === size.height) {
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  if (kind === "seeds") {
    // Core WebGL2 can render to RG16UI, no extension needed
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16UI,
      size.width,
      size.height,
      0,
      gl.RG_INTEGER,
      gl.UNSIGNED_SHORT,
      null
    );
  } else {
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
  }
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

const deleteTarget = (gl: WebGL2RenderingContext, target: Target) => {
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
};

const ONE_PIXEL: Size = { height: 1, width: 1 };

const stateFor = (gl: WebGL2RenderingContext): State => {
  const known = states.get(gl);
  if (known) {
    return known;
  }
  const mask = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const state: State = {
    fields: new Map(),
    mask,
    programs: {
      field: linkProgram(gl, FIELD_SHADER),
      flood: linkProgram(gl, FLOOD_SHADER),
      halo: linkProgram(gl, HALO_SHADER),
      plainField: linkProgram(gl, PLAIN_FIELD_SHADER),
      seed: linkProgram(gl, SEED_SHADER),
      shadow: linkProgram(gl, SHADOW_SHADER),
    },
    scratch: createTarget(gl, "field"),
    seeds: [createTarget(gl, "seeds"), createTarget(gl, "seeds")],
  };
  states.set(gl, state);
  return state;
};

// Switches to a program (flipping its output upright for the canvas) and
// returns its uniform lookup
const activate = (gl: WebGL2RenderingContext, program: Program, flipY = 0) => {
  gl.useProgram(program.program);
  gl.uniform1f(uniformLocation(gl, program, "u_flipY"), flipY);
  return (name: string) => uniformLocation(gl, program, name);
};

const bind = (
  gl: WebGL2RenderingContext,
  unit: number,
  texture: WebGLTexture
) => {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
};

// Draws the full-screen pair into a target, or onto the canvas (null)
const drawInto = (
  gl: WebGL2RenderingContext,
  target: Target | null,
  size: Size
) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
  gl.viewport(0, 0, size.width, size.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// Seeds from the mask, flooded until every pixel within `distance` px of
// the photo knows its nearest inside pixel
const flood = (
  gl: WebGL2RenderingContext,
  { mask, programs, seeds }: State,
  size: Size,
  distance: number
): Target => {
  let [from, to] = seeds;
  sizeTarget(gl, from, "seeds", size);
  sizeTarget(gl, to, "seeds", size);
  const seedAt = activate(gl, programs.seed);
  gl.uniform1i(seedAt("u_mask"), 0);
  bind(gl, 0, mask);
  drawInto(gl, from, size);

  const floodAt = activate(gl, programs.flood);
  gl.uniform1i(floodAt("u_seeds"), 0);
  for (const step of floodSteps(distance)) {
    bind(gl, 0, from.texture);
    gl.uniform1i(floodAt("u_step"), step);
    drawInto(gl, to, size);
    [from, to] = [to, from];
  }
  return from;
};

// The owner's field (see FIELD_SHADER), drawn again only when its key
// changed. Scratch memory (the mask, the seeds) is handed back afterwards.
// The target an owner's field lives in, most recently used last, and
// whether it already holds this key
const cachedTarget = (
  gl: WebGL2RenderingContext,
  state: State,
  owner: object,
  key: string
): { target: Target; current: boolean } => {
  const cached = state.fields.get(owner);
  state.fields.delete(owner);
  const target = cached?.target ?? createTarget(gl, "field");
  state.fields.set(owner, { key, target });
  for (const [other, field] of state.fields) {
    if (state.fields.size <= MAX_FIELDS) {
      break;
    }
    deleteTarget(gl, field.target);
    state.fields.delete(other);
  }
  return { current: cached?.key === key, target };
};

const fieldFor = (
  gl: WebGL2RenderingContext,
  state: State,
  job: EffectsJob
): Target => {
  const { layout, owner } = job;
  const { current, target } = owner
    ? cachedTarget(gl, state, owner, job.fieldKey)
    : { current: false, target: state.scratch };
  if (current) {
    return target;
  }

  maskCanvas ??= document.createElement("canvas");
  drawPhotoMask(maskCanvas, job.mask, layout);
  bind(gl, 0, state.mask);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    maskCanvas
  );
  maskCanvas.width = 0;
  maskCanvas.height = 0;

  sizeTarget(gl, target, "field", layout.size);
  const width = job.paint.outline?.width ?? 0;
  if (width > 0) {
    // One more pixel for the outline's soft edge
    const seeds = flood(gl, state, layout.size, width + 1);
    const at = activate(gl, state.programs.field);
    gl.uniform1i(at("u_mask"), 0);
    gl.uniform1i(at("u_seeds"), 1);
    gl.uniform1f(at("u_width"), width);
    bind(gl, 0, state.mask);
    bind(gl, 1, seeds.texture);
  } else {
    const at = activate(gl, state.programs.plainField);
    gl.uniform1i(at("u_mask"), 0);
    bind(gl, 0, state.mask);
  }
  drawInto(gl, target, layout.size);
  bind(gl, 0, target.texture);
  gl.generateMipmap(gl.TEXTURE_2D);

  for (const seeds of state.seeds) {
    sizeTarget(gl, seeds, "seeds", ONE_PIXEL);
  }
  bind(gl, 0, state.mask);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  return target;
};

// The canvas only grows, so outputs of different sizes share it
const fitCanvas = (canvas: HTMLCanvasElement, size: Size) => {
  if (canvas.width < size.width || canvas.height < size.height) {
    canvas.width = Math.max(canvas.width, size.width);
    canvas.height = Math.max(canvas.height, size.height);
  }
};

// Copies what was just drawn at the canvas's bottom left (where the
// viewport starts) into a caller's canvas, while the drawing buffer is
// still valid (same task)
const copyOut = (
  glCanvas: HTMLCanvasElement,
  size: Size,
  target: HTMLCanvasElement
) => {
  if (target.width !== size.width || target.height !== size.height) {
    target.width = size.width;
    target.height = size.height;
  }
  const context = target.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, size.width, size.height);
  context.drawImage(
    glCanvas,
    0,
    glCanvas.height - size.height,
    size.width,
    size.height,
    0,
    0,
    size.width,
    size.height
  );
};

// Where a region of the field is, in its uv: offset, then size
const regionUv = (
  region: Rect,
  size: Size
): [number, number, number, number] => [
  region.x / size.width,
  region.y / size.height,
  region.width / size.width,
  region.height / size.height,
];

// Outline and glow, from the field and the field blurred by the glow
const drawHalo = (
  gl: WebGL2RenderingContext,
  { canvas, programs }: State & { canvas: HTMLCanvasElement },
  field: Target,
  job: EffectsJob,
  region: Rect
) => {
  const { layout, paint } = job;
  gl.activeTexture(gl.TEXTURE0);
  const glow = paint.glow
    ? blurred(field.texture, paint.glow.sigma, layout.size)
    : null;
  const size = { height: region.height, width: region.width };
  fitCanvas(canvas, size);
  const at = activate(gl, programs.halo, 1);
  gl.uniform1i(at("u_field"), 0);
  gl.uniform1i(at("u_glow"), 1);
  gl.uniform4fv(at("u_region"), regionUv(region, layout.size));
  gl.uniform4fv(at("u_outlineColor"), paint.outline?.color ?? [0, 0, 0, 0]);
  gl.uniform4fv(at("u_glowColor"), paint.glow?.color ?? [0, 0, 0, 0]);
  // A glow too small to blur is drawn as the silhouette itself
  gl.uniform1f(at("u_glowGain"), paint.glow?.gain ?? 0);
  gl.uniform1f(at("u_opacity"), paint.opacity);
  bind(gl, 0, field.texture);
  bind(gl, 1, glow?.texture ?? field.texture);
  drawInto(gl, null, size);
  copyOut(canvas, size, job.halo);
};

// The silhouette in the shadow's colour, at the blur's reduced size
const drawShadow = (
  gl: WebGL2RenderingContext,
  { canvas, programs }: State & { canvas: HTMLCanvasElement },
  field: Target,
  job: EffectsJob,
  region: Rect,
  sigma: number,
  color: [number, number, number, number]
) => {
  const { layout } = job;
  gl.activeTexture(gl.TEXTURE0);
  const blur = blurred(field.texture, sigma, layout.size);
  const source = blur ?? { size: layout.size, texture: field.texture };
  const size = {
    height: Math.max(
      1,
      Math.round((region.height * source.size.height) / layout.size.height)
    ),
    width: Math.max(
      1,
      Math.round((region.width * source.size.width) / layout.size.width)
    ),
  };
  fitCanvas(canvas, size);
  const at = activate(gl, programs.shadow, 1);
  gl.uniform1i(at("u_source"), 0);
  gl.uniform4fv(at("u_region"), regionUv(region, layout.size));
  gl.uniform4fv(at("u_color"), color);
  bind(gl, 0, source.texture);
  drawInto(gl, null, size);
  copyOut(canvas, size, job.shadow);
};

// Draws a photo's effects into the job's canvases. Null when this browser
// has no WebGL2.
export const renderPhotoEffects = (job: EffectsJob): EffectsOutput | null => {
  const shared = sharedGl();
  if (!shared) {
    return null;
  }
  const { canvas, gl } = shared;
  const state = { ...stateFor(gl), canvas };
  const { layout, paint } = job;
  const field = fieldFor(gl, state, job);
  const halo = layout.halo !== null && (paint.outline ?? paint.glow) !== null;
  if (layout.halo && halo) {
    drawHalo(gl, state, field, job, layout.halo);
  }
  const shadow = layout.shadow !== null && paint.shadow !== null;
  if (layout.shadow && paint.shadow) {
    drawShadow(
      gl,
      state,
      field,
      job,
      layout.shadow,
      paint.shadow.sigma,
      paint.shadow.color
    );
  }
  gl.activeTexture(gl.TEXTURE0);
  return { halo, shadow };
};

// Frees the field kept for an owner (its effects were removed, or it's gone)
export const forgetPhotoEffects = (owner: object) => {
  const shared = sharedGl();
  const state = shared ? states.get(shared.gl) : undefined;
  const field = state?.fields.get(owner);
  if (shared && state && field) {
    deleteTarget(shared.gl, field.target);
    state.fields.delete(owner);
  }
};
