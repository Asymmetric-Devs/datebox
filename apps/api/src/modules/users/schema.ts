import { z } from "@hono/zod-openapi";
import { TagSchema } from "../tags/schema.js";

export const UserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().min(1),
    avatarUrl: z.string().nullable(),
    elder: z.boolean(),
    timezone: z.string().nullable(),
    interests: z.array(TagSchema).optional(),
  })
  .openapi("User");

export type User = z.infer<typeof UserSchema>;

export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    avatarUrl: z.string().optional(),
    timezone: z.string().optional(),
  })
  .strict()
  .openapi("UpdateUser");

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const SaveInterestsSchema = z
  .object({
    tagIds: z.array(z.string().uuid()),
  })
  .openapi("SaveInterests");
