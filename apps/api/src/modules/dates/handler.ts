import { OpenAPIHono, z } from "@hono/zod-openapi";
import { DateService } from "./service";
import {
  DateEventSchema,
  NewDateEventSchema,
  UpdateDateEventSchema,
  PaginatedEventsSchema,
} from "./schema";
import { openApiErrorResponse } from "@/utils/api-error";
import { GoogleCalendarService } from "@/services/google-calendar";

export const datesApp = new OpenAPIHono();

declare module "hono" {
  interface ContextVariableMap {
    dateService: DateService;
    googleCalendarService: GoogleCalendarService;
  }
}

datesApp.use("/dates/*", async (c, next) => {
  const dateService = new DateService(c.var.supabase);
  const googleCalendarService = new GoogleCalendarService(c.var.supabase);
  c.set("dateService", dateService);
  c.set("googleCalendarService", googleCalendarService);
  await next();
});

datesApp.use("/events", async (c, next) => {
  const dateService = new DateService(c.var.supabase);
  const googleCalendarService = new GoogleCalendarService(c.var.supabase);
  c.set("dateService", dateService);
  c.set("googleCalendarService", googleCalendarService);
  await next();
});

// GET /events — Paginated events with tags, optional category and date filters
datesApp.openapi(
  {
    method: "get",
    path: "/events",
    tags: ["events"],
    request: {
      query: z.object({
        page: z.string().optional().default("1"),
        pageSize: z.string().optional().default("20"),
        category: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Paginated events with their tags",
        content: {
          "application/json": {
            schema: PaginatedEventsSchema,
          },
        },
      },
      400: openApiErrorResponse("Invalid query parameters"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const { page: pageStr, pageSize: pageSizeStr, category, startDate, endDate } = c.req.valid("query");
    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20));

    const result = await c.var.dateService.getEventsWithTags({
      page,
      pageSize,
      category: category || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return c.json(result, 200);
  },
);

datesApp.openapi(
  {
    method: "get",
    path: "/dates/{id}",
    tags: ["dates"],
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: {
        description: "Cita",
        content: { "application/json": { schema: DateEventSchema } },
      },
      404: openApiErrorResponse("Cita no encontrada"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const event = await c.var.dateService.getDateById(id);
    return c.json(event, 200);
  },
);

datesApp.openapi(
  {
    method: "get",
    path: "/dates/group/{groupId}",
    tags: ["dates"],
    request: { params: z.object({ groupId: z.uuid() }) },
    responses: {
      200: {
        description: "Citas",
        content: { "application/json": { schema: z.array(DateEventSchema) } },
      },
      404: openApiErrorResponse("Citas no encontradas"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const { groupId } = c.req.valid("param");
    const events = await c.var.dateService.getDatesWithGroupId(groupId);
    return c.json(events, 200);
  },
);

datesApp.openapi(
  {
    method: "post",
    path: "/dates",
    tags: ["dates"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: NewDateEventSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        description: "Cita creada",
        content: { "application/json": { schema: DateEventSchema } },
      },
      400: openApiErrorResponse("Datos inválidos"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const body = c.req.valid("json");
    const event = await c.var.dateService.create(body);
    return c.json(event, 201);
  },
);

datesApp.openapi(
  {
    method: "patch",
    path: "/dates/{id}",
    tags: ["dates"],
    request: {
      params: z.object({ id: z.uuid() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateDateEventSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Cita actualizada",
        content: { "application/json": { schema: DateEventSchema } },
      },
      400: openApiErrorResponse("Datos inválidos"),
      404: openApiErrorResponse("Cita no encontrada"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const event = await c.var.dateService.update(id, body);
    return c.json(event, 200);
  },
);

datesApp.openapi(
  {
    method: "delete",
    path: "/dates/{id}",
    tags: ["dates"],
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      204: {
        description: "Cita eliminada",
      },
      404: openApiErrorResponse("Cita no encontrada"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const { id } = c.req.valid("param");
    const event = await c.var.dateService.remove(id);
    return c.json(event, 200);
  },
);

// Google Calendar endpoints
datesApp.openapi(
  {
    method: "post",
    path: "/dates/google-calendar/enable",
    tags: ["dates"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ calendarId: z.string().optional() }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Google Calendar enabled",
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
      },
      400: openApiErrorResponse("Error al habilitar Google Calendar"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const userId = c.var.user.id;
    const body = c.req.valid("json");

    try {
      await c.var.googleCalendarService.enableGoogleCalendar(
        userId,
        body.calendarId,
      );
      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("Error enabling Google Calendar:", error);
      return c.json(
        { error: { message: "Failed to enable Google Calendar" } },
        400,
      );
    }
  },
);

datesApp.openapi(
  {
    method: "post",
    path: "/dates/google-calendar/disable",
    tags: ["dates"],
    responses: {
      200: {
        description: "Google Calendar disabled",
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
      },
      400: openApiErrorResponse("Error al deshabilitar Google Calendar"),
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const userId = c.var.user.id;

    try {
      await c.var.googleCalendarService.disableGoogleCalendar(userId);
      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("Error disabling Google Calendar:", error);
      return c.json(
        { error: { message: "Failed to disable Google Calendar" } },
        400,
      );
    }
  },
);

datesApp.openapi(
  {
    method: "get",
    path: "/dates/google-calendar/status",
    tags: ["dates"],
    responses: {
      200: {
        description: "Google Calendar status",
        content: {
          "application/json": {
            schema: z.object({
              enabled: z.boolean(),
              calendarId: z.string().optional(),
            }),
          },
        },
      },
      500: openApiErrorResponse("Error interno del servidor"),
    },
  },
  async (c) => {
    const userId = c.var.user.id;

    try {
      const enabled =
        await c.var.googleCalendarService.isGoogleCalendarEnabled(userId);
      return c.json({ enabled, calendarId: undefined }, 200);
    } catch (error) {
      console.error("Error checking Google Calendar status:", error);
      return c.json({ enabled: false, calendarId: undefined }, 200);
    }
  },
);
