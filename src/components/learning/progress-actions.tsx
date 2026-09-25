"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeLessonAction } from "@/app/student/actions";

export function MarkCompleteButton({
  courseId,
  lessonId,
  completed,
}: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button
        type="button"
        variant={completed ? "outline" : "default"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await completeLessonAction({
              courseId,
              lessonId,
              completed: !completed,
            });
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? (
          <span className="animate-pulse">Updating…</span>
        ) : completed ? (
          <>
            <RotateCcw className="mr-1 size-4" aria-hidden="true" />
            Mark as incomplete
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-1 size-4" aria-hidden="true" />
            Mark lesson complete
          </>
        )}
      </Button>
    </span>
  );
}