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
        })
      )
      .mutation(({ input }) => {
        const { baseUrl, fields, students, commonData } = input;
        return students.map((student) => ({
          name: student.name,
          id: student.id,
          gender: student.gender,
          link: generatePrefillUrl(baseUrl, fields, student, commonData),
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
