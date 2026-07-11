import { describe, expect, it } from "vitest";

describe("OpenRouter API Key", () => {
  it("OPENROUTER_API_KEY environment variable is set", () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(10);
  });
});
