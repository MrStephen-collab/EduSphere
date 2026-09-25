"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Eye, FilePenLine, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createAssignmentAction,
  updateAssignmentAction,
  setAssignmentStatusAction,
  deleteAssignmentAction,
  gradeSubmissionAction,
} from "@/app/teacher/actions";
import {
  saveSubmissionAction,
  submitAssignmentAction,
  type StudentActionState,
} from "@/app/student/actions";
import type { ContentStatus } from "@/types/database";

function nativeSelectClass() {
  return "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function fieldLabelClass() {
  return "text-xs font-medium text-muted-foreground";
}

function textareaClass() {
  return "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

export type SelectOption = { id: string; name: string };

type AssignmentFormValues = {
  title: string;
  description: string;
  instructions: string;
  classId: string;
  subjectId: string;
  courseId: string;
  dueDate: string;
  maxScore: string;
  attachmentUrl: string;
  status: ContentStatus;
};

function AssignmentFields({
  values,
  onChange,
  subjects,
  classes,
  courses,
  statusSelect,
}: {
  values: AssignmentFormValues;
  onChange: (patch: Partial<AssignmentFormValues>) => void;
  subjects: SelectOption[];
  classes: SelectOption[];
  courses: SelectOption[];
  statusSelect: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="asg-title" className={fieldLabelClass()}>
          Assignment title
        </Label>
        <Input
          id="asg-title"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Quadratic Equations Practice Set"
          required
          minLength={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="asg-class" className={fieldLabelClass()}>
            Class
          </Label>
          <select
            id="asg-class"
            className={nativeSelectClass()}
            value={values.classId}
            onChange={(e) => onChange({ classId: e.target.value })}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asg-subject" className={fieldLabelClass()}>
            Subject
          </Label>
          <select
            id="asg-subject"
            className={nativeSelectClass()}
            value={values.subjectId}
            onChange={(e) => onChange({ subjectId: e.target.value })}
          >
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asg-course" className={fieldLabelClass()}>
            Course
          </Label>
          <select
            id="asg-course"
            className={nativeSelectClass()}
            value={values.courseId}
            onChange={(e) => onChange({ courseId: e.target.value })}
          >
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="asg-due" className={fieldLabelClass()}>
            Due date
          </Label>
          <Input
            id="asg-due"
            type="date"
            value={values.dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="asg-max" className={fieldLabelClass()}>
            Max score
          </Label>
          <Input
            id="asg-max"
            type="number"
            min={1}
            max={1000}
            step="any"
            value={values.maxScore}
            onChange={(e) => onChange({ maxScore: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asg-desc" className={fieldLabelClass()}>
          Description (optional)
        </Label>
        <textarea
          id="asg-desc"
          className={textareaClass()}
          rows={2}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Why this assignment matters"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asg-instructions" className={fieldLabelClass()}>
          Instructions (optional)
        </Label>
        <textarea
          id="asg-instructions"
          className={textareaClass()}
          rows={3}
          value={values.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          placeholder="Step-by-step instructions for students"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="asg-attachment" className={fieldLabelClass()}>
          Attachment link (optional)
        </Label>
        <Input
          id="asg-attachment"
          type="url"
          value={values.attachmentUrl}
          onChange={(e) => onChange({ attachmentUrl: e.target.value })}
          placeholder="https://…"
        />
      </div>

      {statusSelect && (
        <div className="grid gap-1.5">
          <Label htmlFor="asg-status" className={fieldLabelClass()}>
            Status
          </Label>
          <select
            id="asg-status"
            className={nativeSelectClass()}
            value={values.status}
            onChange={(e) => onChange({ status: e.target.value as ContentStatus })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Drafts are only visible to you. Publish when students should see it.
          </p>
        </div>
      )}
    </div>
  );
}

export function AssignmentCreateForm({
  subjects,
  classes,
  courses,
}: {
  subjects: SelectOption[];
  classes: SelectOption[];
  courses: SelectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<AssignmentFormValues>({
    title: "",
    description: "",
    instructions: "",
    classId: "",
    subjectId: "",
    courseId: "",
    dueDate: "",
    maxScore: "100",
    attachmentUrl: "",
    status: "draft",
  });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createAssignmentAction({
            title: values.title.trim(),
            description: values.description.trim() || null,
            instructions: values.instructions.trim() || null,
            classId: values.classId || null,
            subjectId: values.subjectId || null,
            courseId: values.courseId || null,
            dueDate: values.dueDate || null,
            maxScore: Number(values.maxScore),
            attachmentUrl: values.attachmentUrl.trim() || null,
            status: values.status,
          });
          if (result.ok && result.id) {
            router.push(`/teacher/assignments/${result.id}`);
            router.refresh();
          } else if (!result.ok) {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FilePenLine className="size-5 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Create a new assignment</p>
      </div>

      <AssignmentFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        subjects={subjects}
        classes={classes}
        courses={courses}
        statusSelect
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Creating…" : "Create assignment"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function AssignmentEditorForm({
  assignmentId,
  initial,
  subjects,
  classes,
  courses,
}: {
  assignmentId: string;
  initial: AssignmentFormValues;
  subjects: SelectOption[];
  classes: SelectOption[];
  courses: SelectOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<AssignmentFormValues>(initial);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await updateAssignmentAction(assignmentId, {
            title: values.title.trim(),
            description: values.description.trim() || null,
            instructions: values.instructions.trim() || null,
            classId: values.classId || null,
            subjectId: values.subjectId || null,
            courseId: values.courseId || null,
            dueDate: values.dueDate || null,
            maxScore: Number(values.maxScore),
            attachmentUrl: values.attachmentUrl.trim() || null,
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <AssignmentFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        subjects={subjects}
        classes={classes}
        courses={courses}
        statusSelect={false}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function AssignmentStatusToggle({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: ContentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const published = status === "published";

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setAssignmentStatusAction(assignmentId, published ? "draft" : "published");
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
        {published ? "Unpublish" : "Publish"}
      </Button>
    </span>
  );
}

export function AssignmentDeleteButton({ assignmentId }: { assignmentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Delete this assignment? Submissions stay in the database but the assignment is hidden.")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteAssignmentAction(assignmentId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
        Delete
      </Button>
    </span>
  );
}

export function GradeSubmissionForm({
  submissionId,
  assignmentId,
  defaultScore,
  defaultFeedback,
  maxScore,
}: {
  submissionId: string;
  assignmentId: string;
  defaultScore: number | null;
  defaultFeedback: string | null;
  maxScore: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [score, setScore] = useState(defaultScore != null ? String(defaultScore) : "");
  const [feedback, setFeedback] = useState(defaultFeedback ?? "");
  const [open, setOpen] = useState(false);

  if (!open && defaultScore == null) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Grade
      </Button>
    );
  }

  return (
    <form
      className="grid gap-3 rounded-md border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await gradeSubmissionAction(submissionId, assignmentId, {
            score: Number(score),
            feedback: feedback.trim() || null,
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`grade-${submissionId}`} className={fieldLabelClass()}>
            Score (out of {maxScore})
          </Label>
          <Input
            id={`grade-${submissionId}`}
            type="number"
            min={0}
            max={maxScore}
            step="any"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`grade-fb-${submissionId}`} className={fieldLabelClass()}>
            Feedback
          </Label>
          <textarea
            id={`grade-fb-${submissionId}`}
            className={textareaClass()}
            rows={1}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback for the student"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save grade"}
        </Button>
        {defaultScore == null && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
        {saved && <span className="text-sm text-muted-foreground">Graded.</span>}
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function SubmissionEditForm({
  assignmentId,
  initialText,
  initialAttachment,
  submitted,
}: {
  assignmentId: string;
  initialText: string | null;
  initialAttachment: string | null;
  submitted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [text, setText] = useState(initialText ?? "");
  const [attachment, setAttachment] = useState(initialAttachment ?? "");

  const busy = isPending;
  const doRun = (fn: () => Promise<StudentActionState>, okLabel: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) setMessage(okLabel);
      else setError(result.error);
    });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="sub-text" className={fieldLabelClass()}>
          Your answer
        </Label>
        <textarea
          id="sub-text"
          className={textareaClass()}
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your submission here…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sub-link" className={fieldLabelClass()}>
          Attachment link (optional)
        </Label>
        <Input
          id="sub-link"
          type="url"
          value={attachment}
          onChange={(e) => setAttachment(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!submitted && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              doRun(
                () =>
                  saveSubmissionAction(assignmentId, {
                    submissionText: text.trim() || null,
                    attachmentUrl: attachment.trim() || null,
                  }),
                "Draft saved.",
              )
            }
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CalendarDays className="size-3.5" aria-hidden="true" />}
            Save draft
          </Button>
        )}
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            doRun(
              () =>
                submitAssignmentAction(assignmentId, {
                  submissionText: text.trim() || null,
                  attachmentUrl: attachment.trim() || null,
                }),
              "Submitted!",
            )
          }
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
          {submitted ? "Update submission" : "Submit"}
        </Button>
        {!busy && message && <Badge variant="secondary">{message}</Badge>}
        <FieldError error={error} />
      </div>
    </div>
  );
}