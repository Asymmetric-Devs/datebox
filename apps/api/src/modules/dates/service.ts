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
          .from("users")
          .select("id")
          .eq("groupId", payload.groupId)
          .neq("id", payload.createdBy);

        if (members && members.length > 0) {
          const { data: creator } = await this.supabase
            .from("users")
            .select("displayName")
            .eq("id", payload.createdBy)
            .single();

          if (creator) {
            const memberPromises = members.map((member) => 
              this.notificationsService.createNotification({
                userId: member.id,
                actorId: payload.createdBy,
                eventType: "activity_assigned", // keeping event type string for compatibility
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
