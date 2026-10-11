"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  addAdmissionNoteAction,
  deleteAdmissionApplicationAction,
  recordAdmissionScoreAction,
  setAdmissionStatusAction,
} from "@/app/school/actions";
import {
  ADMISSION_STATUSES,
  admissionStatusLabel,
} from "@/lib/admission-labels";
import { canIssueAdmissionLetter, nextAdmissionStatus } from "@/lib/admission";
import type { AdmissionApplication, AdmissionEvent, AdmissionStatus } from "@/types/database";

const statusClasses: Record<AdmissionStatus, string> = {
  submitted: "bg-amber-50 text-amber-800 border-amber-500/40",
  under_review: "bg-sky-50 text-sky-800 border-sky-500/40",
  entrance: "bg-indigo-50 text-indigo-800 border-indigo-500/40",
  offered: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
  enrolled: "bg-emerald-50 text-emerald-800 border-emerald-500/40",
  rejected: "bg-rose-50 text-rose-800 border-rose-500/40",
  withdrawn: "bg-muted text-muted-foreground border-muted-foreground/30",
};

function nativeSelectClass() {
  return "h-8 w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function detailLine(label: string, value: string | null) {
  if (!value) return null;
  return (
    <span>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </span>
  );
}

export function AdmissionsInbox({
  applications,
  events,
}: {
  applications: AdmissionApplication[];
  events: Record<string, AdmissionEvent[]>;
}) {
  if (applications.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No applications yet. Anything submitted through the school&apos;s public
        admissions page lands here.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {applications.map((application) => (
        <ApplicationRow
          key={application.id}
          application={application}
          events={events[application.id] ?? []}
        />
      ))}
    </div>
  );
}

function ApplicationRow({
  application,
  events,
}: {
  application: AdmissionApplication;
  events: AdmissionEvent[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AdmissionStatus>(application.status);
  const [score, setScore] = useState(
    application.entrance_score === null ? "" : String(application.entrance_score),
  );
  const [scoreDate, setScoreDate] = useState(application.entrance_date ?? "");
  const [note, setNote] = useState("");

  const next = nextAdmissionStatus(application.status);
  const fullName = `${application.applicant_first_name} ${application.applicant_last_name}`;

  function changeStatus(value: AdmissionStatus) {
    setStatus(value);
    setError(null);
    startTransition(async () => {
      const result = await setAdmissionStatusAction({ applicationId: application.id, status: value });
      if (!result.ok) {
        setStatus(application.status);
        setError(result.error);
      }
    });
  }

  function moveForward() {
    if (next) changeStatus(next);
  }

  function saveScore(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = Number(score);
    startTransition(async () => {
      const result = await recordAdmissionScoreAction({
        applicationId: application.id,
        score: parsed,
        date: scoreDate === "" ? null : scoreDate,
      });
      if (!result.ok) setError(result.error);
    });
  }

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addAdmissionNoteAction({ applicationId: application.id, body: note });
      if (result.ok) setNote("");
      else setError(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Delete ${fullName}'s application? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAdmissionApplicationAction(application.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {fullName}
            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
              {application.application_number}
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {detailLine("For", application.class_name || null)}
            <span>
              Applied <RelativeTime iso={application.created_at} />
            </span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${statusClasses[application.status]}`}
        >
          {admissionStatusLabel(application.status)}
        </span>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="flex flex-wrap gap-x-3">
          {detailLine("Guardian", application.guardian_name)}
          {application.guardian_phone && (
            <a href={`tel:${application.guardian_phone}`} className="underline">
              {application.guardian_phone}
            </a>
          )}
        </p>
        <p>
          <a href={`mailto:${application.guardian_email}`} className="underline">
            {application.guardian_email}
          </a>
        </p>
        {application.date_of_birth && <p>{detailLine("Born", application.date_of_birth)}</p>}
        {application.gender && <p>{detailLine("Gender", application.gender)}</p>}
        {application.previous_school && (
          <p className="sm:col-span-2">{detailLine("Previous school", application.previous_school)}</p>
        )}
        {application.entrance_score !== null && (
          <p className="sm:col-span-2">
            {detailLine(
              "Entrance score",
              `${application.entrance_score}%${application.entrance_date ? ` on ${application.entrance_date}` : ""}`,
            )}
          </p>
        )}
      </div>

      {application.notes && (
        <p className="rounded-md border border-dashed p-2.5 text-sm">{application.notes}</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`status-${application.id}`}>
            Status
          </label>
          <select
            id={`status-${application.id}`}
            value={status}
            disabled={isPending}
            onChange={(e) => changeStatus(e.target.value as AdmissionStatus)}
            className={nativeSelectClass()}
          >
            {ADMISSION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {admissionStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {next && !isPending && (
          <Button type="button" variant="outline" onClick={moveForward}>
            <ArrowRight className="size-4" aria-hidden="true" />
            Move to {admissionStatusLabel(next)}
          </Button>
        )}

        <form onSubmit={saveScore} className="flex items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`score-${application.id}`}>
              Entrance score (%)
            </label>
            <Input
              id={`score-${application.id}`}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={score}
              disabled={isPending}
              onChange={(e) => setScore(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`score-date-${application.id}`}>
              Date
            </label>
            <Input
              id={`score-date-${application.id}`}
              type="date"
              value={scoreDate}
              disabled={isPending}
              onChange={(e) => setScoreDate(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isPending || score === ""}>
            Save score
          </Button>
        </form>

        {canIssueAdmissionLetter(application.status) && (
          <Button
            variant="outline"
            render={<Link href={`/school/admissions/${application.id}/letter`} />}
          >
            <FileText className="size-4" aria-hidden="true" />
            Offer letter
          </Button>
        )}
      </div>

      <form onSubmit={addNote} className="flex items-end gap-2">
        <div className="grid flex-1 gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`note-${application.id}`}>
            Add a note to the file
          </label>
          <Input
            id={`note-${application.id}`}
            value={note}
            maxLength={2000}
            placeholder="e.g. Guardian called to confirm documents."
            disabled={isPending}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending || note.trim() === ""}>
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          Add note
        </Button>
      </form>

      {events.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Activity ({events.length})
          </summary>
          <ol className="mt-2 grid gap-1.5">
            {events.map((event) => (
              <li key={event.id} className="rounded-md border p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {event.author_name}
                    <span className="ml-1 font-normal text-muted-foreground">({event.kind})</span>
                  </span>
                  <RelativeTime iso={event.created_at} />
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{event.body}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-2 border-t pt-2">
        {isPending ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Saving…
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Changes save immediately
          </span>
        )}
        <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={remove}>
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  );
}
