"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createSessionAction,
  setCurrentSessionAction,
  setCurrentTermAction,
  type ActionState,
} from "@/app/school/actions";

type Term = { id: string; name: string; is_current: boolean };
type Session = {
  id: string;
  name: string;
  is_current: boolean;
  terms: Term[];
};

export function SessionsManager({ sessions }: { sessions: Session[] }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Create session</p>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await createSessionAction({
                name: name.trim(),
                startDate: startDate || null,
                endDate: endDate || null,
              });
              if (result.ok) {
                setName("");
                setStartDate("");
                setEndDate("");
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="session-name">Session</Label>
            <Input
              id="session-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026/2027"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="session-start">Starts</Label>
            <Input id="session-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="session-end">Ends</Label>
            <Input id="session-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button type="submit" disabled={isPending} className="sm:col-span-3 sm:w-fit">
            <Plus className="mr-1 size-4" aria-hidden="true" />
            {isPending ? "Creating…" : "Create session"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No sessions yet. Create one above — three terms are added automatically.
        </p>
      )}

      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const runAction = (action: () => Promise<ActionState>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">{session.name}</p>
          {session.is_current && <Badge>Current</Badge>}
        </div>
        {!session.is_current && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => runAction(() => setCurrentSessionAction(session.id))}
          >
            Make current
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
        {session.terms.map((term) => (
          <li
            key={term.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
              term.is_current ? "border-primary/50 bg-primary/5" : ""
            }`}
          >
            <span className="font-medium">{term.name}</span>
            {term.is_current ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                disabled={isPending}
                onClick={() => runAction(() => setCurrentTermAction(term.id))}
              >
                Activate
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}