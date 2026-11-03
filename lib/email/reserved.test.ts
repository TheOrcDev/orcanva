import { describe, expect, it } from "vitest";

import { isReservedAddress } from "@/lib/email/reserved";

describe("isReservedAddress", () => {
  it("catches the example and test domains", () => {
    expect(isReservedAddress("orcanva-e2e-owner-1@example.com")).toBe(true);
    expect(isReservedAddress("a@EXAMPLE.org")).toBe(true);
    expect(isReservedAddress("a@mail.test")).toBe(true);
    expect(isReservedAddress("a@nowhere.invalid")).toBe(true);
    expect(isReservedAddress("a@localhost")).toBe(true);
  });

  it("lets real domains through, lookalikes included", () => {
    expect(isReservedAddress("jay@gmail.com")).toBe(false);
    expect(isReservedAddress("jay@example.co")).toBe(false);
    expect(isReservedAddress("jay@notexample.com")).toBe(false);
    expect(isReservedAddress("jay@testing.dev")).toBe(false);
  });
});
