import { ApiException } from "@/utils/api-error";
import type { UpdateUser } from "./schema";
import { uploadUserAvatarImage as uploadUserAvatar } from "@/services/storage";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/supabase-types";

export class UserService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getUserById(id: string) {
    const { data, error } = await this.supabase
      .from("users")
      .select(`
        id, email, displayName, avatarUrl, elder, timezone,
        user_interests (
          tags (id, name, category, description)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new ApiException(500, "Error finding the user");
    }
    
    if (!data) {
      throw new ApiException(404, "User not found");
    }

    // Map nested junction table data to flat interests array
    const interests = (data.user_interests || [])
      .map((ui: any) => ui.tags)
      .filter(Boolean);

    return {
      ...data,
      interests,
    };
  }

  async saveInterests(userId: string, tagIds: string[]) {
    // 1. Delete existing interests
    const { error: deleteError } = await this.supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting interests: ", deleteError);
      throw new ApiException(500, "Error updating interests");
    }

    // 2. Insert new interests
    if (tagIds.length > 0) {
      const inserts = tagIds.map(tagId => ({
        user_id: userId,
        tag_id: tagId
      }));

      const { error: insertError } = await this.supabase
        .from("user_interests")
        .insert(inserts);

      if (insertError) {
        console.error("Error inserting interests: ", insertError);
        throw new ApiException(500, "Error saving interests");
      }
    }

    return this.getUserById(userId);
  }

  async update(id: string, payload: UpdateUser) {
    const updates: any = {};
    if (payload.displayName !== undefined) updates.displayName = payload.displayName;
    if (payload.avatarUrl !== undefined) updates.avatarUrl = payload.avatarUrl;
    if (payload.timezone !== undefined) updates.timezone = payload.timezone;

    const { data, error } = await this.supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select("id, email, displayName, avatarUrl, elder, timezone")
      .maybeSingle();

    if (error) {
      console.error("Error updating the user: ", error);
      throw new ApiException(500, "Error updating the user");
    }

    return data ? this.getUserById(id) : undefined;
  }

  async updateUserAvatar(id: string, form: FormData) {
    const avatarFile = form.get("avatarFile");
    if (!(avatarFile instanceof File)) {
      throw new ApiException(400, "Invalid or missing avatar file");
    }

    const avatarUrl = await uploadUserAvatar(this.supabase, id, avatarFile);
    return this.update(id, { avatarUrl });
  }
}
