import { z } from "@hono/zod-openapi";

export const TagSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    category: z.string().nullable(),
    description: z.string().nullable(),
  })
  .openapi("Tag");

export type Tag = z.infer<typeof TagSchema>;
