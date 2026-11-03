import { describe, expect, it } from "vitest";

import {
  canManageHistory,
  keepsPrivateAccess,
  roleFor,
} from "@/lib/auth/access";

const OWNER = "8f1c0e1e-6c5d-4c71-9f7b-0b5a3a1d2e01";
const SOMEONE = "2b7d4c3a-1e9f-4a8b-b6c5-d4e3f2a1b0c9";

describe("roleFor", () => {
  it("lets the owner manage their design, public or private", () => {
    expect(
      roleFor({ ownerId: OWNER, visibility: "private" }, OWNER, false)
    ).toBe("owner");
    expect(
      roleFor({ ownerId: OWNER, visibility: "public" }, OWNER, false)
    ).toBe("owner");
  });

  it("lets anyone, guests included, edit a public design", () => {
    expect(
      roleFor({ ownerId: OWNER, visibility: "public" }, SOMEONE, false)
    ).toBe("editor");
    expect(roleFor({ ownerId: OWNER, visibility: "public" }, null, false)).toBe(
      "editor"
    );
  });

  it("hides a private design from everyone but its owner", () => {
    expect(
      roleFor({ ownerId: OWNER, visibility: "private" }, SOMEONE, false)
    ).toBe(null);
    expect(
      roleFor({ ownerId: OWNER, visibility: "private" }, null, false)
    ).toBe(null);
  });

  it("lets people it's shared with in, public or private", () => {
    expect(
      roleFor({ ownerId: OWNER, visibility: "private" }, SOMEONE, true)
    ).toBe("member");
    expect(
      roleFor({ ownerId: OWNER, visibility: "public" }, SOMEONE, true)
    ).toBe("member");
  });

  it("never treats a guest as someone it's shared with", () => {
    expect(roleFor({ ownerId: OWNER, visibility: "private" }, null, true)).toBe(
      null
    );
  });

  it("keeps the owner the owner when they share with themselves", () => {
    expect(
      roleFor({ ownerId: OWNER, visibility: "private" }, OWNER, true)
    ).toBe("owner");
  });

  it("never makes a guest the owner of an ownerless design", () => {
    expect(roleFor({ ownerId: null, visibility: "public" }, null, false)).toBe(
      "editor"
    );
    expect(roleFor({ ownerId: null, visibility: "private" }, null, false)).toBe(
      null
    );
    expect(
      roleFor({ ownerId: null, visibility: "public" }, SOMEONE, false)
    ).toBe("editor");
  });
});

describe("keepsPrivateAccess", () => {
  it("keeps the owner and people it's shared with on a private design", () => {
    expect(keepsPrivateAccess("owner")).toBe(true);
    expect(keepsPrivateAccess("member")).toBe(true);
    expect(keepsPrivateAccess("editor")).toBe(false);
  });
});

describe("canManageHistory", () => {
  it("shows version history to the owner and people it's shared with", () => {
    expect(canManageHistory("owner")).toBe(true);
    expect(canManageHistory("member")).toBe(true);
  });

  it("hides it from public editors and guests, on any design", () => {
    expect(canManageHistory("editor")).toBe(false);
    const guest = roleFor(
      { ownerId: OWNER, visibility: "public" },
      null,
      false
    );
    expect(guest && canManageHistory(guest)).toBe(false);
    const ownerless = roleFor(
      { ownerId: null, visibility: "public" },
      SOMEONE,
      false
    );
    expect(ownerless && canManageHistory(ownerless)).toBe(false);
  });
});
