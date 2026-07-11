import { describe, expect, it } from "vitest";
// We need to test the fuzzyMatchOption function from routers.ts
// Since it's not exported, we'll test it indirectly or extract it
// For now, let's test the logic directly

function fuzzyMatchOption(input: string, options: string[]): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const exact = options.find(o => o === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const caseMatch = options.find(o => o.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  const substringMatch = options.find(o => o.toLowerCase().includes(lower));
  if (substringMatch) return substringMatch;

  const words = lower.split(/\s+/).filter(w => w.length > 1);
  for (const word of words) {
    const wordMatch = options.find(o => o.toLowerCase().includes(word));
    if (wordMatch) return wordMatch;
  }

  return trimmed;
}

describe("fuzzyMatchOption", () => {
  const tutorOptions = ["MISS KIBBY", "MISS SHAN SHAN", "NEO SIR", "FAI SIR", "BOB SIR", "MISS NATALIE"];
  const topicOptions = ["小檸檬實驗室", "Python 編程先導班", "Scratch 圖形化編程入門班", "我的 AI 精靈"];

  it("matches exact value", () => {
    expect(fuzzyMatchOption("BOB SIR", tutorOptions)).toBe("BOB SIR");
  });

  it("matches case-insensitively", () => {
    expect(fuzzyMatchOption("bob sir", tutorOptions)).toBe("BOB SIR");
    expect(fuzzyMatchOption("miss kibby", tutorOptions)).toBe("MISS KIBBY");
  });

  it("matches by keyword substring", () => {
    expect(fuzzyMatchOption("KIBBY", tutorOptions)).toBe("MISS KIBBY");
    expect(fuzzyMatchOption("NEO", tutorOptions)).toBe("NEO SIR");
    expect(fuzzyMatchOption("FAI", tutorOptions)).toBe("FAI SIR");
  });

  it("matches Chinese topic by keyword", () => {
    expect(fuzzyMatchOption("小檸檬", topicOptions)).toBe("小檸檬實驗室");
    expect(fuzzyMatchOption("Python", topicOptions)).toBe("Python 編程先導班");
    expect(fuzzyMatchOption("AI 精靈", topicOptions)).toBe("我的 AI 精靈");
  });

  it("returns original input when no match found", () => {
    expect(fuzzyMatchOption("UNKNOWN", tutorOptions)).toBe("UNKNOWN");
  });
});
