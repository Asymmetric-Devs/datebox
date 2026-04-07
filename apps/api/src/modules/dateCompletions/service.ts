import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../supabase-types";
import type {
  DateCompletion,
  NewDateCompletion,
  GetDateCompletionsQuery,
} from "./schema";

export class DateCompletionService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Obtener todas las completaciones del usuario con filtros opcionales
   */
  async getCompletions(
    userId: string,
    query: GetDateCompletionsQuery,
  ): Promise<DateCompletion[]> {
    let queryBuilder = this.supabase
      .from("date_completions")
      .select("*")
      .eq("userId", userId);

    if (query.startDate) {
      queryBuilder = queryBuilder.gte("completedDate", query.startDate);
    }

    if (query.endDate) {
      queryBuilder = queryBuilder.lte("completedDate", query.endDate);
    }

    if (query.dateId) {
      queryBuilder = queryBuilder.eq("dateId", query.dateId);
    }

    const { data, error } = await queryBuilder.order("completedDate", {
      ascending: false,
    });

    if (error) throw error;

    return (data || []).map((item) => ({
      id: item.id,
      dateId: item.dateId,
      userId: item.userId,
      completedDate: item.completedDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  /**
   * Crear o toggle una completación para un día específico
   */
  async toggleCompletion(
    userId: string,
    data: NewDateCompletion,
  ): Promise<{ completed: boolean; completion: DateCompletion | null }> {
    // Primero verificar si ya existe
    const { data: existing, error: findError } = await this.supabase
      .from("date_completions")
      .select("*")
      .eq("dateId", data.dateId)
      .eq("userId", userId)
      .eq("completedDate", data.completedDate)
      .maybeSingle();

    if (findError) throw findError;

    // Si existe, eliminar (toggle off)
    if (existing) {
      const { error: deleteError } = await this.supabase
        .from("date_completions")
        .delete()
        .eq("id", existing.id);

      if (deleteError) throw deleteError;

      return { completed: false, completion: null };
    }

    // Si no existe, crear (toggle on)
    const { data: newCompletion, error: insertError } = await this.supabase
      .from("date_completions")
      .insert({
        dateId: data.dateId,
        userId: userId,
        completedDate: data.completedDate,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      completed: true,
      completion: {
        id: newCompletion.id,
        dateId: newCompletion.dateId,
        userId: newCompletion.userId,
        completedDate: newCompletion.completedDate,
        createdAt: newCompletion.createdAt,
        updatedAt: newCompletion.updatedAt,
      },
    };
  }

  /**
   * Verificar si una actividad está completada en una fecha específica
   */
  async isCompleted(
    userId: string,
    dateId: string,
    completedDate: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("date_completions")
      .select("id")
      .eq("dateId", dateId)
      .eq("userId", userId)
      .eq("completedDate", completedDate)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  }

  /**
   * Eliminar todas las completaciones de una actividad
   */
  async deleteByActivityId(dateId: string): Promise<void> {
    const { error } = await this.supabase
      .from("date_completions")
      .delete()
      .eq("dateId", dateId);

    if (error) throw error;
  }
}
