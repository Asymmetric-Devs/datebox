import { z } from "@hono/zod-openapi";

export const GroupSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    ownerUserId: z.uuid(),
    createdAt: z.date(), // TODO: Check how the date is represented
    code: z.string().optional(),
    expiresAt: z.date().optional(),
  })
  .openapi("Group");

export type Group = z.infer<typeof GroupSchema>;

export const NewGroupSchema = z
  .object({
    name: z.string().min(1),
    ownerUserId: z.uuid(),
  })
  .openapi("NewGroup");

export type NewGroup = z.infer<typeof NewGroupSchema>;

export const UpdateGroupSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict()
  .openapi("UpdateGroup");

export type UpdateGroup = z.infer<typeof UpdateGroupSchema>;

export const AddUserWithCodeSchema = z
  .object({
    userId: z.uuid(),
    invitationCode: z.string().min(1),
  })
  .openapi("AddUserWithCode");

export type AddUserWithCode = z.infer<typeof AddUserWithCodeSchema>;

export const TransferOwnershipSchema = z
  .object({
    newOwnerId: z.uuid(),
  })
  .strict()
  .openapi("TransferOwnership");

export type TransferOwnership = z.infer<typeof TransferOwnershipSchema>;

export const UserGroupSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.string().nullable(),
    joinedAt: z.string().nullable(),
    ownerUserId: z.string().uuid(),
  })
  .openapi("UserGroup");

export type UserGroup = z.infer<typeof UserGroupSchema>;
