import { describe, expect, it } from "vitest";

describe("Gemini API Key", () => {
  it("GEMINI_API_KEY environment variable is set", () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(10);
  });
});
