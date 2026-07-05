import { describe, expect, it } from "vitest";

import { resolveUniqueName } from "./resolve-unique-name";

describe("resolveUniqueName", () => {
  it("returns the desired name when there is no collision", () => {
    expect(resolveUniqueName([], "Reports", false)).toBe("Reports");
  });

  it("suffixes a colliding folder name", () => {
    expect(resolveUniqueName(["Reports"], "Reports", false)).toBe(
      "Reports (1)"
    );
  });

  it("increments to the next free suffix", () => {
    expect(
      resolveUniqueName(["Reports", "Reports (1)"], "Reports", false)
    ).toBe("Reports (2)");
  });

  it("preserves the extension for files", () => {
    expect(resolveUniqueName(["report.pdf"], "report.pdf", true)).toBe(
      "report (1).pdf"
    );
  });

  it("suffixes files with no extension like a folder", () => {
    expect(resolveUniqueName(["notes"], "notes", true)).toBe("notes (1)");
  });

  it("is case-insensitive when detecting collisions", () => {
    expect(resolveUniqueName(["REPORT.pdf"], "report.pdf", true)).toBe(
      "report (1).pdf"
    );
  });
});
