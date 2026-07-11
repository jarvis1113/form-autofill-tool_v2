import { invokeLLM } from "./_core/llm";
import type { FormFieldMapping, ParsedFormResult } from "@shared/types";
// invokeLLM kept for potential future use in fallback mapping

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
  return parseGoogleFormHtml(html, baseUrl);
}

/**
 * Parse form HTML directly (exported for testing).
 */
export function parseGoogleFormHtml(html: string, baseUrl: string): Omit<ParsedFormResult, "fields"> & { fields: FormFieldMapping; fieldOptions?: Record<string, string[]> } {
  // Extract FB_PUBLIC_LOAD_DATA_ script content
  const dataMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!dataMatch) {
    throw new Error("Could not find FB_PUBLIC_LOAD_DATA_ in the form page. Please ensure the URL is a valid Google Form.");
  }

  const rawData = dataMatch[1];

  // Extract form title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const formTitle = titleMatch ? titleMatch[1].replace(" - Google Forms", "").trim() : undefined;

  // Extract fields with sub-field IDs
  const fieldEntries = extractFieldsWithSubIds(rawData);

  if (fieldEntries.length === 0) {
    throw new Error("Could not extract any form fields. The form structure may not be supported.");
  }

  // Deterministic mapping based on field labels (no LLM needed for common patterns)
  const fields = mapFieldsDeterministic(fieldEntries);

  // Extract options for dropdown/radio fields
  const fieldOptions = extractFieldOptions(rawData, fields);

  return {
    baseUrl,
    fields,
    formTitle,
    fieldOptions,
  };
}

/**
 * Deterministic field mapping based on label matching.
 * Falls back to LLM only if needed.
 */
function mapFieldsDeterministic(fieldEntries: ExtractedFieldWithSubId[]): FormFieldMapping {
  const mapping: FormFieldMapping = {};

  for (const field of fieldEntries) {
    const label = field.label.toLowerCase();

    if (!mapping.tutor && (label.includes("tutor") || label.includes("導師"))) {
      mapping.tutor = `entry.${field.subFieldId}`;
    } else if (!mapping.studentId && (label.includes("學生編號") || label.includes("student id") || label.includes("編號"))) {
      mapping.studentId = `entry.${field.subFieldId}`;
    } else if (!mapping.studentName && (label.includes("英文名") || label.includes("student name") || label.includes("english name"))) {
      mapping.studentName = `entry.${field.subFieldId}`;
    } else if (!mapping.courseId && (label.includes("課程編號") || label.includes("course id") || label.includes("course code"))) {
      mapping.courseId = `entry.${field.subFieldId}`;
    } else if (!mapping.courseTopic && (label.includes("課程主題") || label.includes("course topic") || label.includes("主題"))) {
      mapping.courseTopic = `entry.${field.subFieldId}`;
    } else if (!mapping.gender && (label.includes("性別") || label.includes("gender"))) {
      mapping.gender = `entry.${field.subFieldId}`;
    }
  }

  return mapping;
}

/**
 * Extract available options for dropdown and radio fields.
 * Returns a map of field category -> option values.
 */
function extractFieldOptions(rawData: string, fields: FormFieldMapping): Record<string, string[]> {
  const options: Record<string, string[]> = {};

  // Get all fields with their sub-field IDs and options
  // Pattern: [[subFieldId,[["option1",null,...],["option2",null,...]],...]]
  let match;

  // Build a reverse map: subFieldId -> category name
  const subIdToCategory: Record<string, string> = {};
  for (const [category, entryId] of Object.entries(fields)) {
    if (entryId) {
      const id = entryId.replace("entry.", "");
      subIdToCategory[id] = category;
    }
  }

  // For each field, extract options if it's a dropdown (3) or radio (2)
  const allFieldsPattern = /\[\[(\d{7,10}),\[((?:\["[^"]*"(?:,(?:null|\d+))*\],?)+)\]/g;
  while ((match = allFieldsPattern.exec(rawData)) !== null) {
    const subFieldId = match[1];
    const optionsBlock = match[2];
    const category = subIdToCategory[subFieldId];

    if (category) {
      // Extract option texts from the block
      const optTexts: string[] = [];
      const optPattern = /\["([^"]+)"/g;
      let optMatch;
      while ((optMatch = optPattern.exec(optionsBlock)) !== null) {
        // Decode unicode escapes like \u003c -> <
        const decoded = optMatch[1]
          .replace(/\\u003c/g, "<")
          .replace(/\\u003e/g, ">")
          .replace(/\\u0026gt/g, ">")
          .replace(/\\u0026lt/g, "<")
          .replace(/\\u0026amp/g, "&");
        optTexts.push(decoded);
      }
      if (optTexts.length > 0) {
        options[category] = optTexts;
      }
    }
  }

  return options;
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
