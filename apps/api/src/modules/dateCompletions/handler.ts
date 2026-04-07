import { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { DateCompletionService } from "./service";
import { withAuth } from "../../middleware/auth";
import {
  NewDateCompletionSchema,
  GetDateCompletionsQuerySchema,
  DateCompletionSchema,
} from "./schema";
import { ApiError } from "../../utils/api-error";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase-types";

export const dateCompletionsHandler = new OpenAPIHono<{
  Variables: {
    user: User;
    supabase: SupabaseClient<Database>;
  };
}>();

// Aplicar autenticación a todas las rutas
dateCompletionsHandler.use("/*", withAuth);

// Esquema de respuestas comunes
const ErrorSchema = z.object({
  error: z.string(),
});

// Ruta GET /activity-completions
const getCompletionsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["DateCompletions"],
  summary: "Obtener completaciones del usuario",
  request: {
    query: GetDateCompletionsQuerySchema,
  },
  responses: {
    200: {
      description: "Lista de completaciones",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(DateCompletionSchema),
          }),
        },
      },
    },
    500: {
      description: "Error del servidor",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

dateCompletionsHandler.openapi(getCompletionsRoute, async (c) => {
  try {
    const user = c.get("user");
    const supabase = c.get("supabase");
    const query = c.req.valid("query");

    const service = new DateCompletionService(supabase);
    const completions = await service.getCompletions(user.id, query);

    return c.json({ data: completions }, 200);
  } catch (error) {
    console.error("Error fetching completions:", error);
    throw new ApiError("Error al obtener completaciones", 500);
  }
});

// Ruta POST /activity-completions/toggle
const toggleCompletionRoute = createRoute({
  method: "post",
  path: "/toggle",
  tags: ["DateCompletions"],
  summary: "Toggle completación de actividad para un día",
  request: {
    body: {
      content: {
        "application/json": {
          schema: NewDateCompletionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Resultado del toggle",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              completed: z.boolean(),
              completion: DateCompletionSchema.nullable(),
            }),
          }),
        },
      },
    },
    500: {
      description: "Error del servidor",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

dateCompletionsHandler.openapi(toggleCompletionRoute, async (c) => {
  try {
    const user = c.get("user");
    const supabase = c.get("supabase");
    const data = c.req.valid("json");

    const service = new DateCompletionService(supabase);
    const result = await service.toggleCompletion(user.id, data);

    return c.json({ data: result }, 200);
  } catch (error) {
    console.error("Error toggling completion:", error);
    throw new ApiError("Error al cambiar completación", 500);
  }
});
