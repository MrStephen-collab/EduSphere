import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks that at least one row matches every given equality filter.
 *
 * Prefer this over `maybeSingle()` when probing the link tables
 * (`teacher_classes`, `teacher_subjects`, ...). Those tables carry no unique
 * constraint, so a duplicate row makes `maybeSingle()` error out and the
 * caller reads "no link" off a linked teacher. Counting rows answers the
 * question we actually have and ignores duplicates.
 */
export async function rowExists(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string>,
): Promise<boolean> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}
