"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Link2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import {
  categoryAccept,
  categoryFileTypes,
  categoryMimeTypes,
  formatBytes,
  materialCategories,
  materialCategoryLabels,
  maxUploadBytes,
  restrictedCategories,
  type MaterialCategory,
} from "@/lib/material-types";
import {
  completeMaterialUploadAction,
  startMaterialUploadAction,
} from "@/app/teacher/material-actions";

/**
 * Teacher-side uploader for lesson material.
 *
 * The file is handed straight to its destination: documents, PDFs, images and
 * audio go to the private Supabase bucket using a one-time signed upload URL,
 * while video goes to the external host. Nothing streams through this server,
 * which keeps a 50 MB PDF or a long lesson video from hitting a request body
 * limit.
 */

type Category = MaterialCategory;

const CATEGORY_HINTS: Record<Category, string> = {
  document: "Word, PowerPoint or text",
  pdf: "PDF up to 50 MB",
  video: "Uploaded securely, plays signed",
  audio: "Streamed, not downloadable",
  image: "PNG, JPG or WebP up to 10 MB",
  link: "Paste a web address",
};

export function MaterialUploader({
  lessonId,
  courseId,
  onUploaded,
}: {
  lessonId: string;
  courseId: string;
  onUploaded?: () => void;
}) {
  const [category, setCategory] = useState<Category>("document");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = isPending || progress !== null;

  function pickCategory(next: Category) {
    setCategory(next);
    setError(null);
    setNotice(null);
    // A file chosen under one category can violate the next category's limits,
    // so drop it rather than letting a stale selection through.
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function pickFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }

    const allowed = categoryMimeTypes[category];
    if (allowed.length && !allowed.includes(next.type)) {
      setError(`${next.name} is not a ${materialCategoryLabels[category].toLowerCase()} file.`);
      setFile(null);
      return;
    }

    const limit = maxUploadBytes[category];
    if (next.size > limit) {
      setError(
        `${next.name} is ${formatBytes(next.size)}. The limit is ${formatBytes(limit)}.`,
      );
      setFile(null);
      return;
    }

    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
    setFile(next);
  }

  async function putToBucket(path: string, token: string, body: File) {
    const supabase = createClient();
    // uploadToSignedUrl has no progress callback, so report coarse phases.
    setProgress(5);
    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .uploadToSignedUrl(path, token, body, { contentType: body.type });

    if (uploadError) throw new Error(uploadError.message);
    setProgress(90);
  }

  async function putToVideoHost(uploadUrl: string, body: File) {
    setProgress(5);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body,
      headers: { "Content-Type": body.type || "application/octet-stream" },
    });
    if (!response.ok) {
      throw new Error("The video host rejected the upload. Please try again.");
    }
    setProgress(90);
  }

  function submit() {
    setError(null);
    setNotice(null);

    if (!title.trim()) {
      setError("Give this material a title.");
      return;
    }
    if (category === "link") {
      if (!/^https?:\/\/\S+$/i.test(url.trim())) {
        setError("Enter a full link, starting with https://");
        return;
      }
    } else if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    startTransition(async () => {
      try {
        const started = await startMaterialUploadAction({
          lessonId,
          courseId,
          title: title.trim(),
          category,
          fileName: file?.name,
          mimeType: file?.type,
          sizeBytes: file?.size,
          fileUrl: category === "link" ? url.trim() : undefined,
        });

        if (!started.ok) {
          setError(started.error);
          return;
        }

        // A link has no bytes to send; the row is already complete.
        let pending = false;
        if (category !== "link" && file) {
          if (started.providerUploadUrl) {
            await putToVideoHost(started.providerUploadUrl, file);
          } else if (started.uploadPath) {
            await putToBucket(started.uploadPath, started.token, file);
          }

          const done = await completeMaterialUploadAction(
            started.materialId,
            lessonId,
            courseId,
          );
          if (!done.ok) {
            setError(done.error);
            return;
          }
          pending = done.pending === true;
        }

        setProgress(100);
        setTitle("");
        setUrl("");
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        if (pending) {
          setNotice(
            "Video uploaded. The video host is still processing it, so it will appear on the lesson shortly.",
          );
        }
        onUploaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That upload failed. Please try again.");
      } finally {
        setProgress(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Material category">
          {materialCategories.map((option) => {
            const active = option === category;
            const locked = restrictedCategories.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => pickCategory(option)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 rounded-md border px-3 text-sm font-medium transition-colors",
                  "active:scale-[0.98]",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {materialCategoryLabels[option]}
                {locked ? <span className="ml-1 text-[10px] uppercase">locked</span> : null}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[category]}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="material-title">Title</Label>
        <Input
          id="material-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Week 1 reading"
          maxLength={160}
          disabled={busy}
        />
      </div>

      {category === "link" ? (
        <div className="space-y-1.5">
          <Label htmlFor="material-url">Link</Label>
          <Input
            id="material-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/reading"
            inputMode="url"
            disabled={busy}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="material-file">
            File
            <span className="ml-1 font-normal text-muted-foreground">
              (max {formatBytes(maxUploadBytes[category])})
            </span>
          </Label>
          <input
            ref={fileInput}
            id="material-file"
            type="file"
            accept={categoryAccept[category]}
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full min-h-11 cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:min-h-7 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium"
          />
          {file ? (
            <p className="text-xs text-muted-foreground">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {progress !== null ? (
        <div className="space-y-1" aria-live="polite">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {category === "video" ? "Uploading video" : "Uploading file"}… {progress}%
            {category === "video" && progress >= 90
              ? " Processing on the video host, this can take a minute."
              : ""}
          </p>
        </div>
      ) : null}

      <Button type="button" onClick={submit} disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : category === "link" ? (
          <Link2 className="size-4" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        {busy ? "Working…" : "Add material"}
      </Button>

      <p className="text-[11px] text-muted-foreground">
        {category === "video"
          ? "Video is hosted separately and only plays through a link signed to each viewer."
          : category === "audio"
            ? "Audio is stored privately and streamed, so students cannot save the file."
            : "Files are stored privately and opened through short-lived links."}
        {categoryFileTypes[category].length > 1
          ? ` Accepted: ${categoryFileTypes[category].join(", ").toUpperCase()}.`
          : ""}
      </p>
    </div>
  );
}
