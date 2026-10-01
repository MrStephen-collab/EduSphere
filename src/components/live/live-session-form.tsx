"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { createLiveSessionAction } from "@/app/live/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Schedules a session. The join link is whatever the teacher already has -- a
 * Meet room they made, a Zoom link from their provider -- because EduSphere does
 * not create rooms and cannot.
 *
 * Times leave here as ISO with the browser's offset attached. The datetime-local
 * input has no zone of its own, and the server is in UTC, so a naive string
 * would put every session an hour out for a Lagos school and an hour out the
 * other way for a London one.
 */
export function LiveSessionForm({ classes }: { classes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    classId: classes[0]?.id ?? "",
    title: "",
    description: "",
    joinUrl: "",
    startsAt: "",
    endsAt: "",
    isVisibleToStudents: true,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" aria-hidden />
          Schedule a live session
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste the join link from your video provider. EduSphere keeps the schedule
          and the register; the teaching happens on Zoom, Meet or Teams.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-sm text-muted-foreground">Scheduled.</p>
        )}
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const result = await createLiveSessionAction({
                classId: form.classId,
                title: form.title.trim(),
                description: form.description.trim() || null,
                joinUrl: form.joinUrl.trim(),
                startsAt: toIso(form.startsAt) ?? "",
                endsAt: toIso(form.endsAt),
                isVisibleToStudents: form.isVisibleToStudents,
              });
              if (result.ok) {
                setForm((current) => ({
                  ...current,
                  title: "",
                  description: "",
                  joinUrl: "",
                  startsAt: "",
                  endsAt: "",
                }));
                setSaved(true);
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Class
              <select
                className={selectClass}
                value={form.classId}
                onChange={(e) => set("classId", e.target.value)}
                required
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Title
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Quadratic equations: past questions"
                required
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Join link
            <Input
              value={form.joinUrl}
              onChange={(e) => set("joinUrl", e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              inputMode="url"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Starts
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                required
              />
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Ends
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Notes for students
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Bring exercise 4.2 and a calculator."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVisibleToStudents}
              onChange={(e) => set("isVisibleToStudents", e.target.checked)}
            />
            Announce to students now
          </label>

          <div>
            <Button type="submit" disabled={isPending}>
              Schedule session
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
