/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Form field mapping
export interface FormFieldMapping {
  tutor?: string;        // entry.ID for tutor field
  studentId?: string;    // entry.ID for student ID field
  studentName?: string;  // entry.ID for student English name field
  courseId?: string;      // entry.ID for course ID field
  courseTopic?: string;  // entry.ID for course topic field
  gender?: string;       // entry.ID for gender field
}

export interface ParsedFormResult {
  baseUrl: string;
  fields: FormFieldMapping;
  formTitle?: string;
}

// Parsed student data from text
export interface ParsedStudent {
  name: string;      // English name extracted
  id: string;        // Student ID (without brackets)
  gender?: string;   // 他 or 她
}

// Generated link for a student
export interface StudentLink {
  name: string;
  id: string;
  gender: string;
  link: string;
}
