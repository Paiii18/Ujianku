import { describe, expect, it } from "vitest";
import { fromWibInput, toWibInput } from "./format";

describe("WIB datetime-local", () => {
  it("bolak-balik ISO ↔ input WIB", () => {
    expect(fromWibInput("2026-10-20T07:30")).toBe("2026-10-20T00:30:00.000Z");
    expect(toWibInput("2026-10-19T20:15:00.000Z")).toBe("2026-10-20T03:15");
  });
});
