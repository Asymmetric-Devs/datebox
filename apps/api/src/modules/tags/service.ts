import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/supabase-types.js";
import { Tag } from "./schema.js";

export class TagService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getAllTags(): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
       console.error("Error fetching tags from Supabase:", error);
       throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    return data || [];
  }
}
