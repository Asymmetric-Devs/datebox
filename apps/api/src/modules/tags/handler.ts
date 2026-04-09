import { OpenAPIHono } from "@hono/zod-openapi";
import { TagSchema } from "./schema.js";
import { TagService } from "./service.js";

export const tagsApp = new OpenAPIHono();

tagsApp.openapi(
  {
    method: "get",
    path: "/tags",
    tags: ["tags"],
    responses: {
      200: {
        description: "List of available tags/interests",
        content: {
          "application/json": {
            schema: TagSchema.array(),
          },
        },
      },
      500: { description: "Internal Server Error" },
    },
  },
  async (c) => {
    const tagService = new TagService(c.var.supabase);
    const tags = await tagService.getAllTags();
    return c.json(tags, 200);
  },
);
