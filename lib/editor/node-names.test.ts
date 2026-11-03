import Konva from "konva";
import { describe, expect, it } from "vitest";

import {
  PHOTO_EFFECTS_NAME,
  PHOTO_NODE_NAME,
  photoNodeOf,
} from "@/lib/editor/node-names";

const effects = () =>
  new Konva.Shape({ height: 10, name: PHOTO_EFFECTS_NAME, width: 10 });

describe("photoNodeOf", () => {
  it("finds an image's photo behind its effects", () => {
    const element = new Konva.Group();
    const photo = new Konva.Image({ image: undefined, name: PHOTO_NODE_NAME });
    element.add(effects(), photo);
    expect(photoNodeOf(element)).toBe(photo);
  });

  it("finds a frame's photo inside its clip group", () => {
    const element = new Konva.Group();
    const clip = new Konva.Group();
    const photo = new Konva.Image({ image: undefined, name: PHOTO_NODE_NAME });
    clip.add(photo);
    element.add(effects(), clip);
    expect(photoNodeOf(element)).toBe(photo);
  });

  it("finds nothing while the photo is still a placeholder", () => {
    const element = new Konva.Group();
    element.add(effects(), new Konva.Rect({ height: 10, width: 10 }));
    expect(photoNodeOf(element)).toBeUndefined();
  });
});
