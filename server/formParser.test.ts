import { describe, expect, it } from "vitest";
import { generatePrefillUrl, parseGoogleFormHtml } from "./formParser";
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

describe("parseGoogleFormHtml", () => {
  // Fixture: minimal FB_PUBLIC_LOAD_DATA_ structure mimicking real Google Form
  const fixtureHtml = `<html><head><title>Test Form - Google Forms</title></head><body>
<script>var FB_PUBLIC_LOAD_DATA_ = [null,["Description",[[1715585088,"TUTOR",null,3,[[1186878729,[["MISS KIBBY",null,null,null,0],["BOB SIR",null,null,null,0]],1,null,null,null,null,null,0]],null,null,null,null,null,null,[null,"TUTOR"]],[484709074,"學生編號",null,0,[[1845291328,null,1]],null,null,null,null,null,null,[null,"學生編號"]],[963194900,"學生英文名字",null,0,[[992838020,null,1]],null,null,null,null,null,null,[null,"學生英文名字"]],[1032180762,"課程編號",null,0,[[421535699,null,1]],null,null,null,null,null,null,[null,"課程編號"]],[1863053411,"課程主題",null,2,[[1483897475,[["小檸檬實驗室",null,null,null,0],["Python 編程先導班",null,null,null,0]],1,null,null,null,null,null,0]],null,null,null,null,null,null,[null,"課程主題"]],[1762613942,"學生性別",null,2,[[722421670,[["他",null,null,null,0],["她",null,null,null,0]],1,null,null,null,null,null,0]],null,null,null,null,null,null,[null,"學生性別"]]]]]; </script></body></html>`;

  it("extracts fields with correct subFieldIds", () => {
    const result = parseGoogleFormHtml(fixtureHtml, "https://docs.google.com/forms/d/e/test/viewform");
    expect(result.fields).toBeDefined();
    expect(result.formTitle).toBe("Test Form");
  });

  it("extracts field options for dropdown and radio fields", () => {
    const result = parseGoogleFormHtml(fixtureHtml, "https://docs.google.com/forms/d/e/test/viewform");
    expect(result.fieldOptions).toBeDefined();
    // Tutor options
    expect(result.fieldOptions?.tutor).toContain("MISS KIBBY");
    expect(result.fieldOptions?.tutor).toContain("BOB SIR");
    // Course topic options
    expect(result.fieldOptions?.courseTopic).toContain("小檸檬實驗室");
    expect(result.fieldOptions?.courseTopic).toContain("Python 編程先導班");
    // Gender options
    expect(result.fieldOptions?.gender).toContain("他");
    expect(result.fieldOptions?.gender).toContain("她");
  });
});
