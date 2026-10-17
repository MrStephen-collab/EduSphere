"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Link2, Lock, Music, Play, Video } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ForensicWatermark } from "@/components/learning/forensic-watermark";
import { categoryForFileType, formatBytes } from "@/lib/material-types";
import {
  requestMaterialAccessAction,
  requestVideoPlaybackAction,
} from "@/app/learn/material-actions";
import { saveDataPreferencesAction } from "@/app/student/actions";
import { attachPlayback, describePlayback, type PlaybackHandle } from "@/lib/video-playback";
import {
  composeDataMode,
  readDeviceSaveData,
  resolveVideoCeiling,
  VIDEO_QUALITIES,
  VIDEO_QUALITY_LABELS,
  type DataPreferencesView,
  type VideoQuality,
} from "@/lib/data-preferences";

/**
 * Student-side renderer for one lesson material.
 *
 * The important detail is that nothing is fetched until the learner asks for
 * it: opening a lesson does not mint a URL. Documents and PDFs take a fresh
 * short-lived grant on click. Audio and video stream inline from a grant that
 * expires in minutes, and neither element is given a `download` affordance or
 * a `src` that outlives the session.
 */

export type StudentMaterial = {
  id: string;
  title: string;
  fileType: string | null;
  fileSize: number | null;
  restricted: boolean;
  provider: string | null;
};

const ICONS = {
  document: FileText,
  pdf: FileText,
  image: FileText,
  link: Link2,
  audio: Music,
  video: Video,
} as const;

export function MaterialViewer({
  material,
  preferences,
  className,
}: {
  material: StudentMaterial;
  preferences: DataPreferencesView;
  className?: string;
}) {
  const category = categoryForFileType(material.fileType);
  const Icon = ICONS[category] ?? FileText;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{material.title}</p>
          <p className="text-xs text-muted-foreground">
            {material.fileType?.toUpperCase() ?? "FILE"}
            {material.fileSize ? ` · ${formatBytes(material.fileSize)}` : ""}
            {material.restricted ? " · protected" : ""}
          </p>
        </div>
      </div>

      {category === "video" ? (
        <VideoPanel material={material} preferences={preferences} />
      ) : category === "audio" ? (
        <AudioPanel material={material} />
      ) : category === "link" ? (
        <LinkPanel material={material} />
      ) : (
        <DownloadPanel material={material} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Video
// -----------------------------------------------------------------------------

/** Compact quality picker, shown beside Watch and below the player. */
function QualityChoice({
  value,
  disabled,
  onChange,
}: {
  value: VideoQuality;
  disabled?: boolean;
  onChange: (next: VideoQuality) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      Quality
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as VideoQuality)}
        aria-label="Video quality"
        className="h-7 rounded-md border bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {VIDEO_QUALITIES.map((quality) => (
          <option key={quality} value={quality}>
            {VIDEO_QUALITY_LABELS[quality]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Signed video playback under the learner's data preference.
 *
 * The ceiling is enforced through the adaptive stream (hls.js caps which rung
 * it will climb); an ABR cap switch needs no re-attach, so changing quality
 * mid-lesson never restarts playback. Where the browser cannot hold the cap —
 * its own HLS stack, or the single-file fallback — the footer says so plainly
 * rather than implying a saving that is not happening.
 */
function VideoPanel({
  material,
  preferences,
}: {
  material: StudentMaterial;
  preferences: DataPreferencesView;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | {
        status: "ready";
        url: string;
        hlsUrl: string;
        watermark: string;
        expiresAt: string;
      }
    | { status: "error"; error: string }
  >({ status: "idle" });
  const [playing, setPlaying] = useState(false);
  const [quality, setQuality] = useState<VideoQuality>(
    preferences.saved?.videoQuality ?? "auto",
  );
  const [note, setNote] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<PlaybackHandle | null>(null);
  const qualityRef = useRef<VideoQuality>(quality);
  const ceilingRef = useRef<number>(
    resolveVideoCeiling(preferences.defaultDataMode, preferences.saved?.videoQuality ?? "auto"),
  );

  // Read inside the grant fetcher without making it depend on `playing`, which
  // would otherwise rebuild the timer on every play/pause.
  const playingRef = useRef(false);
  const pendingUrl = useRef<string | null>(null);

  const applyPending = useCallback(() => {
    const next = pendingUrl.current;
    if (!next) return;
    pendingUrl.current = null;
    setState((current) =>
      current.status === "ready" && current.url !== next
        ? { ...current, url: next }
        : current,
    );
  }, []);

  const fetchGrant = useCallback(async (): Promise<boolean> => {
    const result = await requestVideoPlaybackAction(material.id);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return false;
    }

    if (playingRef.current) {
      // Replacing the source on a playing element resets the playhead, so hold
      // the fresh URL back and swap it in at the next pause or when playback
      // ends. The token already loaded keeps working until then.
      pendingUrl.current = result.streamUrl;
      setState((current) =>
        current.status === "ready"
          ? { ...current, watermark: result.watermark, expiresAt: result.expiresAt }
          : current,
      );
    } else {
      pendingUrl.current = null;
      setState({
        status: "ready",
        url: result.streamUrl,
        hlsUrl: result.hlsUrl,
        watermark: result.watermark,
        expiresAt: result.expiresAt,
      });
    }

    return true;
  }, [material.id]);

  const start = useCallback(async () => {
    setState({ status: "loading" });
    await fetchGrant();
  }, [fetchGrant]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (state.status !== "ready") return;

    const refreshInMs = Math.max(Date.parse(state.expiresAt) - Date.now() - 45_000, 5_000);

    const timer = setTimeout(() => {
      void fetchGrant();
    }, refreshInMs);

    return () => clearTimeout(timer);
  }, [state, fetchGrant]);

  const url = state.status === "ready" ? state.url : null;
  const hlsUrl = state.status === "ready" ? state.hlsUrl : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!url || !hlsUrl || !video) return;

    let cancelled = false;
    let attached: PlaybackHandle | null = null;

    void (async () => {
      const mode = composeDataMode({
        savedMode: preferences.saved?.dataMode ?? null,
        schoolLowDataMode: preferences.schoolLowDataMode,
        deviceSaveData: readDeviceSaveData(),
      });
      const ceiling = resolveVideoCeiling(mode, qualityRef.current);
      ceilingRef.current = ceiling;

      const handle = await attachPlayback({ video, streamUrl: url, hlsUrl, ceiling });
      if (cancelled) {
        handle.detach();
        return;
      }
      attached = handle;
      handleRef.current = handle;
      handle.onFallback(() =>
        setNote(describePlayback(handle.strategy, handle.enforced, ceilingRef.current)),
      );
      setNote(describePlayback(handle.strategy, handle.enforced, ceilingRef.current));
    })();

    return () => {
      cancelled = true;
      if (attached) attached.detach();
      if (handleRef.current === attached) handleRef.current = null;
    };
  }, [url, hlsUrl, preferences]);

  const changeQuality = useCallback(
    async (next: VideoQuality) => {
      const previous = qualityRef.current;
      qualityRef.current = next;
      setQuality(next);
      setPreferenceError(null);

      // Persist a concrete mode so the row counts as an explicit choice; the
      // device's own save-data request is deliberately not written down.
      const dataMode = preferences.saved?.dataMode ?? preferences.defaultDataMode;
      const result = await saveDataPreferencesAction({ dataMode, videoQuality: next });
      if (!result.ok) {
        qualityRef.current = previous;
        setQuality(previous);
        setPreferenceError(result.error);
        return;
      }

      const ceiling = resolveVideoCeiling(
        composeDataMode({
          savedMode: dataMode,
          schoolLowDataMode: preferences.schoolLowDataMode,
          deviceSaveData: readDeviceSaveData(),
        }),
        next,
      );
      ceilingRef.current = ceiling;
      handleRef.current?.setCeiling(ceiling);
      if (handleRef.current) {
        setNote(
          describePlayback(handleRef.current.strategy, handleRef.current.enforced, ceiling),
        );
      }
    },
    [preferences],
  );

  if (state.status === "ready") {
    return (
      <div className="w-full">
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              applyPending();
            }}
            onEnded={() => {
              setPlaying(false);
              applyPending();
            }}
            className="max-h-[70vh] w-full"
            aria-label={material.title}
          />
          <ForensicWatermark label={state.watermark} animate={playing} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Playback is signed to you and this link expires shortly.
          </p>
          <QualityChoice value={quality} onChange={(next) => void changeQuality(next)} />
        </div>
        {note ? <p className="mt-1 text-[11px] text-muted-foreground">{note}</p> : null}
        {preferenceError ? (
          <p className="mt-1 text-[11px] text-destructive">{preferenceError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <QualityChoice
          value={quality}
          disabled={state.status === "loading"}
          onChange={(next) => void changeQuality(next)}
        />
        <Button
          type="button"
          size="sm"
          onClick={start}
          disabled={state.status === "loading"}
        >
          <Play className="size-3.5" aria-hidden="true" />
          {state.status === "loading" ? "Preparing…" : "Watch"}
        </Button>
      </div>
      {state.status === "error" ? (
        <p className="max-w-[16rem] text-right text-[11px] text-destructive">
          {state.error}
        </p>
      ) : null}
      {preferenceError ? (
        <p className="max-w-[16rem] text-right text-[11px] text-destructive">
          {preferenceError}
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Audio
// -----------------------------------------------------------------------------

function AudioPanel({ material }: { material: StudentMaterial }) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "ready"; url: string; watermark: string } | { status: "error"; error: string }
  >({ status: "idle" });
  const [playing, setPlaying] = useState(false);

  const start = useCallback(async () => {
    const result = await requestMaterialAccessAction(material.id);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    const grant = result.grant;
    if (!grant.streamUrl) {
      setState({ status: "error", error: "That recording is not available right now." });
      return;
    }
    setState({ status: "ready", url: grant.streamUrl, watermark: grant.watermark });
  }, [material.id]);

  if (state.status === "ready") {
    return (
      <div className="w-full">
        <div className="relative rounded-lg border border-border bg-muted/40 p-2">
          <audio
            src={state.url}
            controls
            controlsList="nodownload noplaybackrate"
            onContextMenu={(event) => event.preventDefault()}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="w-full"
            aria-label={material.title}
          />
          <ForensicWatermark label={state.watermark} animate={playing} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          This recording is streamed, not downloadable.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={start}>
        <Play className="size-3.5" aria-hidden="true" />
        Listen
      </Button>
      {state.status === "error" ? (
        <p className="max-w-[16rem] text-right text-[11px] text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Links and documents
// -----------------------------------------------------------------------------

function LinkPanel({ material }: { material: StudentMaterial }) {
  const [href, setHref] = useState<string | null>(null);

  const open = useCallback(async () => {
    const result = await requestMaterialAccessAction(material.id);
    if (result.ok && result.grant.streamUrl) {
      setHref(result.grant.streamUrl);
      window.open(result.grant.streamUrl, "_blank", "noopener,noreferrer");
    }
  }, [material.id]);

  return (
    <Button type="button" size="sm" variant="outline" onClick={open}>
      <Link2 className="size-3.5" aria-hidden="true" />
      Open
      <span className="sr-only">{href ?? "link"}</span>
    </Button>
  );
}

function DownloadPanel({ material }: { material: StudentMaterial }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await requestMaterialAccessAction(material.id);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = result.grant.streamUrl;
    if (!url) {
      setError("That file is not available right now.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [material.id]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={open} disabled={busy}>
        {busy ? "Opening…" : "Open"}
      </Button>
      {error ? <p className="max-w-[16rem] text-right text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
