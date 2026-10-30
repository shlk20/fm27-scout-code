import { describe, expect, it } from "vitest";
import { formatValue, initials, formatWage } from "./utils";

describe("formatValue", () => {
  it("formats millions", () => {
    expect(formatValue(4_408_650)).toBe("4.41M");
    expect(formatValue(1_500)).toBe("2K");
  });
  it("uses an em dash for missing values", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue(0)).toBe("—");
  });
});

describe("formatWage", () => {
  it("appends per-week marker", () => {
    expect(formatWage(106965)).toContain("106,965");
    expect(formatWage(null)).toBe("—");
  });
});

describe("initials", () => {
  it("handles multi-part names", () => {
    expect(initials("Luka Modrić")).toBe("LM");
    expect(initials("Modric")).toBe("MO");
    expect(initials(null)).toBe("?");
  });
});
