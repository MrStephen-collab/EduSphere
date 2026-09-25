"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Loader2, Save, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveEssayMarksAction } from "@/app/teacher/actions";
import type { AttemptForMarking } from "@/services/exam";

export function MarkingForm({ attempt }: { attempt: AttemptForMarking }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const a of attempt.essayAnswers) {
      initial[a.answerId] = a.marksAwarded != null ? String(a.marksAwarded) : "";
    }
    return initial;
  });

  const pending = attempt.essayAnswers.filter((a) => a.marksAwarded == null);
  const entries = attempt.essayAnswers
    .filter((a) => marks[a.answerId] !== "" && marks[a.answerId] != null)
    .map((a) => ({ answerId: a.answerId, marksAwarded: Number(marks[a.answerId]) }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div className="grid">
          <p className="font-semibold">{attempt.studentName}</p>
          <p className="text-xs text-muted-foreground">
            {attempt.admissionNumber}
            {attempt.className ? ` · ${attempt.className}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {attempt.submittedAt && (
            <span>
              Submitted{" "}
              {new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {attempt.autoScore != null && attempt.autoTotal != null && (
            <Badge variant="outline">
              Objective score so far: {attempt.autoScore} / {attempt.autoTotal}
            </Badge>
          )}
          {pending.length > 0 && <Badge variant="secondary">{pending.length} pending</Badge>}
        </div>
      </div>

      <div className="grid gap-3">
        {attempt.essayAnswers.map((answer) => {
          const input = marks[answer.answerId] ?? "";
          const isMarked = answer.marksAwarded != null;
          return (
            <div key={answer.answerId} className="rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">{answer.questionText}</p>
                <Badge variant={isMarked ? "default" : "secondary"}>
                  {isMarked ? `${answer.marksAwarded}/${answer.marks} marked` : `${answer.marks} marks`}
                </Badge>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Answer guide
                  </p>
                  <p className="min-h-20 rounded-md border border-dashed bg-muted/40 p-2.5 text-sm text-muted-foreground">
                    {answer.answerGuide || "No guide provided."}
                  </p>
                </div>
                <div>
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <BookOpenText className="size-3.5" aria-hidden="true" />
                    Student answer
                  </p>
                  <div className="min-h-20 rounded-md border border-input bg-background p-2.5 text-sm">
                    {answer.answerText ? (
                      answer.answerText
                    ) : (
                      <span className="text-muted-foreground">Not answered.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Marks awarded
                  <input
                    type="number"
                    min={0}
                    max={answer.marks}
                    step="any"
                    value={input}
                    onChange={(e) => {
                      setSaved(false);
                      setMarks((m) => ({ ...m, [answer.answerId]: e.target.value }));
                    }}
                    placeholder="—"
                    className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Label>
                {input !== "" && Number(input) > answer.marks && (
                  <p className="pb-2 text-xs text-destructive">
                    Max {answer.marks} marks for this question.
                  </p>
                )}
                {isMarked && answer.markedAt && (
                  <p className="pb-2 text-xs text-muted-foreground">
                    Marked {new Date(answer.markedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {attempt.essayAnswers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This attempt has no essay questions to mark.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending || entries.length === 0}
          onClick={() => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const result = await saveEssayMarksAction(
                attempt.seriesId,
                attempt.attemptId,
                entries,
              );
              if (result.ok) {
                setSaved(true);
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {isPending ? "Saving…" : `Save ${entries.length > 0 ? `${entries.length} mark${entries.length === 1 ? "" : "s"}` : "marks"}`}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {pending.length > 0 && (
        <p className="text-xs text-muted-foreground">
          The student&apos;s total updates as soon as you save — marked essay marks are added to the
          auto-marked objective score.
        </p>
      )}
    </div>
  );
}