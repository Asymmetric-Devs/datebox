import { z } from "@hono/zod-openapi";

export const DateEventSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional().nullable(),
    startsAt: z.date(),
    endsAt: z.date().optional().nullable(),
    completed: z.boolean(),
    createdBy: z.uuid(),
    groupId: z.uuid().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    frequencyId: z.uuid().optional().nullable(),
  })
  .openapi("DateEvent");

export type DateEvent = z.infer<typeof DateEventSchema>;

export const NewDateEventSchema = z
  .object({
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional(),
    startsAt: z.string(),
    endsAt: z.string().optional(),
    completed: z.boolean().optional().default(false),
    createdBy: z.uuid(),
    groupId: z.uuid(),
    frequencyId: z.uuid().optional().nullable(),
  })
  .openapi("NewDateEvent");

export type NewDateEvent = z.infer<typeof NewDateEventSchema>;

export const UpdateDateEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    startsAt: z.string(),
    endsAt: z.string().optional(),
    completed: z.boolean().optional(),
    groupId: z.uuid().optional(),
    frequencyId: z.uuid().optional().nullable(),
  })
  .strict()
  .openapi("UpdateDateEvent");

export type UpdateDateEvent = z.infer<typeof UpdateDateEventSchema>;
