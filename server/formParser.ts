import { invokeLLM } from "./_core/llm";
import type { FormFieldMapping, ParsedFormResult } from "@shared/types";

/**
 * Fetches a Google Form page and extracts the FB_PUBLIC_LOAD_DATA_ script
 * to determine entry IDs for each field.
 */
export async function parseGoogleForm(formUrl: string): Promise<ParsedFormResult> {
  // Normalize URL to viewform
  const baseUrl = formUrl
    .replace(/\/edit.*$/, "/viewform")
    .replace(/\/formResponse.*$/, "/viewform")
    .replace(/\?.*$/, "");

  // Fetch the form HTML
  const response = await fetch(baseUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch form: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Extract FB_PUBLIC_LOAD_DATA_ script content
  const dataMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!dataMatch) {
    throw new Error("Could not find FB_PUBLIC_LOAD_DATA_ in the form page. Please ensure the URL is a valid Google Form.");
  }

  const rawData = dataMatch[1];

  // Extract form title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const formTitle = titleMatch ? titleMatch[1].replace(" - Google Forms", "").trim() : undefined;

  // Use LLM to intelligently map fields from the raw data
  const fields = await extractFieldMappings(rawData, formTitle);

  return {
    baseUrl,
    fields,
    formTitle,
  };
}

async function extractFieldMappings(rawData: string, formTitle?: string): Promise<FormFieldMapping> {
  // Extract fields with their correct sub-field IDs (used for prefill URLs)
  const fieldEntries = extractFieldsWithSubIds(rawData);

  if (fieldEntries.length === 0) {
    throw new Error("Could not extract any form fields. The form structure may not be supported.");
  }

  // Use LLM to map extracted fields to our expected schema
  const fieldListStr = fieldEntries
    .map(f => `entry.${f.subFieldId}: "${f.label}" (type: ${f.type})`)
    .join("\n");

  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `You are a field mapping assistant. Given a list of Google Form fields (entry IDs and their labels), map them to the following categories:
- tutor: The field for the tutor/teacher name
- studentId: The field for student ID/number
- studentName: The field for student English name
- courseId: The field for course ID/number
- courseTopic: The field for course topic/subject
- gender: The field for student gender (he/she, 他/她)

Only map fields from the FIRST PAGE of the form (the basic info fields). Return ONLY a JSON object with the category as key and the full "entry.XXXXX" as value. You MUST only use entry IDs that appear in the provided field list. If a field cannot be confidently mapped, use an empty string.`,
      },
      {
        role: "user",
        content: `Form title: ${formTitle || "Unknown"}\n\nFields:\n${fieldListStr}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "field_mapping",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tutor: { type: "string", description: "entry.ID for tutor field" },
            studentId: { type: "string", description: "entry.ID for student ID" },
            studentName: { type: "string", description: "entry.ID for student name" },
            courseId: { type: "string", description: "entry.ID for course ID" },
            courseTopic: { type: "string", description: "entry.ID for course topic" },
            gender: { type: "string", description: "entry.ID for gender" },
          },
          required: ["tutor", "studentId", "studentName", "courseId", "courseTopic", "gender"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM did not return valid field mapping");
  }

  const mapping = JSON.parse(content) as FormFieldMapping;

  // Validate that returned entry IDs actually exist in the extracted fields
  const validIds = new Set(fieldEntries.map(f => `entry.${f.subFieldId}`));
  const validated: FormFieldMapping = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (value && validIds.has(value)) {
      (validated as any)[key] = value;
    }
  }

  // Check if we have at least studentName and studentId mapped
  if (!validated.studentName && !validated.studentId) {
    throw new Error("無法識別學生姓名或學生編號欄位。請確認表單包含相關欄位。");
  }

  return validated;
}

interface ExtractedFieldWithSubId {
  questionId: string;
  subFieldId: string;
  label: string;
  type: string;
}

/**
 * Extracts form fields with their correct sub-field IDs.
 * 
 * Google Forms structure in FB_PUBLIC_LOAD_DATA_:
 * [questionId, "label", description, type, [[subFieldId, ...]]]
 * 
 * The PREFILL URL uses subFieldId (not questionId).
 * - type 0 = text input
 * - type 2 = radio/checkbox
 * - type 3 = dropdown
 */
function extractFieldsWithSubIds(rawData: string): ExtractedFieldWithSubId[] {
  const fields: ExtractedFieldWithSubId[] = [];

  // Pattern matches: [questionId,"label",description_or_null,type,[[subFieldId
  // The description can be a quoted string or null
  const pattern = /\[(\d{9,10}),"([^"]*)",(?:"[^"]*"|null),(\d),\[\[(\d{7,10})/g;
  let match;

  while ((match = pattern.exec(rawData)) !== null) {
    const [, questionId, label, type, subFieldId] = match;
    const typeNames: Record<string, string> = { "0": "text", "2": "radio", "3": "dropdown" };
    fields.push({
      questionId,
      subFieldId,
      label: label.split("\\n")[0].trim(), // Only take first line of label
      type: typeNames[type] || `type${type}`,
    });
  }

  return fields;
}

/**
 * Generate a prefilled Google Form URL for a single student
 */
export function generatePrefillUrl(
  baseUrl: string,
  fields: FormFieldMapping,
  student: { name: string; id: string; gender: string },
  commonData: { tutor?: string; courseId?: string; courseTopic?: string }
): string {
  const params: string[] = [];

  if (fields.studentName && student.name) {
    params.push(`${fields.studentName}=${encodeURIComponent(student.name)}`);
  }
  if (fields.studentId && student.id) {
    params.push(`${fields.studentId}=${encodeURIComponent(student.id)}`);
  }
  if (fields.gender && student.gender) {
    params.push(`${fields.gender}=${encodeURIComponent(student.gender)}`);
  }
  if (fields.tutor && commonData.tutor) {
    params.push(`${fields.tutor}=${encodeURIComponent(commonData.tutor)}`);
  }
  if (fields.courseId && commonData.courseId) {
    params.push(`${fields.courseId}=${encodeURIComponent(commonData.courseId)}`);
  }
  if (fields.courseTopic && commonData.courseTopic) {
    params.push(`${fields.courseTopic}=${encodeURIComponent(commonData.courseTopic)}`);
  }

  return `${baseUrl}?${params.join("&")}`;
}
