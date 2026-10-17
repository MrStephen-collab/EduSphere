import { z } from "zod";
import type { DataMode, VideoQuality } from "@/types/database";

export type { DataMode, VideoQuality };

/**
 * Data preference vocabulary and policy (spec section 50).
 *
 * Everything here is pure: the same inputs must yield the same policy on the
 * server that renders the profile card and in the browser that plays the
 * video. The precedence rule is the important part and is unit-tested:
 *
 *   1. the learner's own saved choice   — made knowingly, wins over everything
 *   2. the device's "save data" request  — shapes the default only
 *   3. the school's low_data_mode flag   — shapes the default only
 *   4. otherwise Balanced
 */

export const DATA_MODES = ["saver", "balanced", "high"] as const;
export const VIDEO_QUALITIES = ["auto", "360p", "480p", "720p"] as const;

export const dataModeSchema = z.enum(DATA_MODES);
export const videoQualitySchema = z.enum(VIDEO_QUALITIES);

export const dataPreferencesSchema = z.object({
  dataMode: dataModeSchema,
  videoQuality: videoQualitySchema,
});

export type DataPreferencesInput = z.infer<typeof dataPreferencesSchema>;

/**
 * What the server knows about one user's preferences — typed here (not in the
 * service) so client components can take it as a prop without pulling in
 * `next/headers`, which any client import of a service would drag along.
 */
export type DataPreferencesView = {
  /** The learner's saved choice, or null when they have never chosen. */
  saved: { dataMode: DataMode; videoQuality: VideoQuality } | null;
  schoolLowDataMode: boolean;
  /** What applies until they choose: the school flag, else Balanced. */
  defaultDataMode: DataMode;
};

export const DATA_MODE_LABELS: Record<DataMode, string> = {
  saver: "Data Saver",
  balanced: "Balanced",
  high: "High Quality",
};

export const DATA_MODE_HINTS: Record<DataMode, string> = {
  saver: "Caps video at 360p. The lightest option on small data bundles.",
  balanced: "Caps video at 480p. A good middle ground on most networks.",
  high: "Caps video at 720p. Uses the most data.",
};

export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = {
  auto: "Auto (follows my mode)",
  "360p": "360p",
  "480p": "480p",
  "720p": "720p",
};

export const DEFAULT_DATA_MODE: DataMode = "balanced";

/** The mode an explicit `auto` quality resolves to, per mode. */
export const MODE_DEFAULT_QUALITY: Record<DataMode, "360p" | "480p" | "720p"> = {
  saver: "360p",
  balanced: "480p",
  high: "720p",
};

/** The default for someone who has never chosen: the school's flag, else balanced. */
export function defaultDataModeFor(schoolLowDataMode: boolean): DataMode {
  return schoolLowDataMode ? "saver" : DEFAULT_DATA_MODE;
}

/**
 * Which mode is actually in force.
 *
 * An explicit saved choice wins over the device's save-data request, not the
 * other way round: both were set deliberately, and the one made inside this
 * product is the more specific intent. With no saved choice, either signal
 * that asks for economy produces Data Saver.
 */
export function composeDataMode(input: {
  savedMode: DataMode | null;
  schoolLowDataMode: boolean;
  deviceSaveData: boolean;
}): DataMode {
  if (input.savedMode) return input.savedMode;
  if (input.deviceSaveData || input.schoolLowDataMode) return "saver";
  return DEFAULT_DATA_MODE;
}

function qualityPixels(quality: "360p" | "480p" | "720p"): number {
  return Number.parseInt(quality, 10);
}

/** Pixel ceiling for the player: `auto` follows the mode, an explicit choice wins. */
export function resolveVideoCeiling(mode: DataMode, quality: VideoQuality): number {
  return quality === "auto"
    ? qualityPixels(MODE_DEFAULT_QUALITY[mode])
    : qualityPixels(quality);
}

export type EffectiveDataPreferences = {
  mode: DataMode;
  videoQuality: VideoQuality;
  /** Pixel ceiling the player should hold to. */
  ceiling: number;
  /** Where the mode came from — for honest UI copy. */
  source: "yours" | "school" | "default";
};

export function resolveEffectivePreferences(input: {
  saved: { dataMode: DataMode; videoQuality: VideoQuality } | null;
  schoolLowDataMode: boolean;
  deviceSaveData: boolean;
}): EffectiveDataPreferences {
  const mode = composeDataMode({
    savedMode: input.saved?.dataMode ?? null,
    schoolLowDataMode: input.schoolLowDataMode,
    deviceSaveData: input.deviceSaveData,
  });
  const videoQuality = input.saved?.videoQuality ?? "auto";
  return {
    mode,
    videoQuality,
    ceiling: resolveVideoCeiling(mode, videoQuality),
    source: input.saved ? "yours" : input.schoolLowDataMode ? "school" : "default",
  };
}

export type PlaybackPolicy = {
  /** Pixel ceiling the player should hold to. */
  ceiling: number;
  /** Honest one-liner for the player footer. */
  note: string;
};

export function playbackPolicyFor(mode: DataMode, quality: VideoQuality): PlaybackPolicy {
  const ceiling = resolveVideoCeiling(mode, quality);
  return {
    ceiling,
    note: `Quality capped at ${ceiling}p.`,
  };
}

type SaveDataConnection = { saveData?: boolean };

/**
 * The device's own data-saver request (`navigator.connection.saveData`).
 * Absent in Safari and on SSR, which simply means "no request".
 */
export function readDeviceSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
  return connection?.saveData === true;
}
