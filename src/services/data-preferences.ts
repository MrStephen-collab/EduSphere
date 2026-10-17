import { getAuthContext } from "@/lib/auth/auth-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSchoolAdmin } from "@/services/shared";
import {
  dataPreferencesSchema,
  defaultDataModeFor,
  type DataPreferencesInput,
  type DataPreferencesView,
} from "@/lib/data-preferences";

export type { DataPreferencesView };

/**
 * A learner's data preferences (spec section 50).
 *
 * Read and write go through the user's own RLS session — the table's policies
 * only ever open a row to its owner — with one exception: the school's
 * low-data flag, read from school_settings (selectable by any member), which
 * supplies the default for someone who has never chosen.
 */

export async function getDataPreferences(): Promise<DataPreferencesView> {
  const context = await getAuthContext();
  if (!context.user) {
    throw new Error("Sign in to manage your data preferences.");
  }

  const supabase = await createSupabaseServerClient();
  const [preferencesRes, rolesRes] = await Promise.all([
    supabase
      .from("user_data_preferences")
      .select("data_mode, video_quality")
      .eq("user_id", context.user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("school_id").eq("user_id", context.user.id).limit(50),
  ]);

  let schoolLowDataMode = false;
  const schoolIds = [...new Set((rolesRes.data ?? []).map((row) => row.school_id))];
  if (schoolIds.length > 0) {
    const settingsRes = await supabase
      .from("school_settings")
      .select("school_id, low_data_mode")
      .in("school_id", schoolIds);
    schoolLowDataMode = (settingsRes.data ?? []).some((row) => row.low_data_mode);
  }

  const saved = preferencesRes.data
    ? {
        dataMode: preferencesRes.data.data_mode,
        videoQuality: preferencesRes.data.video_quality,
      }
    : null;

  return {
    saved,
    schoolLowDataMode,
    defaultDataMode: defaultDataModeFor(schoolLowDataMode),
  };
}

export async function saveDataPreferences(input: DataPreferencesInput): Promise<void> {
  const parsed = dataPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("That combination of data settings isn't valid.");
  }

  const context = await getAuthContext();
  if (!context.user) {
    throw new Error("Sign in to manage your data preferences.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_data_preferences")
    .upsert(
      {
        user_id: context.user.id,
        data_mode: parsed.data.dataMode,
        video_quality: parsed.data.videoQuality,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    throw new Error(`We couldn't save your data preferences: ${error.message}`);
  }
}

/**
 * The school-wide default for learners who have never chosen themselves.
 * Guarded by RLS (school_settings_modify) and by requireSchoolAdmin here.
 */
export async function setSchoolLowDataMode(enabled: boolean): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("school_settings")
    .upsert({ school_id: schoolId, low_data_mode: enabled }, { onConflict: "school_id" });

  if (error) {
    throw new Error(`We couldn't update the school's data default: ${error.message}`);
  }
}
