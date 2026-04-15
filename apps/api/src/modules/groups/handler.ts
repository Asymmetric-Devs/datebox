import { OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AddUserWithCodeSchema,
  NewGroupSchema,
  UpdateGroupSchema,
  TransferOwnershipSchema,
  UserGroupSchema,
} from "./schema";
import { GroupService } from "./service";
import { ApiException, openApiErrorResponse } from "@/utils/api-error";
import { withAuth } from "@/middleware/auth";

export const groupApp = new OpenAPIHono();

declare module "hono" {
  interface ContextVariableMap {
    groupService: GroupService;
    user: { id: string };
  }
}

groupApp.use("/groups/*", async (c, next) => {
  const groupService = new GroupService(c.var.supabase);
  c.set("groupService", groupService);
  await next();
});

groupApp.openapi(
  {
    method: "get",
    path: "/groups/me",
    tags: ["groups"],
    middleware: [withAuth],
    responses: {
      200: {
        description: "List of user groups",
        content: {
          "application/json": {
            schema: z.array(UserGroupSchema),
          },
        },
      },
      401: openApiErrorResponse("Unauthorized"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const user = c.var.user;
    const groups = await c.var.groupService.listUserGroups(user.id);
    return c.json(groups, 200);
  },
);

groupApp.openapi(
  {
    method: "post",
    path: "/groups/create",
    tags: ["groups"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: NewGroupSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Created group",
      },
      400: openApiErrorResponse("Invalid request"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const body = c.req.valid("json");

    const created = await c.var.groupService.create(body);
    if (!created) {
      throw new ApiException(500, "Internal Server Error");
    }

    return c.json(created, 201);
  },
);

groupApp.openapi(
  {
    method: "post",
    path: "/groups/link",
    tags: ["groups"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: AddUserWithCodeSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "User added to group successfully",
      },
      400: openApiErrorResponse("Invalid request"),
      404: openApiErrorResponse("Group or User not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const body = c.req.valid("json");
    const linked = await c.var.groupService.addUserToGroupWithCode(body);
    if (!linked) {
      throw new ApiException(500, "Internal Server Error");
    }

    return c.json(linked, 200);
  },
);

groupApp.openapi(
  {
    method: "get",
    path: "/groups/{groupId}/invite",
    tags: ["groups"],
    request: {
      params: z.object({ groupId: z.uuid() }),
    },
    responses: {
      200: {
        description: "Invitation code created successfully",
      },
      400: openApiErrorResponse("Invalid request"),
      404: openApiErrorResponse("Group not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const { groupId } = c.req.valid("param");
    const invitationCode = await c.var.groupService.createInvitation(groupId);
    if (!invitationCode) {
      throw new ApiException(500, "Internal Server Error");
    }

    return c.json(invitationCode, 200);
  },
);

groupApp.openapi(
  {
    method: "get",
    path: "/groups/{groupId}/members",
    tags: ["groups"],
    request: {
      params: z.object({ groupId: z.uuid() }),
    },
    responses: {
      200: {
        description: "Group info with owner and members",
        content: {
          "application/json": {
            schema: z.object({
              name: z.string(),
              owner: z.object({
                id: z.string().uuid(),
                displayName: z.string(),
                avatarUrl: z.string().nullable(),
                elder: z.boolean(),
                activeFrameUrl: z.string().nullable(),
                interests: z.array(
                  z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    category: z.string().nullable(),
                    description: z.string().nullable(),
                  }),
                ),
              }),
              members: z.array(
                z.object({
                  id: z.string().uuid(),
                  displayName: z.string(),
                  avatarUrl: z.string().nullable(),
                  elder: z.boolean(),
                  activeFrameUrl: z.string().nullable(),
                  interests: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                      category: z.string().nullable(),
                      description: z.string().nullable(),
                    }),
                  ),
                }),
              ),
            }),
          },
        },
      },
      400: openApiErrorResponse("Invalid request"),
      404: openApiErrorResponse("Group not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const { groupId } = c.req.valid("param");
    const members = await c.var.groupService.getMembers(groupId);
    return c.json(members, 200);
  },
);

// Apply auth middleware to the remove user endpoint
groupApp.use("/groups/:groupId/member/:idUser", withAuth);

groupApp.openapi(
  {
    method: "delete",
    path: "/groups/{groupId}/member/{idUser}",
    tags: ["groups"],
    operationId: "removeUserFromGroup",
    request: {
      params: z.object({
        groupId: z.uuid(),
        idUser: z.uuid(),
      }),
      query: z.object({
        createNewGroup: z.string().optional().default("true"),
      }),
    },
    responses: {
      200: {
        description:
          "Member removed from group; ensures at least one group is maintained (new personal group created)",
      },
      400: openApiErrorResponse("Invalid request"),
      401: openApiErrorResponse("Unauthorized"),
      403: openApiErrorResponse(
        "You can only remove yourself from the group or be removed by the group owner",
      ),
      404: openApiErrorResponse("Group or User not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const { groupId, idUser } = c.req.valid("param");
    const { createNewGroup } = c.req.valid("query");
    const adminUser = c.var.user;

    const result = await c.var.groupService.removeUserFromGroup(
      groupId,
      idUser,
      adminUser.id,
      createNewGroup === "true",
    );

    if (!result) {
      throw new ApiException(500, "Internal Server Error");
    }

    return c.json(result, 200);
  },
);

// Endpoint para actualizar el nombre del grupo
groupApp.openapi(
  {
    method: "patch",
    path: "/groups/{groupId}",
    tags: ["groups"],
    request: {
      params: z.object({ groupId: z.uuid() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateGroupSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Group name updated successfully",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().uuid(),
              name: z.string(),
              ownerUserId: z.string().uuid(),
            }),
          },
        },
      },
      400: openApiErrorResponse("Invalid request"),
      404: openApiErrorResponse("Group not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { name } = c.req.valid("json");

    const updatedGroup = await c.var.groupService.updateGroupName(
      groupId,
      name,
    );

    return c.json(updatedGroup, 200);
  },
);

// Apply auth middleware to the transfer ownership endpoint
groupApp.use("/groups/:groupId/transfer-ownership", withAuth);

// Endpoint para transferir ownership del grupo
groupApp.openapi(
  {
    method: "put",
    path: "/groups/{groupId}/transfer-ownership",
    tags: ["groups"],
    operationId: "transferGroupOwnership",
    request: {
      params: z.object({ groupId: z.uuid() }),
      body: {
        content: {
          "application/json": {
            schema: TransferOwnershipSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Ownership transferred successfully",
        content: {
          "application/json": {
            schema: z.object({
              group: z.object({
                id: z.string().uuid(),
                name: z.string(),
                ownerUserId: z.string().uuid(),
                createdAt: z.string(),
              }),
              previousOwner: z.object({
                id: z.string().uuid(),
              }),
              newOwner: z.object({
                id: z.string().uuid(),
                displayName: z.string(),
              }),
            }),
          },
        },
      },
      400: openApiErrorResponse(
        "Invalid request - same owner or new owner not a member",
      ),
      401: openApiErrorResponse("Unauthorized"),
      403: openApiErrorResponse(
        "Only the current group owner can transfer ownership",
      ),
      404: openApiErrorResponse("Group or new owner not found"),
      500: openApiErrorResponse("Internal Server Error"),
    },
  },
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { newOwnerId } = c.req.valid("json");
    const currentUser = c.var.user;

    const result = await c.var.groupService.transferOwnership(
      groupId,
      currentUser.id,
      newOwnerId,
    );

    return c.json(result, 200);
  },
);
