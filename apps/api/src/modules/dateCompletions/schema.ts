import { z } from "zod";

// Schema para DateCompletion
export const DateCompletionSchema = z.object({
  id: z.string().uuid(),
  dateId: z.string().uuid(),
  userId: z.string().uuid(),
  completedDate: z.string(), // YYYY-MM-DD
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DateCompletion = z.infer<typeof DateCompletionSchema>;

// Schema para crear una nueva completación
export const NewDateCompletionSchema = z.object({
  dateId: z.string().uuid(),
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

export type NewDateCompletion = z.infer<typeof NewDateCompletionSchema>;

// Schema para obtener completaciones (query params)
export const GetDateCompletionsQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateId: z.string().uuid().optional(),
});

export type GetDateCompletionsQuery = z.infer<
  typeof GetDateCompletionsQuerySchema
>;
