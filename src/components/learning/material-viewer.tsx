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
  className,
}: {
  material: StudentMaterial;
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
        <VideoPanel material={material} />
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

function VideoPanel({ material }: { material: StudentMaterial }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | {
        status: "ready";
        url: string;
        watermark: string;
        expiresAt: string;
      }
    | { status: "error"; error: string }
  >({ status: "idle" });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      // Replacing `src` on a playing element resets the playhead, so hold the
      // fresh URL back and swap it in at the next pause or when playback ends.
      // The token already loaded keeps working until then, so the handover is
      // invisible to the viewer.
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

  if (state.status === "ready") {
    return (
      <div className="w-full">
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            src={state.url}
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
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          Playback is signed to you and this link expires shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        onClick={start}
        disabled={state.status === "loading"}
      >
        <Play className="size-3.5" aria-hidden="true" />
        {state.status === "loading" ? "Preparing…" : "Watch"}
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
