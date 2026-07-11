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
        content: `You are a data extraction assistant. Given pasted text that contains people/student information, extract each person's:
1. English name (first name only, uppercase, remove any special characters like *, trim spaces)
2. Student ID number (digits only, remove parentheses) - this may NOT be present for all entries

The text format varies. Common patterns include:
- English name followed by Chinese name on the same line (e.g., "TOM陳大文" or "JOHN 馮大文*")
- Sometimes a line below with the student ID in parentheses (e.g., "(20000234)")
- Sometimes just names without IDs
- Names may be separated by newlines, commas, or spaces

Rules:
- Extract ONLY the English portion of the name (before any Chinese characters)
- Remove any trailing/leading spaces and special characters (*, #, etc.) from names
- Remove parentheses from student IDs, keep only digits
- If there is no student ID, use empty string "" for the id field
- NEVER skip an entry just because it has no ID - extract the name anyway
- Return results in the order they appear in the text
- If you find at least one English name, you MUST return it

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
                  id: { type: "string", description: "Student ID digits only, or empty string if not available" },
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
