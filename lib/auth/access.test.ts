import { describe, expect, it } from "vitest";

import { roleFor } from "@/lib/auth/access";

const OWNER = "8f1c0e1e-6c5d-4c71-9f7b-0b5a3a1d2e01";
const SOMEONE = "2b7d4c3a-1e9f-4a8b-b6c5-d4e3f2a1b0c9";

describe("roleFor", () => {
  it("lets the owner manage their design, public or private", () => {
    expect(roleFor({ ownerId: OWNER, visibility: "private" }, OWNER)).toBe(
      "owner"
    );
    expect(roleFor({ ownerId: OWNER, visibility: "public" }, OWNER)).toBe(
      "owner"
    );
  });

  it("lets anyone, guests included, edit a public design", () => {
    expect(roleFor({ ownerId: OWNER, visibility: "public" }, SOMEONE)).toBe(
      "editor"
    );
    expect(roleFor({ ownerId: OWNER, visibility: "public" }, null)).toBe(
      "editor"
    );
  });

  it("hides a private design from everyone but its owner", () => {
    expect(roleFor({ ownerId: OWNER, visibility: "private" }, SOMEONE)).toBe(
      null
    );
    expect(roleFor({ ownerId: OWNER, visibility: "private" }, null)).toBe(null);
  });

  it("never makes a guest the owner of an ownerless design", () => {
    expect(roleFor({ ownerId: null, visibility: "public" }, null)).toBe(
      "editor"
    );
    expect(roleFor({ ownerId: null, visibility: "private" }, null)).toBe(null);
    expect(roleFor({ ownerId: null, visibility: "public" }, SOMEONE)).toBe(
      "editor"
    );
  });
});
