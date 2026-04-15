import { ApiException } from "@/utils/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/supabase-types";
import type { NewDateEvent, UpdateDateEvent } from "./schema";
import { GoogleCalendarService } from "@/services/google-calendar";
import { MentionsService } from "@/services/mentions";
import { NotificationsService } from "@/modules/notifications/service";

export class DateService {
  private googleCalendarService: GoogleCalendarService;
  private mentionsService: MentionsService;
  private notificationsService: NotificationsService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.googleCalendarService = new GoogleCalendarService(supabase);
    this.mentionsService = new MentionsService(supabase);
    this.notificationsService = new NotificationsService(supabase);
  }

  async getDateById(id: string) {
    const { data, error } = await this.supabase
      .from("dates")
      .select("*, events(*)")
      .eq("id", id)
      .single();
    if (error) {
      throw new ApiException(500, "Error al obtener la cita", error);
    }
    if (!data) {
      throw new ApiException(404, "Cita no encontrada");
    }
    
    // Flatten result to maintain compatibility
    const dateWithEvent = data as unknown as { events: Database["public"]["Tables"]["events"]["Row"] } & Database["public"]["Tables"]["dates"]["Row"];
    const { events, ...dateData } = dateWithEvent;
    return { ...dateData, ...events };
  }

  async getDatesWithGroupId(groupId: string) {
    const { data, error: datesError } = await this.supabase
      .from("dates")
      .select("*, events(*)")
      .eq("groupId", groupId);

    if (datesError) {
      throw new ApiException(
        500,
        "Error al obtener las citas",
        datesError,
      );
    }

    // Flatten results to maintain compatibility
    return (data || []).map((d) => {
      const dateWithEvent = d as unknown as { events: Database["public"]["Tables"]["events"]["Row"] } & Database["public"]["Tables"]["dates"]["Row"];
      const { events, ...dateData } = dateWithEvent;
      return { ...dateData, ...events };
    });
  }

  async getEventsWithTags(options: {
    page: number;
    pageSize: number;
    category?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, pageSize, category, startDate, endDate } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (category) {
      // Filter: find event IDs that have at least one tag in the given category
      const { data: matchingEventTags, error: filterError } = await this.supabase
        .from("event_tags")
        .select("event_id, tags!inner(category)")
        .eq("tags.category", category);

      if (filterError) {
        throw new ApiException(500, "Error al filtrar eventos por categoría", filterError);
      }

      let matchingEventIds = [...new Set((matchingEventTags || []).map(et => et.event_id))];

      // If we also have date filters, narrow down by startsAt
      if (matchingEventIds.length > 0 && (startDate || endDate)) {
        let dateQuery = this.supabase
          .from("events")
          .select("id")
          .in("id", matchingEventIds);

        if (startDate) dateQuery = dateQuery.gte("startsAt", startDate);
        if (endDate) dateQuery = dateQuery.lte("startsAt", endDate);

        const { data: filteredEvents } = await dateQuery;
        matchingEventIds = (filteredEvents || []).map(e => e.id);
      }

      const total = matchingEventIds.length;
      const totalPages = Math.ceil(total / pageSize);

      if (matchingEventIds.length === 0) {
        return { data: [], page, pageSize, total: 0, totalPages: 0 };
      }

      // Paginate over those event IDs
      const paginatedIds = matchingEventIds.slice(from, to + 1);

      const { data: events, error: eventsError } = await this.supabase
        .from("events")
        .select("*")
        .in("id", paginatedIds)
        .order("startsAt", { ascending: false });

      if (eventsError) {
        throw new ApiException(500, "Error al obtener los eventos", eventsError);
      }

      const eventIds = (events || []).map(e => e.id);
      const tagsMap = await this.getTagsForEvents(eventIds);

      const eventsWithTags = (events || []).map(event => ({
        ...event,
        tags: tagsMap[event.id] || [],
      }));

      return { data: eventsWithTags, page, pageSize, total, totalPages };
    }

    // No category filter — query events directly with optional date filter
    let countQuery = this.supabase
      .from("events")
      .select("*", { count: "exact", head: true });

    if (startDate) countQuery = countQuery.gte("startsAt", startDate);
    if (endDate) countQuery = countQuery.lte("startsAt", endDate);

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new ApiException(500, "Error al contar los eventos", countError);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    let eventsQuery = this.supabase
      .from("events")
      .select("*")
      .order("startsAt", { ascending: false })
      .range(from, to);

    if (startDate) eventsQuery = eventsQuery.gte("startsAt", startDate);
    if (endDate) eventsQuery = eventsQuery.lte("startsAt", endDate);

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      throw new ApiException(500, "Error al obtener los eventos", eventsError);
    }

    const eventIds = (events || []).map(e => e.id);
    const tagsMap = await this.getTagsForEvents(eventIds);

    const eventsWithTags = (events || []).map(event => ({
      ...event,
      tags: tagsMap[event.id] || [],
    }));

    return { data: eventsWithTags, page, pageSize, total, totalPages };
  }

  /**
   * Batch-fetch tags for a list of event IDs via the event_tags junction table.
   */
  private async getTagsForEvents(eventIds: string[]): Promise<Record<string, Array<{ id: string; name: string; category: string | null; description: string | null }>>> {
    const tagsMap: Record<string, Array<{ id: string; name: string; category: string | null; description: string | null }>> = {};

    if (eventIds.length === 0) return tagsMap;

    const { data: eventTags } = await this.supabase
      .from("event_tags")
      .select("event_id, tags (id, name, category, description)")
      .in("event_id", eventIds);

    if (eventTags) {
      eventTags.forEach((et) => {
        const tag = et.tags as unknown as { id: string; name: string; category: string | null; description: string | null } | null;
        if (tag) {
          if (!tagsMap[et.event_id]) {
            tagsMap[et.event_id] = [];
          }
          tagsMap[et.event_id]!.push(tag);
        }
      });
    }

    return tagsMap;
  }


  async create(payload: NewDateEvent) {
    // 1. Create the event definition
    const { data: event, error: eventError } = await this.supabase
      .from("events")
      .insert({
        title: payload.title,
        description: payload.description,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        createdBy: payload.createdBy,
      })
      .select("*")
      .single();

    if (eventError) {
      console.error(eventError);
      throw new ApiException(500, "Error al crear el evento", eventError);
    }

    // 2. Create the date junction
    const { data, error } = await this.supabase
      .from("dates")
      .insert({
        eventId: event.id,
        groupId: payload.groupId,
        createdBy: payload.createdBy,
        completed: payload.completed ?? false,
        frequencyId: payload.frequencyId,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      throw new ApiException(500, "Error al crear la cita", error);
    }

    // Sync mentions from title and description
    try {
      await this.mentionsService.syncMentions(
        "date",
        data.id,
        payload.title,
        payload.description
      );

      // Extract mentioned user IDs and create notifications
      const mentionedIds = [
        ...this.mentionsService.extractMentionIds(payload.title),
        ...this.mentionsService.extractMentionIds(payload.description),
      ];

      if (mentionedIds.length > 0) {
        // Get the actor's name
        const { data: actor, error: actorError } = await this.supabase
          .from("users")
          .select("displayName")
          .eq("id", payload.createdBy)
          .single();

        if (!actorError && actor) {
          await this.notificationsService.notifyMentionedUsers(
            mentionedIds,
            payload.createdBy,
            actor.displayName || "Un usuario",
            "date",
            data.id,
            payload.title || "Sin título"
          );
        }
      }

      // Send notification to group members if different from creator
      if (payload.groupId) {
        const { data: members } = await this.supabase
          .from("group_members")
          .select("userId")
          .eq("groupId", payload.groupId)
          .neq("userId", payload.createdBy);

        if (members && members.length > 0) {
          const { data: creator } = await this.supabase
            .from("users")
            .select("displayName")
            .eq("id", payload.createdBy)
            .single();

          if (creator) {
            const memberPromises = members.map((member) => 
              this.notificationsService.createNotification({
                userId: member.userId!,
                actorId: payload.createdBy,
                eventType: "activity_assigned",
                entityType: "date",
                entityId: data.id,
                title: "Nueva cita agregada al grupo",
                body: `${creator.displayName} agregó una nueva cita: ${payload.title}`,
              })
            );
            await Promise.allSettled(memberPromises);
          }
        }
      }
    } catch (mentionError) {
      console.error("Error syncing mentions or creating notifications:", mentionError);
    }

    // Sync with Google Calendar if enabled
    try {
      const isEnabled =
        await this.googleCalendarService.isGoogleCalendarEnabled(
          payload.createdBy,
        );
      if (isEnabled) {
        await this.googleCalendarService.createEvent(payload.createdBy, {
          id: data.id,
          title: event.title,
          description: event.description || undefined,
          startsAt: new Date(event.startsAt),
          endsAt: event.endsAt ? new Date(event.endsAt) : undefined,
        });

        console.log("Google Calendar event created for date:", data.id);
      }
    } catch (googleError) {
      console.error("Google Calendar sync failed:", googleError);
    }

    return { ...data, ...event };
  }

  async update(id: string, payload: UpdateDateEvent) {
    // 1. Find the date to get the eventId
    const { data: dateRec, error: fetchError } = await this.supabase
      .from("dates")
      .select("eventId, createdBy")
      .eq("id", id)
      .single();

    if (fetchError || !dateRec) {
      throw new ApiException(404, "Cita no encontrada");
    }

    // 2. Update the event if any event-related fields are present
    let updatedEvent: Database["public"]["Tables"]["events"]["Row"];
    const eventPayload: Database["public"]["Tables"]["events"]["Update"] = {};
    if (payload.title !== undefined) eventPayload.title = payload.title;
    if (payload.description !== undefined) eventPayload.description = payload.description;
    if (payload.startsAt !== undefined) eventPayload.startsAt = payload.startsAt;
    if (payload.endsAt !== undefined) eventPayload.endsAt = payload.endsAt;

    if (Object.keys(eventPayload).length > 0) {
      const { data: ev, error: evErr } = await this.supabase
        .from("events")
        .update(eventPayload)
        .eq("id", dateRec.eventId)
        .select("*")
        .single();
      if (evErr) throw new ApiException(500, "Error al actualizar el evento", evErr);
      updatedEvent = ev;
    } else {
      // Fetch current event to return full object
      const { data: ev, error: fetchEvErr } = await this.supabase.from("events").select("*").eq("id", dateRec.eventId).single();
      if (fetchEvErr || !ev) throw new ApiException(404, "Evento no encontrado");
      updatedEvent = ev;
    }

    // 3. Update the date
    const datePayload: Database["public"]["Tables"]["dates"]["Update"] = {};
    if (payload.completed !== undefined) datePayload.completed = payload.completed;
    if (payload.groupId !== undefined) datePayload.groupId = payload.groupId;
    if (payload.frequencyId !== undefined) datePayload.frequencyId = payload.frequencyId;

    const { data: updatedDate, error: updateDateErr } = await this.supabase
      .from("dates")
      .update(datePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateDateErr) {
      throw new ApiException(500, "Error al actualizar la cita", updateDateErr);
    }
    if (!updatedDate) {
      throw new ApiException(404, "Cita no encontrada");
    }

    // Sync mentions from title and description
    try {
      await this.mentionsService.syncMentions(
        "date",
        updatedDate.id,
        updatedEvent.title,
        updatedEvent.description
      );

      // Extract mentioned user IDs and create notifications
      const mentionedIds = [
        ...this.mentionsService.extractMentionIds(updatedEvent.title),
        ...this.mentionsService.extractMentionIds(updatedEvent.description),
      ];

      if (mentionedIds.length > 0) {
        const { data: actor, error: actorError } = await this.supabase
          .from("users")
          .select("displayName")
          .eq("id", dateRec.createdBy)
          .single();

        if (!actorError && actor) {
          await this.notificationsService.notifyMentionedUsers(
            mentionedIds,
            dateRec.createdBy,
            actor.displayName || "Un usuario",
            "date",
            updatedDate.id,
            updatedEvent.title || "Sin título"
          );
        }
      }
    } catch (mentionError) {
      console.error("Error syncing mentions or creating notifications:", mentionError);
    }

    try {
      const isEnabled =
        await this.googleCalendarService.isGoogleCalendarEnabled(
          dateRec.createdBy,
        );
      if (isEnabled) {
        console.log("Would sync Google Calendar update for date:", id);
      }
    } catch (googleError) {
      console.error("Google Calendar sync failed:", googleError);
    }

    return { ...updatedDate, ...updatedEvent };
  }

  async remove(id: string) {
    const { data: element } = await this.supabase
      .from("dates")
      .select("createdBy")
      .eq("id", id)
      .single();

    try {
      await this.mentionsService.deleteMentionsForEntity("date", id);
    } catch (mentionError) {
      console.error("Error deleting mentions:", mentionError);
    }

    const { error } = await this.supabase
      .from("dates")
      .delete()
      .eq("id", id);
    if (error) {
      throw new ApiException(500, "Error al eliminar la cita", error);
    }

    if (element) {
      try {
        const isEnabled =
          await this.googleCalendarService.isGoogleCalendarEnabled(
            element.createdBy,
          );
        if (isEnabled) {
          console.log("Would delete from Google Calendar for date:", id);
        }
      } catch (googleError) {
        console.error("Google Calendar sync failed:", googleError);
      }
    }

    return true;
  }
}
