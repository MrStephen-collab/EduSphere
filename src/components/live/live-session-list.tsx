"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Eye, EyeOff, Radio, Trash2 } from "lucide-react";
import type { LiveSessionView } from "@/services/live";
import {
  deleteLiveSessionAction,
  setLiveSessionStatusAction,
  setLiveSessionVisibilityAction,
} from "@/app/live/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LIVE_SESSION_STATUS_LABEL,
  attendanceStatusLabel,
  isLiveNow,
  joinHost,
} from "@/lib/live-labels";

/**
 * Times are formatted here rather than on the server. A session is stored as an
 * instant, and rendering it in the server's zone would show a Lagos student a
 * class that starts an hour early for most of the year.
 */
function when(iso: string, endsAt: string | null): string {
  const start = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const base = start.toLocaleString(undefined, options);
  if (!endsAt) return base;
  return `${base} – ${new Date(endsAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function LiveSessionList({
  sessions,
  now,
  showClass = true,
  emptyMessage = "No live sessions yet.",
}: {
  sessions: LiveSessionView[];
  /** Stamped by the server, so render reads no clock of its own. */
  now: string;
  showClass?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const clock = new Date(now);

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  if (!sessions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live sessions</CardTitle>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {sessions.map((session) => {
          const live = isLiveNow(session.status, session.startsAt, session.endsAt, clock);

          return (
            <article key={session.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {session.title}
                    {live && (
                      <Badge className="gap-1">
                        <Radio className="h-3 w-3" aria-hidden />
                        Live now
                      </Badge>
                    )}
                    {session.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
                    {session.status === "ended" && !live && (
                      <Badge variant="secondary">
                        {LIVE_SESSION_STATUS_LABEL.ended}
                      </Badge>
                    )}
                  </p>

                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    <time dateTime={session.startsAt}>{when(session.startsAt, session.endsAt)}</time>
                    {showClass && session.className && <span>· {session.className}</span>}
                    {session.subjectName && <span>· {session.subjectName}</span>}
                    {session.lessonTitle && <span>· {session.lessonTitle}</span>}
                  </p>

                  {session.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
                    <a
                      href={session.joinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2"
                    >
                      {joinHost(session.joinUrl) ?? session.joinUrl}
                    </a>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={session.joinUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium shadow-sm ${
                      live
                        ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    Join
                  </a>

                  {session.status !== "ended" && session.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        act(() =>
                          setLiveSessionStatusAction(
                            session.id,
                            live ? "ended" : "live",
                          ),
                        )
                      }
                    >
                      {live ? "End" : "Go live"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      act(() =>
                        setLiveSessionVisibilityAction(session.id, !session.isVisibleToStudents),
                      )
                    }
                  >
                    {session.isVisibleToStudents ? (
                      <>
                        <EyeOff className="h-4 w-4" aria-hidden />
                        Un-announce
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" aria-hidden />
                        Announce
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!window.confirm(`Delete "${session.title}"? The register goes with it.`)) return;
                      act(() => deleteLiveSessionAction(session.id));
                    }}
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** The student's view: a join button, and their own mark once it is taken. */
export function StudentLiveSessionList({
  sessions,
  now,
}: {
  sessions: LiveSessionView[];
  /** Stamped by the server, so render reads no clock of its own. */
  now: string;
}) {
  const nowMs = new Date(now).getTime();

  const upcoming = sessions
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  // The newest session that is either running or still to come. A session that
  // has already finished is not the next one, however recently it was.
  const next =
    upcoming.find(
      (s) =>
        isLiveNow(s.status, s.startsAt, s.endsAt, new Date(now)) ||
        new Date(s.startsAt).getTime() > nowMs,
    ) ?? null;
  const rest = upcoming.filter((s) => s.id !== next?.id);

  const card = (session: LiveSessionView, joinable: boolean) => (
      <article key={session.id} className="rounded-lg border p-3">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {session.title}
          {isLiveNow(session.status, session.startsAt, session.endsAt, new Date(now)) && (
            <Badge>Live now</Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline h-3 w-3" aria-hidden />
          <time dateTime={session.startsAt}>{when(session.startsAt, session.endsAt)}</time>
          {session.subjectName && <span> · {session.subjectName}</span>}
        </p>
        {session.description && (
          <p className="mt-1 text-sm text-muted-foreground">{session.description}</p>
        )}
        {joinable && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={session.joinUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-7 items-center gap-1 rounded-md border bg-primary px-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/80"
            >
              Join session
            </a>
            <span className="text-xs text-muted-foreground">
              Opens {joinHost(session.joinUrl) ?? "your video provider"}
            </span>
          </div>
        )}
        {session.myAttendance && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your register: {attendanceStatusLabel(session.myAttendance)}
          </p>
        )}
      </article>
    );

  if (!upcoming.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your teacher hasn&apos;t scheduled any live sessions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {next && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" aria-hidden />
              {isLiveNow(next.status, next.startsAt, next.endsAt, new Date(now))
                ? "Happening now"
                : "Next session"}
            </CardTitle>
          </CardHeader>
          <CardContent>{card(next, true)}</CardContent>
        </Card>
      )}

      {rest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earlier and later</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rest.map((s) =>
              card(s, isLiveNow(s.status, s.startsAt, s.endsAt, new Date(now)) || new Date(s.startsAt).getTime() > nowMs),
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
