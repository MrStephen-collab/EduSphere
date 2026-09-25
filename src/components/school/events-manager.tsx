"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Pencil, Trash2, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEventAction,
  updateEventAction,
  setEventPublishedAction,
  deleteEventAction,
  type ActionState,
} from "@/app/school/actions";
import type { SchoolEvent } from "@/services/school-media";

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
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
  description: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  coverUrl: string;
  published: boolean;
};

function EventForm({
  initial,
  submitAction,
  submitLabel,
  onDone,
}: {
  initial?: SchoolEvent;
  submitAction: (input: {
    title: string;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
    venue: string | null;
    coverUrl: string | null;
    published: boolean;
  }) => Promise<ActionState>;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [values, setValues] = useState<FormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    startsAt: toLocalInput(initial?.startsAt ?? null),
    endsAt: toLocalInput(initial?.endsAt ?? null),
    venue: initial?.venue ?? "",
    coverUrl: initial?.coverUrl ?? "",
    published: initial?.published ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await submitAction({
            title: values.title.trim(),
            description: values.description.trim() || null,
            startsAt: toUtcIso(values.startsAt),
            endsAt: toUtcIso(values.endsAt),
            venue: values.venue.trim() || null,
            coverUrl: values.coverUrl.trim() || null,
            published: values.published,
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
        <Label htmlFor="ev-title">Title</Label>
        <Input
          id="ev-title"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. Inter-house sports day"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ev-desc">Description</Label>
        <textarea
          id="ev-desc"
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="What happens at this event?"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ev-start">Starts</Label>
          <Input
            id="ev-start"
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-end">Ends</Label>
          <Input
            id="ev-end"
            type="datetime-local"
            value={values.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-venue">Venue</Label>
          <Input
            id="ev-venue"
            value={values.venue}
            onChange={(e) => set({ venue: e.target.value })}
            placeholder="e.g. School hall"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-cover">Cover image URL (optional)</Label>
          <Input
            id="ev-cover"
            value={values.coverUrl}
            onChange={(e) => set({ coverUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={values.published}
          onChange={(e) => set({ published: e.target.checked })}
        />
        Publish so students and parents can see it
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <CalendarDays className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event }: { event: SchoolEvent }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Edit event</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
            aria-label="Close editor"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <EventForm
          initial={event}
          submitAction={(input) => updateEventAction(event.id, input)}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{event.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                event.published
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {event.published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {event.startsAt ? formatDate(event.startsAt) : "No start time"}
            {event.endsAt ? ` · until ${formatDate(event.endsAt)}` : ""}
            {event.venue ? ` · ${event.venue}` : ""}
            {event.authorName ? ` · by ${event.authorName}` : ""}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await setEventPublishedAction(event.id, !event.published);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            {event.published ? (
              <EyeOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" aria-hidden="true" />
            )}
            {event.published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-foreground"
            disabled={isPending}
            onClick={() => setEditing(true)}
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
                !window.confirm(`Delete "${event.title}"? This cannot be undone.`)
              ) {
                return;
              }
              setError(null);
              startTransition(async () => {
                const result = await deleteEventAction(event.id);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </span>
      </div>

      {event.description && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {event.description}
        </p>
      )}
      {event.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverUrl}
          alt=""
          className="h-32 w-full rounded-md object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}

export function EventsManager({ events }: { events: SchoolEvent[] }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-md border bg-card p-3">
        <p className="mb-3 text-sm font-semibold">Add an event</p>
        <EventForm submitAction={createEventAction} submitLabel="Create event" />
      </div>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No events yet. Create your first one above.
        </p>
      ) : (
        <ul className="grid gap-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-md border bg-card p-3">
              <EventRow event={event} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}