import { describe, expect, it } from "vitest";
import { generatePrefillUrl } from "./formParser";
import type { FormFieldMapping } from "@shared/types";

describe("generatePrefillUrl", () => {
  const baseUrl = "https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform";
  const fields: FormFieldMapping = {
    tutor: "entry.100",
    studentId: "entry.200",
    studentName: "entry.300",
    courseId: "entry.400",
    courseTopic: "entry.500",
    gender: "entry.600",
  };

  it("generates a correctly encoded prefill URL with all fields", () => {
    const student = { name: "TOM", id: "20000234", gender: "他" };
    const commonData = { tutor: "Mr. Chan", courseId: "ENG101", courseTopic: "Summer English" };

    const url = generatePrefillUrl(baseUrl, fields, student, commonData);

    expect(url).toContain(baseUrl + "?");
    expect(url).toContain("entry.300=TOM");
    expect(url).toContain("entry.200=20000234");
    expect(url).toContain("entry.600=" + encodeURIComponent("他"));
    expect(url).toContain("entry.100=" + encodeURIComponent("Mr. Chan"));
    expect(url).toContain("entry.400=ENG101");
    expect(url).toContain("entry.500=" + encodeURIComponent("Summer English"));
  });

  it("omits fields when values are empty", () => {
    const student = { name: "JOHN", id: "20211133", gender: "他" };
    const commonData = { tutor: "", courseId: "ENG101" };

    const url = generatePrefillUrl(baseUrl, fields, student, commonData);

    expect(url).toContain("entry.300=JOHN");
    expect(url).toContain("entry.200=20211133");
    expect(url).not.toContain("entry.100=");
    expect(url).toContain("entry.400=ENG101");
    expect(url).not.toContain("entry.500=");
  });

  it("handles partial field mappings", () => {
    const partialFields: FormFieldMapping = {
      studentName: "entry.300",
      studentId: "entry.200",
    };
    const student = { name: "APPLE", id: "20200517", gender: "她" };
    const commonData = { tutor: "Ms. Lee", courseId: "MATH202", courseTopic: "Algebra" };

    const url = generatePrefillUrl(baseUrl, partialFields, student, commonData);

    expect(url).toContain("entry.300=APPLE");
    expect(url).toContain("entry.200=20200517");
    // Gender and common fields should not appear since no mapping exists
    expect(url).not.toContain("entry.600");
    expect(url).not.toContain("entry.100");
  });
});
