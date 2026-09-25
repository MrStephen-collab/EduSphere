"use client";

import { useState, useTransition } from "react";
import { Megaphone, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  deleteAnnouncementAction,
  type ActionState,
} from "@/app/school/actions";
import {
  ANNOUNCEMENT_TARGETS,
  announcementTargetLabels,
} from "@/lib/announcement-labels";
import type { Announcement, AnnouncementTarget } from "@/types/database";

type ClassOption = { id: string; name: string };

type AnnouncementView = Announcement & {
  status: "active" | "scheduled" | "expired";
  className: string | null;
  authorName: string | null;
};

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIso(localInput: string): string | null {
  if (!localInput) return null;
  const d = new Date(localInput);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type FormValues = {
  title: string;
  message: string;
  targetType: AnnouncementTarget;
  classId: string;
  publishedAt: string;
  expiresAt: string;
};

function AnnouncementForm({
  classes,
  initial,
  submitAction,
  submitLabel,
  onDone,
}: {
  classes: ClassOption[];
  initial?: Partial<Announcement>;
  submitAction: (input: {
    title: string;
    message: string;
    targetType: AnnouncementTarget;
    classId: string | null;
    publishedAt: string | null;
    expiresAt: string | null;
  }) => Promise<ActionState>;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [values, setValues] = useState<FormValues>({
    title: initial?.title ?? "",
    message: initial?.message ?? "",
    targetType: (initial?.target_type as AnnouncementTarget) ?? "school",
    classId: initial?.class_id ?? "",
    publishedAt: toLocalInput(initial?.published_at ?? null),
    expiresAt: toLocalInput(initial?.expires_at ?? null),
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));
  const wantsClass = values.targetType === "class";

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await submitAction({
            title: values.title.trim(),
            message: values.message.trim(),
            targetType: values.targetType,
            classId: wantsClass ? values.classId || null : null,
            publishedAt: values.publishedAt
              ? toUtcIso(values.publishedAt)
              : null,
            expiresAt: values.expiresAt ? toUtcIso(values.expiresAt) : null,
          });
          if (result.ok) {
            onDone?.();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="a-title">Title</Label>
        <Input
          id="a-title"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. Inter-house sports day"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="a-message">Message</Label>
        <textarea
          id="a-message"
          value={values.message}
          onChange={(e) => set({ message: e.target.value })}
          placeholder="What should people know?"
          rows={3}
          required
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="a-target">Audience</Label>
          <select
            id="a-target"
            value={values.targetType}
            onChange={(e) =>
              set({ targetType: e.target.value as AnnouncementTarget })
            }
            className={nativeSelectClass()}
          >
            {ANNOUNCEMENT_TARGETS.map((t) => (
              <option key={t} value={t}>
                {announcementTargetLabels[t]}
              </option>
            ))}
          </select>
        </div>

        {wantsClass && (
          <div className="grid gap-1.5">
            <Label htmlFor="a-class">Class</Label>
            <select
              id="a-class"
              value={values.classId}
              onChange={(e) => set({ classId: e.target.value })}
              className={nativeSelectClass()}
              required
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!values.publishedAt}
              onChange={(e) => set({ publishedAt: e.target.checked ? toLocalInput(new Date().toISOString()) : "" })}
              className="size-4 accent-primary"
            />
            Schedule for later
          </label>
          {values.publishedAt && (
            <Input
              type="datetime-local"
              value={values.publishedAt}
              onChange={(e) => set({ publishedAt: e.target.value })}
              aria-label="Publish date and time"
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!values.expiresAt}
              onChange={(e) => set({ expiresAt: e.target.checked ? toLocalInput(new Date().toISOString()) : "" })}
              className="size-4 accent-primary"
            />
            Set an expiry
          </label>
          {values.expiresAt && (
            <Input
              type="datetime-local"
              value={values.expiresAt}
              onChange={(e) => set({ expiresAt: e.target.value })}
              aria-label="Expiry date and time"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Megaphone className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function AnnouncementComposer({
  classes,
}: {
  classes: ClassOption[];
}) {
  return (
    <AnnouncementForm
      classes={classes}
      submitAction={createAnnouncementAction}
      submitLabel="Publish announcement"
    />
  );
}

const statusLabels: Record<AnnouncementView["status"], string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
};

const statusClasses: Record<AnnouncementView["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  scheduled: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  expired: "bg-muted text-muted-foreground",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AnnouncementList({
  announcements,
  classes,
}: {
  announcements: AnnouncementView[];
  classes: ClassOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ul className="grid gap-2">
      {announcements.length === 0 ? (
        <li className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No announcements yet. Publish your first one to reach the whole
          school.
        </li>
      ) : (
        announcements.map((a) => (
          <li key={a.id} className="rounded-md border bg-card p-3">
            {editingId === a.id ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Edit announcement</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                    aria-label="Close editor"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <AnnouncementForm
                  classes={classes}
                  initial={a}
                  submitAction={(input) => updateAnnouncementAction(a.id, input)}
                  submitLabel="Save changes"
                  onDone={() => setEditingId(null)}
                />
              </div>
            ) : (
              <AnnouncementRow a={a} onEdit={() => setEditingId(a.id)} />
            )}
          </li>
        ))
      )}
    </ul>
  );
}

function AnnouncementRow({
  a,
  onEdit,
}: {
  a: AnnouncementView;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{a.title}</p>
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[a.status]}`}
          >
            {statusLabels[a.status]}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {announcementTargetLabels[a.target_type]}
            {a.className ? ` · ${a.className}` : ""}
          </span>
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {a.message}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {a.status === "scheduled"
            ? `Publishes ${formatDate(a.published_at)}`
            : `Published ${formatDate(a.published_at)}`}
          {a.expires_at ? ` · until ${formatDate(a.expires_at)}` : ""}
          {a.authorName ? ` · by ${a.authorName}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {error && <span className="text-destructive">{error}</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-foreground"
            disabled={isPending}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("Delete this announcement? This cannot be undone.")
              ) {
                return;
              }
              setError(null);
              startTransition(async () => {
                const result = await deleteAnnouncementAction(a.id);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </span>
      </div>
    </div>
  );
}