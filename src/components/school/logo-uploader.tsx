"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createSchoolLogoUploadAction } from "@/app/school/actions";
import { validateLogoFile } from "@/lib/school-logo";

/**
 * School logo picker.
 *
 * The file is sent straight to the public school-assets bucket with a one-time
 * signed URL, so it never passes through the app server. Once the bytes land,
 * `onUploaded` is called with the public URL so the parent can persist it
 * (settings save it immediately; onboarding stores it against the new school).
 */
export function LogoUploader({
  currentUrl,
  onUploaded,
  disabled,
}: {
  currentUrl: string | null;
  onUploaded: (url: string | null) => Promise<{ ok: boolean; error?: string }> | void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = uploading || disabled;

  async function handleFile(file: File) {
    setError(null);
    setNotice(null);

    const invalid = validateLogoFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setUploading(true);
    try {
      const started = await createSchoolLogoUploadAction(file.type);
      if (!started.ok) {
        setError(started.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("school-assets")
        .uploadToSignedUrl(started.upload.path, started.upload.token, file, {
          contentType: file.type,
        });
      if (uploadError) {
        setError("That upload failed. Please try again.");
        return;
      }

      const saved = await onUploaded(started.upload.publicUrl);
      if (saved && !saved.ok) {
        setError(saved.error ?? "We couldn't save your logo.");
        return;
      }
      setPreview(started.upload.publicUrl);
      setNotice("Logo updated.");
    } catch {
      setError("That upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function remove() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const saved = await onUploaded(null);
      if (saved && !saved.ok) {
        setError(saved.error ?? "We couldn't remove your logo.");
        return;
      }
      setPreview(null);
      setNotice("Logo removed.");
    });
  }

  return (
    <div className="grid gap-2">
      <Label>School logo</Label>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="School logo preview" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            id="school-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="mr-1 size-4" aria-hidden="true" />
            )}
            {preview ? "Replace logo" : "Upload logo"}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <X className="mr-1 size-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </div>
  );
}
