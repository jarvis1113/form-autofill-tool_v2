import { describe, it, expect } from "vitest";

describe("OpenRouter API Key", () => {
  it("should have OPENROUTER_API_KEY set in environment", () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key?.startsWith("sk-or-")).toBe(true);
  });

  it("should be able to reach OpenRouter API (key validation)", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    // Just check the models endpoint which is lightweight
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    // 200 = valid key, 429 = valid key but rate limited, both are acceptable
    expect([200, 429]).toContain(response.status);
  });
});
