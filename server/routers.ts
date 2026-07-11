import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parseGoogleForm, generatePrefillUrl } from "./formParser";
import { parseStudentText } from "./textParser";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  form: router({
    parseForm: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        return await parseGoogleForm(input.url);
      }),

    parseText: publicProcedure
      .input(z.object({ text: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return await parseStudentText(input.text);
      }),

    generateLinks: publicProcedure
      .input(
        z.object({
          baseUrl: z.string().url(),
          fields: z.object({
            tutor: z.string().optional(),
            studentId: z.string().optional(),
            studentName: z.string().optional(),
            courseId: z.string().optional(),
            courseTopic: z.string().optional(),
            gender: z.string().optional(),
          }),
          students: z.array(
            z.object({
              name: z.string(),
              id: z.string(),
              gender: z.string(),
            })
          ),
          commonData: z.object({
            tutor: z.string().optional(),
            courseId: z.string().optional(),
            courseTopic: z.string().optional(),
          }),
          fieldOptions: z.record(z.string(), z.array(z.string())).optional(),
        })
      )
      .mutation(({ input }) => {
        const { baseUrl, fields, students, commonData, fieldOptions = {} } = input;

        // Auto-match tutor and courseTopic to exact option values
        const matchedCommonData = { ...commonData };
        if (commonData.tutor && fieldOptions.tutor && Array.isArray(fieldOptions.tutor)) {
          matchedCommonData.tutor = fuzzyMatchOption(commonData.tutor, fieldOptions.tutor as string[]);
        }
        if (commonData.courseTopic && fieldOptions.courseTopic && Array.isArray(fieldOptions.courseTopic)) {
          matchedCommonData.courseTopic = fuzzyMatchOption(commonData.courseTopic, fieldOptions.courseTopic as string[]);
        }

        return students.map((student) => ({
          name: student.name,
          id: student.id,
          gender: student.gender,
          link: generatePrefillUrl(baseUrl, fields, student, matchedCommonData),
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;

/**
 * Fuzzy match user input to the closest option in the list.
 * Matches by: exact match > case-insensitive match > substring match > first keyword match
 */
function fuzzyMatchOption(input: string, options: string[]): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // 1. Exact match
  const exact = options.find(o => o === trimmed);
  if (exact) return exact;

  // 2. Case-insensitive match
  const lower = trimmed.toLowerCase();
  const caseMatch = options.find(o => o.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Input is substring of an option (e.g. "KIBBY" matches "MISS KIBBY")
  const substringMatch = options.find(o => o.toLowerCase().includes(lower));
  if (substringMatch) return substringMatch;

  // 4. Option contains any word from input
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  for (const word of words) {
    const wordMatch = options.find(o => o.toLowerCase().includes(word));
    if (wordMatch) return wordMatch;
  }

  // 5. No match found - return original input (will likely not prefill correctly)
  return trimmed;
}
