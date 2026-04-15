import { z } from "@hono/zod-openapi";
import { TagSchema } from "../tags/schema.js";

export const DateEventSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1, "El título es obligatorio"),
    description: z.string().optional().nullable(),
    startsAt: z.string(),
    endsAt: z.string().optional().nullable(),
    completed: z.boolean(),
    createdBy: z.uuid(),
    groupId: z.uuid().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    frequencyId: z.uuid().optional().nullable(),
  })
  .openapi("DateEvent");

export type DateEvent = z.infer<typeof DateEventSchema>;

export const EventWithTagsSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().optional().nullable(),
    startsAt: z.string(),
    endsAt: z.string().optional().nullable(),
    createdBy: z.uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
    tags: z.array(TagSchema),
  })
  .openapi("EventWithTags");

export type EventWithTags = z.infer<typeof EventWithTagsSchema>;

export const PaginatedEventsSchema = z
  .object({
    data: z.array(EventWithTagsSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  })
  .openapi("PaginatedEvents");

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

