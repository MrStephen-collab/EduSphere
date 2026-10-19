"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubjectLessonAction } from "@/app/teacher/actions";

export type LessonOption = { id: string; name: string };

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function textareaClass() {
  return "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

/**
 * The nursery, primary and secondary lesson flow: pick a subject and a class,
 * give the lesson a title, and it is published straight away. The course
 * behind it ("Mathematics · JSS 1") is created on first use by the service —
 * the teacher never sees a course editor. Higher-education lecturers keep the
 * full Courses menus and can still use this form for a quick lesson.
 */
export function LessonQuickAdd({
  subjects,
  classes,
}: {
  subjects: LessonOption[];
  classes: LessonOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    subjectId: "",
    classId: "",
    title: "",
    content: "",
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="mr-1 size-4" aria-hidden="true" />
        Add a lesson
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-md border border-dashed bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createSubjectLessonAction({
            subjectId: values.subjectId,
            classId: values.classId,
            title: values.title.trim(),
            content: values.content.trim() || null,
          });
          if (result.ok) {
            setValues({ subjectId: "", classId: "", title: "", content: "" });
            setOpen(false);
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add a lesson</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          aria-label="Close form"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="lesson-subject">Subject</Label>
          <select
            id="lesson-subject"
            className={nativeSelectClass()}
            value={values.subjectId}
            onChange={(e) => setValues((v) => ({ ...v, subjectId: e.target.value }))}
            required
          >
            <option value="">Choose a subject…</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lesson-class">Class</Label>
          <select
            id="lesson-class"
            className={nativeSelectClass()}
            value={values.classId}
            onChange={(e) => setValues((v) => ({ ...v, classId: e.target.value }))}
            required
          >
            <option value="">Choose a class…</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lesson-title">Lesson title</Label>
        <Input
          id="lesson-title"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="e.g. Solving quadratic equations"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lesson-content">Notes for the lesson (optional)</Label>
        <textarea
          id="lesson-content"
          className={textareaClass()}
          rows={4}
          value={values.content}
          onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
          placeholder="What the lesson covers, steps, examples…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Publish lesson"}
        </Button>
      </div>
    </form>
  );
}
