import { invokeLLM } from "./_core/llm";
import type { ParsedStudent } from "@shared/types";

/**
 * Uses LLM to intelligently parse pasted text and extract student information.
 * Handles various formats flexibly.
 */
export async function parseStudentText(text: string): Promise<ParsedStudent[]> {
  if (!text.trim()) {
    return [];
  }

  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `You are a data extraction assistant. Given pasted text that contains student information, extract each student's:
1. English name (first name only, uppercase, remove any special characters like *)
2. Student ID number (digits only, remove parentheses)

The text format varies but typically has:
- A line with English name followed by Chinese name (e.g., "TOM陳大文" or "JOHN 馮大文*")
- A line below with the student ID in parentheses (e.g., "(20000234)")

Rules:
- Extract ONLY the English portion of the name (before any Chinese characters)
- Remove any trailing/leading spaces and special characters (*, #, etc.) from names
- Remove parentheses from student IDs, keep only digits
- If you cannot determine the English name or ID for an entry, skip it
- Return results in the order they appear in the text

Return a JSON array of objects with "name" and "id" fields.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "parsed_students",
        strict: true,
        schema: {
          type: "object",
          properties: {
            students: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "English name only, uppercase" },
                  id: { type: "string", description: "Student ID digits only" },
                },
                required: ["name", "id"],
                additionalProperties: false,
              },
            },
          },
          required: ["students"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM did not return valid parsed data");
  }

  const parsed = JSON.parse(content) as { students: ParsedStudent[] };
  return parsed.students;
}

