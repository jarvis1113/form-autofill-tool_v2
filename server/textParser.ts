import { invokeLLM } from "./_core/llm";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ParsedStudent } from "@shared/types";

/**
 * Uses OpenRouter API to intelligently parse pasted text and extract student information.
 * Handles various formats flexibly.
 */
export async function parseStudentText(text: string): Promise<ParsedStudent[]> {
  if (!text.trim()) {
    return [];
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const systemPrompt = `You are a data extraction assistant. Given pasted text that contains people/student information, extract each person's:
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

Return ONLY a JSON object: {"students": [{"name": "...", "id": "..."}]}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-8b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter did not return valid parsed data");
  }

  const parsed = JSON.parse(content) as { students: ParsedStudent[] };
  return parsed.students;
}
