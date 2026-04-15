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
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      throw new ApiException(500, "Error al obtener la cita", error);
    }
    if (!data) {
      throw new ApiException(404, "Cita no encontrada");
    }
    return data;
  }

  async getDatesWithGroupId(groupId: string) {
    const { data: dates, error: datesError } = await this.supabase
      .from("dates")
      .select("*")
      .eq("groupId", groupId);

    if (datesError) {
      throw new ApiException(
        500,
        "Error al obtener las citas",
        datesError,
      );
    }

    return dates || [];
  }

  async getDatesWithTags(options: {
    page: number;
    pageSize: number;
    category?: string;
  }) {
    const { page, pageSize, category } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (category) {
      // When filtering by category, we need to find date IDs that have at least
      // one tag in the given category, then fetch those dates with ALL their tags.

      // Step 1: Get distinct date IDs matching the category filter
      const { data: matchingDateTags, error: filterError } = await this.supabase
        .from("date_tags")
        .select("date_id, tags!inner(category)")
        .eq("tags.category", category);

      if (filterError) {
        throw new ApiException(500, "Error al filtrar citas por categoría", filterError);
      }

      const matchingDateIds = [...new Set((matchingDateTags || []).map(dt => dt.date_id))];
      const total = matchingDateIds.length;
      const totalPages = Math.ceil(total / pageSize);

      if (matchingDateIds.length === 0) {
        return { data: [], page, pageSize, total: 0, totalPages: 0 };
      }

      // Step 2: Paginate over those date IDs
      const paginatedIds = matchingDateIds.slice(from, to + 1);

      const { data: dates, error: datesError } = await this.supabase
        .from("dates")
        .select("*")
        .in("id", paginatedIds)
        .order("startsAt", { ascending: false });

      if (datesError) {
        throw new ApiException(500, "Error al obtener las citas", datesError);
      }

      // Step 3: Fetch ALL tags for the paginated dates
      const dateIds = (dates || []).map(d => d.id);
      const tagsMap = await this.getTagsForDates(dateIds);

      const datesWithTags = (dates || []).map(date => ({
        ...date,
        tags: tagsMap[date.id] || [],
      }));

      return { data: datesWithTags, page, pageSize, total, totalPages };
    }

    // No category filter — simple paginated query
    // Step 1: Get total count
    const { count, error: countError } = await this.supabase
      .from("dates")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw new ApiException(500, "Error al contar las citas", countError);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Step 2: Fetch paginated dates
    const { data: dates, error: datesError } = await this.supabase
      .from("dates")
      .select("*")
      .order("startsAt", { ascending: false })
      .range(from, to);

    if (datesError) {
      throw new ApiException(500, "Error al obtener las citas", datesError);
    }

    // Step 3: Fetch tags for the paginated dates
    const dateIds = (dates || []).map(d => d.id);
    const tagsMap = await this.getTagsForDates(dateIds);

    const datesWithTags = (dates || []).map(date => ({
      ...date,
      tags: tagsMap[date.id] || [],
    }));

    return { data: datesWithTags, page, pageSize, total, totalPages };
  }

  /**
   * Batch-fetch tags for a list of date IDs via the date_tags junction table.
   */
  private async getTagsForDates(dateIds: string[]): Promise<Record<string, Array<{ id: string; name: string; category: string | null; description: string | null }>>> {
    const tagsMap: Record<string, Array<{ id: string; name: string; category: string | null; description: string | null }>> = {};

    if (dateIds.length === 0) return tagsMap;

    const { data: dateTags } = await this.supabase
      .from("date_tags")
      .select("date_id, tags (id, name, category, description)")
      .in("date_id", dateIds);

    if (dateTags) {
      dateTags.forEach((dt) => {
        const tag = dt.tags as unknown as { id: string; name: string; category: string | null; description: string | null } | null;
        if (tag) {
          if (!tagsMap[dt.date_id]) {
            tagsMap[dt.date_id] = [];
          }
          tagsMap[dt.date_id]!.push(tag);
        }
      });
    }

    return tagsMap;
  }


  async create(payload: NewDateEvent) {
    const { data, error } = await this.supabase
      .from("dates")
      .insert(payload)
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
          title: data.title,
          description: data.description || undefined,
          startsAt: new Date(data.startsAt),
          endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        });

        console.log("Google Calendar event created for date:", data.id);
      }
    } catch (googleError) {
      console.error("Google Calendar sync failed:", googleError);
    }

    return data;
  }

  async update(id: string, payload: UpdateDateEvent) {
    const { data, error } = await this.supabase
      .from("dates")
      .update({ ...payload })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new ApiException(500, "Error al actualizar la cita", error);
    }
    if (!data) {
      throw new ApiException(404, "Cita no encontrada");
    }

    // Sync mentions from title and description
    try {
      await this.mentionsService.syncMentions(
        "date",
        data.id,
        data.title,
        data.description
      );

      // Extract mentioned user IDs and create notifications
      const mentionedIds = [
        ...this.mentionsService.extractMentionIds(data.title),
        ...this.mentionsService.extractMentionIds(data.description),
      ];

      if (mentionedIds.length > 0) {
        const { data: actor, error: actorError } = await this.supabase
          .from("users")
          .select("displayName")
          .eq("id", data.createdBy)
          .single();

        if (!actorError && actor) {
          await this.notificationsService.notifyMentionedUsers(
            mentionedIds,
            data.createdBy,
            actor.displayName || "Un usuario",
            "date",
            data.id,
            data.title || "Sin título"
          );
        }
      }
    } catch (mentionError) {
      console.error("Error syncing mentions or creating notifications:", mentionError);
    }

    try {
      const isEnabled =
        await this.googleCalendarService.isGoogleCalendarEnabled(
          data.createdBy,
        );
      if (isEnabled) {
        console.log("Would sync Google Calendar update for date:", id);
      }
    } catch (googleError) {
      console.error("Google Calendar sync failed:", googleError);
    }

    return data;
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
