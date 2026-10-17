"use client";

import { useState, useSyncExternalStore } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { saveDataPreferencesAction } from "@/app/student/actions";
import {
  DATA_MODES,
  DATA_MODE_HINTS,
  DATA_MODE_LABELS,
  VIDEO_QUALITIES,
  VIDEO_QUALITY_LABELS,
  readDeviceSaveData,
  resolveEffectivePreferences,
  type DataMode,
  type DataPreferencesView,
  type VideoQuality,
} from "@/lib/data-preferences";

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

/** Subscribes to the browser's network-information "change" event, when present. */
function subscribeConnection(onChange: () => void): () => void {
  const connection =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { connection?: EventTarget }).connection
      : undefined;
  if (!connection?.addEventListener) return () => {};
  connection.addEventListener("change", onChange);
  return () => connection.removeEventListener("change", onChange);
}

/**
 * The learner's own data-quality choice (spec section 50).
 *
 * The line above the form states what is actually in force and where that came
 * from — their choice, the school's default, or plain default — because a
 * "Data Saver: on" that silently means something else is worse than no setting.
 * The device's own save-data request is read through useSyncExternalStore so
 * the server render and the browser agree, and it is never shown as the
 * learner's own choice.
 */
export function DataPreferencesCard({ initial }: { initial: DataPreferencesView }) {
  const [saved, setSaved] = useState(initial.saved);
  const [dataMode, setDataMode] = useState<DataMode>(initial.saved?.dataMode ?? initial.defaultDataMode);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(initial.saved?.videoQuality ?? "auto");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const deviceSaveData = useSyncExternalStore(subscribeConnection, readDeviceSaveData, () => false);

  const effective = resolveEffectivePreferences({
    saved,
    schoolLowDataMode: initial.schoolLowDataMode,
    deviceSaveData,
  });

  const source =
    effective.source === "yours"
      ? "Your saved choice"
      : effective.source === "school"
        ? "Your school's low-data default"
        : deviceSaveData
          ? "This device asks to save data"
          : "Not chosen yet — this is the default";

  async function save() {
    setStatus("saving");
    setError(null);
    const result = await saveDataPreferencesAction({ dataMode, videoQuality });
    if (result.ok) {
      setSaved({ dataMode, videoQuality });
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" aria-hidden="true" />
          Data &amp; video quality
        </CardTitle>
        <CardDescription>
          Choose how much data lessons may use. Video plays at the cap below wherever the
          browser lets the player hold to it; where it cannot, the player says so.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Active now: <span className="font-medium text-foreground">{DATA_MODE_LABELS[effective.mode]}</span>
          {" · "}
          {effective.videoQuality === "auto"
            ? `video up to ${effective.ceiling}p`
            : `video capped at ${effective.ceiling}p`}
          {" · "}
          {source}.
        </p>

        <div className="grid gap-2">
          <Label htmlFor="data-mode">Data mode</Label>
          <select
            id="data-mode"
            className={nativeSelectClass()}
            value={dataMode}
            onChange={(event) => {
              setDataMode(event.target.value as DataMode);
              setStatus("idle");
            }}
          >
            {DATA_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {DATA_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{DATA_MODE_HINTS[dataMode]}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="video-quality">Video quality</Label>
          <select
            id="video-quality"
            className={nativeSelectClass()}
            value={videoQuality}
            onChange={(event) => {
              setVideoQuality(event.target.value as VideoQuality);
              setStatus("idle");
            }}
          >
            {VIDEO_QUALITIES.map((quality) => (
              <option key={quality} value={quality}>
                {VIDEO_QUALITY_LABELS[quality]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save preferences"}
          </Button>
          {status === "saved" ? (
            <p className="text-xs text-muted-foreground">
              Saved. {saved ? `Video will hold to ${effective.ceiling}p where the browser allows.` : ""}
            </p>
          ) : null}
          {status === "error" && error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
