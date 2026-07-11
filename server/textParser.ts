import { invokeLLM } from "./_core/llm";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ParsedStudent } from "@shared/types";

/**
 * Uses Google Gemini API to intelligently parse pasted text and extract student information.
 * Handles various formats flexibly.
 */
export async function parseStudentText(text: string): Promise<ParsedStudent[]> {
  if (!text.trim()) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          students: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "English name only, uppercase" },
                id: { type: SchemaType.STRING, description: "Student ID digits only, or empty string if not available" },
              },
              required: ["name", "id"],
            },
          },
        },
        required: ["students"],
      },
    },
    systemInstruction: `You are a data extraction assistant. Given pasted text that contains people/student information, extract each person's:
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
- If you find at least one English name, you MUST return it`,
  });

  const result = await model.generateContent(text);
  const content = result.response.text();

  if (!content) {
    throw new Error("Gemini did not return valid parsed data");
  }

  const parsed = JSON.parse(content) as { students: ParsedStudent[] };
  return parsed.students;
}
