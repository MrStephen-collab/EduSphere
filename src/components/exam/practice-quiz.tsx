"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Loader2, PenLine, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { submitPracticeAction } from "@/app/student/actions";
import type { PracticePaper, PracticeResult } from "@/services/exam";
import { difficultyLabels } from "@/lib/exam-labels";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function markClass(state: "idle" | "selected" | "correct" | "wrong") {
  switch (state) {
    case "selected":
      return "border-primary bg-primary/5";
    case "correct":
      return "border-emerald-500 bg-emerald-50 text-emerald-800";
    case "wrong":
      return "border-destructive bg-destructive/5 text-destructive";
    default:
      return "border-input hover:border-primary/50";
  }
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ResultSummary({ result, title }: { result: PracticeResult; title: string }) {
  const percentage = result.totalMarks > 0 ? Math.round((result.score / result.totalMarks) * 100) : 0;
  const timedOut = result.status === "timed_out";

  return (
    <div className="grid gap-4">
      <div
        className={`rounded-md border p-4 ${
          timedOut
            ? "border-amber-500/50 bg-amber-50"
            : "border-emerald-500/50 bg-emerald-50"
        }`}
      >
        {timedOut && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Clock className="size-4" aria-hidden="true" />
            Time expired — your answers were submitted automatically.
          </p>
        )}
        <p className={`text-sm font-semibold ${timedOut ? "text-amber-900" : "text-emerald-900"}`}>
          {title} — submitted. {result.correct} correct, {result.wrong} wrong.
          {result.pendingCount > 0 &&
            ` ${result.pendingCount} essay answer${result.pendingCount === 1 ? "" : "s"} awaiting marking.`}
        </p>
        <p className={`mt-1 text-2xl font-bold ${timedOut ? "text-amber-800" : "text-emerald-800"}`}>
          {result.score} / {result.totalMarks} ({percentage}%)
        </p>
        {result.pendingCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Your essay answers are kept for your teacher to mark — this total updates once they&apos;re marked.
          </p>
        )}
        {result.timeUsedSeconds > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Time used: {Math.floor(result.timeUsedSeconds / 60)}m {result.timeUsedSeconds % 60}s
          </p>
        )}
      </div>

      <div className="grid gap-3">
        {result.items.map((item, index) =>
          item.questionType === "essay" ? (
            <div key={item.questionId} className="rounded-md border bg-background p-3">
              <div className="flex items-start gap-2">
                {item.marksAwarded == null ? (
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                ) : (
                  <PenLine className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                )}
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">
                    {index + 1}. {item.questionText}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Essay · {item.marks} mark{item.marks === 1 ? "" : "s"}
                    {item.topic ? ` · ${item.topic}` : ""}
                  </p>
                  <div className="rounded-md border border-dashed bg-muted/40 p-2.5 text-sm">
                    {item.answerText ? (
                      item.answerText
                    ) : (
                      <span className="text-muted-foreground">Not answered.</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.marksAwarded == null ? (
                      <Badge variant="secondary">Awaiting teacher marking</Badge>
                    ) : (
                      <span className="text-emerald-700">
                        +{item.marksAwarded} / {item.marks} mark{item.marks === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
          <div
            key={item.questionId}
            className="rounded-md border bg-background p-3"
          >
            <div className="flex items-start gap-2">
              {item.isCorrect === true ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : item.isCorrect === false ? (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <span className="mt-0.5 size-4 shrink-0 rounded-full bg-muted text-center text-[10px] font-bold leading-4 text-muted-foreground">
                  !
                </span>
              )}
              <div className="grid gap-1.5">
                <p className="text-sm font-medium">
                  {index + 1}. {item.questionText}
                </p>
                <p className="text-xs text-muted-foreground">
                  {difficultyLabels[item.difficulty]} · {item.marks} mark{item.marks === 1 ? "" : "s"}
                  {item.topic ? ` · ${item.topic}` : ""}
                </p>
                <div className="grid gap-1 pt-1">
                  {item.options.map((opt, i) => {
                    const state = opt.correct
                      ? "correct"
                      : opt.selected
                        ? "wrong"
                        : "idle";
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm ${markClass(state)}`}
                      >
                        <span>
                          {LETTERS[i]}. {opt.text}
                        </span>
                        {state === "correct" && (
                          <Badge variant="secondary" className="shrink-0">
                            Correct answer
                          </Badge>
                        )}
                        {state === "wrong" && (
                          <Badge variant="destructive" className="shrink-0">
                            Your answer
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {item.explanation && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Explanation:</span> {item.explanation}
                  </p>
                )}
                <p className="text-xs font-medium text-muted-foreground">
                  {item.isCorrect === true
                    ? `+${item.marksAwarded} mark${item.marksAwarded === 1 ? "" : "s"}`
                    : item.isCorrect === false
                      ? "+0 marks"
                      : "Not attempted"}
                </p>
              </div>
            </div>
          </div>
          ),
        )}
      </div>
    </div>
  );
}

export function PracticeQuiz({
  paper,
  title,
  attemptId,
  startedAt,
  durationMinutes,
}: {
  paper: PracticePaper;
  title: string;
  attemptId: string;
  startedAt: string;
  durationMinutes: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [essays, setEssays] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PracticeResult | null>(null);

  const selectedRef = useRef(selected);
  const essaysRef = useRef(essays);
  const submittedRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    essaysRef.current = essays;
  }, [essays]);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    if (durationMinutes == null) return null;
    const total = durationMinutes * 60;
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(total - elapsed, 0);
  });

  const submitAnswers = useCallback(
    (confirm: boolean) => {
      if (submittedRef.current || isPending) return;
      if (confirm && !window.confirm("Submit your answers for marking? You can't change them afterwards.")) return;
      setError(null);
      submittedRef.current = true;
      startTransition(async () => {
        const optionAnswers = Object.entries(selectedRef.current)
          .filter(([, optionId]) => optionId)
          .map(([questionId, optionId]) => ({ questionId, optionId }));
        const essayAnswers = Object.entries(essaysRef.current)
          .filter(([, text]) => text.trim())
          .map(([questionId, text]) => ({ questionId, answerText: text.trim() }));
        const res = await submitPracticeAction(attemptId, [...optionAnswers, ...essayAnswers]);
        if (res.ok) setResult(res.result);
        else {
          submittedRef.current = false;
          setError(res.error);
        }
      });
    },
    [attemptId, isPending],
  );

  useEffect(() => {
    if (durationMinutes == null) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev == null || prev <= 0) return 0;
        if (prev === 1 && !submittedRef.current) {
          submitAnswers(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [durationMinutes, submitAnswers]);

  const answeredCount = useMemo(
    () =>
      Object.keys(selected).filter((id) => selected[id]).length +
      Object.keys(essays).filter((id) => essays[id].trim()).length,
    [selected, essays],
  );

  const groups = useMemo(() => {
    const out: { title: string | null; items: PracticePaper["questions"] }[] = [];
    for (const q of paper.questions) {
      const last = out[out.length - 1];
      if (last && last.title === q.sectionTitle) last.items.push(q);
      else out.push({ title: q.sectionTitle, items: [q] });
    }
    return out;
  }, [paper.questions]);

  if (result) {
    return <ResultSummary result={result} title={title} />;
  }

  const timerLow = durationMinutes != null && (remainingSeconds ?? 1) <= 60;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {paper.questions.length} answered
        </p>
        {durationMinutes != null && remainingSeconds != null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-semibold ${
              timerLow ? "border-destructive/40 text-destructive" : "border-input"
            }`}
          >
            <Clock className="size-4" aria-hidden="true" />
            {formatClock(remainingSeconds)}
          </span>
        )}
        <Button
          type="button"
          disabled={isPending}
          onClick={() => submitAnswers(true)}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Marking…" : durationMinutes ? "Finish & submit" : "Submit answers"}
        </Button>
      </div>

      {paper.sections.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {paper.sections.length} section{paper.sections.length === 1 ? "" : "s"}
          {durationMinutes ? ` · ${durationMinutes} minutes · auto-submits when time runs out` : " · untimed"}
          {paper.shuffleQuestions ? " · question order is shuffled" : ""}
        </p>
      )}

      {!isPending && (
        <p className="text-xs text-muted-foreground">
          You can submit at any time — unanswered questions are marked incorrect.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.title ?? "__general__"} className="grid gap-3">
          {group.title && (
            <h3 className="text-sm font-semibold text-primary">{group.title}</h3>
          )}
          {group.items.map((question, index) => (
            <div key={question.id} className="rounded-md border bg-background p-3">
              <p className="text-sm font-medium">
                {index + 1}. {question.questionText}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {question.questionType === "essay" ? "Essay / full answer" : difficultyLabels[question.difficulty]} · {question.marks} mark{question.marks === 1 ? "" : "s"}
                {question.topic ? ` · ${question.topic}` : ""}
              </p>
              {question.questionType === "essay" ? (
                <textarea
                  value={essays[question.id] ?? ""}
                  onChange={(e) => setEssays((s) => ({ ...s, [question.id]: e.target.value }))}
                  rows={5}
                  placeholder="Write your full working / answer here…"
                  className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : (
                <div className="mt-2 grid gap-1.5">
                  {question.options.map((opt, i) => {
                    const isSelected = selected[question.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${markClass(isSelected ? "selected" : "idle")}`}
                        onClick={() => setSelected((s) => ({ ...s, [question.id]: opt.id }))}
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent"
                          }`}
                        >
                          {LETTERS[i]}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        <Link href={`/student/exam-series/${paper.seriesId}`} className="underline">
          Cancel and go back to the series
        </Link>{" "}
        — your answers aren&apos;t saved until you submit.
      </p>
    </div>
  );
}