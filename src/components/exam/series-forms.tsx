"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  FilePenLine,
  Loader2,
  PlusCircle,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createExamSeriesAction,
  updateExamSeriesAction,
  setExamSeriesStatusAction,
  deleteExamSeriesAction,
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
} from "@/app/teacher/actions";
import { difficultyLabels, examTypeLabels, questionTypeLabels, type SelectOption } from "@/lib/exam-labels";
import type {
  ContentStatus,
  ExamSeriesType,
  Question,
  QuestionDifficulty,
  QuestionOption,
  QuestionType,
} from "@/types/database";

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

export const EXAM_SERIES_TYPES = ["common_entrance", "waec", "neco", "jamb", "school"] as const;

type SeriesFormValues = {
  title: string;
  examType: ExamSeriesType;
  year: string;
  description: string;
  subjectId: string;
  classId: string;
  status: ContentStatus;
  durationMinutes: string;
  shuffleQuestions: boolean;
};

function SeriesFields({
  values,
  onChange,
  subjects,
  classes,
  statusSelect,
}: {
  values: SeriesFormValues;
  onChange: (patch: Partial<SeriesFormValues>) => void;
  subjects: SelectOption[];
  classes: SelectOption[];
  statusSelect: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="series-title" className={fieldLabelClass()}>
            Series title
          </Label>
          <Input
            id="series-title"
            value={values.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. WAEC Mathematics 2019–2024"
            required
            minLength={2}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="series-type" className={fieldLabelClass()}>
            Exam type
          </Label>
          <select
            id="series-type"
            className={nativeSelectClass()}
            value={values.examType}
            onChange={(e) => onChange({ examType: e.target.value as ExamSeriesType })}
          >
            {EXAM_SERIES_TYPES.map((t) => (
              <option key={t} value={t}>
                {examTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="series-year" className={fieldLabelClass()}>
            Year / editions (optional)
          </Label>
          <Input
            id="series-year"
            value={values.year}
            onChange={(e) => onChange({ year: e.target.value })}
            placeholder="e.g. 2019–2024"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="series-class" className={fieldLabelClass()}>
            Class
          </Label>
          <select
            id="series-class"
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
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="series-subject" className={fieldLabelClass()}>
          Subject
        </Label>
        <select
          id="series-subject"
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="series-duration" className={fieldLabelClass()}>
            Duration (minutes, optional)
          </Label>
          <Input
            id="series-duration"
            type="number"
            min={1}
            max={600}
            value={values.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: e.target.value })}
            placeholder="e.g. 30"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for unlimited practice. A timer starts when a student begins and auto-submits when time runs out.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabelClass()}>Question order</Label>
          <label
            htmlFor="series-shuffle"
            className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm ${values.shuffleQuestions ? "border-primary/50" : ""}`}
          >
            <input
              id="series-shuffle"
              type="checkbox"
              checked={values.shuffleQuestions}
              onChange={(e) => onChange({ shuffleQuestions: e.target.checked })}
              className="size-4 accent-primary"
            />
            Shuffle questions per attempt
          </label>
          <p className="text-xs text-muted-foreground">
            Each student sees the questions in a different order on every run.
          </p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="series-desc" className={fieldLabelClass()}>
          Description (optional)
        </Label>
        <textarea
          id="series-desc"
          className={textareaClass()}
          rows={2}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this past question series covers"
        />
      </div>
      {statusSelect && (
        <div className="grid gap-1.5">
          <Label htmlFor="series-status" className={fieldLabelClass()}>
            Status
          </Label>
          <select
            id="series-status"
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

export function SeriesCreateForm({
  subjects,
  classes,
}: {
  subjects: SelectOption[];
  classes: SelectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<SeriesFormValues>({
    title: "",
    examType: "school",
    year: "",
    description: "",
    subjectId: "",
    classId: "",
    status: "draft",
    durationMinutes: "",
    shuffleQuestions: false,
  });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createExamSeriesAction({
            title: values.title.trim(),
            examType: values.examType,
            year: values.year.trim() || null,
            description: values.description.trim() || null,
            subjectId: values.subjectId || null,
            classId: values.classId || null,
            status: values.status,
            durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
            shuffleQuestions: values.shuffleQuestions,
          });
          if (result.ok && result.id) {
            router.push(`/teacher/exam-series/${result.id}`);
            router.refresh();
          } else if (!result.ok) {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FilePenLine className="size-5 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Create a new exam series</p>
      </div>

      <SeriesFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        subjects={subjects}
        classes={classes}
        statusSelect
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Creating…" : "Create series"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function SeriesEditorForm({
  seriesId,
  initial,
  subjects,
  classes,
}: {
  seriesId: string;
  initial: SeriesFormValues;
  subjects: SelectOption[];
  classes: SelectOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<SeriesFormValues>(initial);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await updateExamSeriesAction(seriesId, {
            title: values.title.trim(),
            examType: values.examType,
            year: values.year.trim() || null,
            description: values.description.trim() || null,
            subjectId: values.subjectId || null,
            classId: values.classId || null,
            durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
            shuffleQuestions: values.shuffleQuestions,
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <SeriesFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        subjects={subjects}
        classes={classes}
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

export function SeriesStatusToggle({
  seriesId,
  status,
}: {
  seriesId: string;
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
            const result = await setExamSeriesStatusAction(seriesId, published ? "draft" : "published");
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

export function SeriesDeleteButton({ seriesId }: { seriesId: string }) {
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
          if (!window.confirm("Delete this exam series and all of its questions? Students keep past results but the series is hidden.")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteExamSeriesAction(seriesId);
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

// ---------------------------------------------------------------------------
// Question authoring
// ---------------------------------------------------------------------------

type DraftOption = { text: string; isCorrect: boolean };

type QuestionFormValues = {
  questionText: string;
  questionType: Exclude<QuestionType, "true_false" | "multiple_answer">;
  answerGuide: string;
  topic: string;
  difficulty: QuestionDifficulty;
  marks: string;
  explanation: string;
  sectionId: string;
  options: DraftOption[];
};

function emptyQuestion(): QuestionFormValues {
  return {
    questionText: "",
    questionType: "multiple_choice",
    answerGuide: "",
    topic: "",
    difficulty: "medium",
    marks: "1",
    explanation: "",
    sectionId: "",
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

function OptionRows({
  options,
  onChange,
  prefix,
}: {
  options: DraftOption[];
  onChange: (next: DraftOption[]) => void;
  prefix: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className={fieldLabelClass()}>Options (mark the correct one)</Label>
      {options.map((opt, index) => (
        <div key={index} className="flex items-center gap-2">
          <button
            type="button"
            title="Mark as correct answer"
            aria-label={`Option ${index + 1} correct`}
            className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
              opt.isCorrect
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-input text-transparent hover:border-emerald-400"
            }`}
            onClick={() =>
              onChange(
                options.map((o, i) => ({ ...o, isCorrect: i === index })),
              )
            }
          >
            <Check className="size-3" aria-hidden="true" />
          </button>
          <Input
            value={opt.text}
            onChange={(e) =>
              onChange(options.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))
            }
            placeholder={`Option ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            disabled={options.length <= 2}
            title={`Remove option ${index + 1}`}
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={options.length >= 6}
          onClick={() => onChange([...options, { text: "", isCorrect: false }])}
        >
          <PlusCircle className="size-3.5" aria-hidden="true" />
          Add option
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {prefix} At least two options; one must be marked correct.
      </p>
    </div>
  );
}

export function QuestionCreateForm({
  seriesId,
  sections,
}: {
  seriesId: string;
  sections: SelectOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<QuestionFormValues>(emptyQuestion);

  const canAdd =
    values.questionText.trim().length >= 3 &&
    (values.questionType === "essay"
      ? true
      : values.options.length >= 2 &&
        values.options.some((o) => o.isCorrect) &&
        values.options.every((o) => o.text.trim()));

  const isEssay = values.questionType === "essay";

  return (
    <form
      className="grid gap-3 rounded-md border border-dashed bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addQuestionAction(seriesId, {
            questionText: values.questionText.trim(),
            questionType: values.questionType,
            answerGuide: isEssay ? values.answerGuide.trim() || null : null,
            topic: values.topic.trim() || null,
            difficulty: values.difficulty as "easy" | "medium" | "hard",
            marks: Number(values.marks),
            explanation: values.explanation.trim() || null,
            sectionId: values.sectionId || null,
            options: isEssay
              ? []
              : values.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
          });
          if (result.ok) {
            setValues(emptyQuestion());
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <p className="text-sm font-semibold">Add a question</p>

      <div className="grid gap-1.5">
        <Label htmlFor={`qtext-new`} className={fieldLabelClass()}>
          Question
        </Label>
        <textarea
          id="qtext-new"
          className={textareaClass()}
          rows={2}
          value={values.questionText}
          onChange={(e) => setValues((v) => ({ ...v, questionText: e.target.value }))}
          placeholder="Type the question here…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`qtype-new`} className={fieldLabelClass()}>
            Question type
          </Label>
          <select
            id="qtype-new"
            className={nativeSelectClass()}
            value={values.questionType}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                questionType: e.target.value as "multiple_choice" | "essay",
              }))
            }
          >
            <option value="multiple_choice">Objective (auto-marked)</option>
            <option value="essay">Essay / full answer (teacher marks)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`qsection-new`} className={fieldLabelClass()}>
            Section (optional)
          </Label>
          <select
            id="qsection-new"
            className={nativeSelectClass()}
            value={values.sectionId}
            onChange={(e) => setValues((v) => ({ ...v, sectionId: e.target.value }))}
          >
            <option value="">General (no section)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="q-topic" className={fieldLabelClass()}>
            Topic (optional)
          </Label>
          <Input
            id="q-topic"
            value={values.topic}
            onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
            placeholder="e.g. Algebra"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="q-diff" className={fieldLabelClass()}>
            Difficulty
          </Label>
          <select
            id="q-diff"
            className={nativeSelectClass()}
            value={values.difficulty}
            onChange={(e) => setValues((v) => ({ ...v, difficulty: e.target.value as QuestionDifficulty }))}
          >
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>
                {difficultyLabels[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="q-marks" className={fieldLabelClass()}>
            Marks
          </Label>
          <Input
            id="q-marks"
            type="number"
            min={1}
            max={1000}
            step="any"
            value={values.marks}
            onChange={(e) => setValues((v) => ({ ...v, marks: e.target.value }))}
          />
        </div>
      </div>

      <OptionRows options={values.options} onChange={(o) => setValues((v) => ({ ...v, options: o }))} prefix="" />

      {isEssay && (
        <div className="grid gap-1.5">
          <Label htmlFor="q-qguide-new" className={fieldLabelClass()}>
            Answer guide / marking scheme (only visible to teachers)
          </Label>
          <textarea
            id="q-qguide-new"
            className={textareaClass()}
            rows={3}
            value={values.answerGuide}
            onChange={(e) => setValues((v) => ({ ...v, answerGuide: e.target.value }))}
            placeholder="Model answer, key points or rubric to award marks against when marking students' answers"
          />
          <p className="text-xs text-muted-foreground">
            Students write full answers that are kept for manual marking. Objective questions are auto-marked on submission.
          </p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="q-expl" className={fieldLabelClass()}>
          Explanation (optional, shown after answering)
        </Label>
        <textarea
          id="q-expl"
          className={textareaClass()}
          rows={2}
          value={values.explanation}
          onChange={(e) => setValues((v) => ({ ...v, explanation: e.target.value }))}
          placeholder="Explain why this answer is correct"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending || !canAdd}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <PlusCircle className="size-3.5" aria-hidden="true" />}
          {isPending ? "Saving…" : "Add question"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function QuestionRow({
  question,
  seriesId,
  sections,
}: {
  question: Question & { options: QuestionOption[] };
  seriesId: string;
  sections: SelectOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<QuestionFormValues>({
    questionText: question.question_text,
    questionType:
      question.question_type === "essay" ? "essay" : "multiple_choice",
    answerGuide: question.answer_guide ?? "",
    topic: question.topic ?? "",
    difficulty: question.difficulty,
    marks: String(question.marks),
    explanation: question.explanation ?? "",
    sectionId: question.section_id ?? "",
    options: question.options
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ text: o.option_text, isCorrect: o.is_correct })),
  });

  const isEssay = values.questionType === "essay";
  const questionIsEssay = question.question_type === "essay";

  const sectionLabel = question.section_id
    ? sections.find((s) => s.id === question.section_id)?.name ?? question.section_id
    : null;

  if (!editing) {
    return (
      <div className="rounded-md border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <p className="text-sm font-medium">{question.question_text}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5 font-medium text-foreground">
                {questionTypeLabels[question.question_type]}
              </span>
              <span>{difficultyLabels[question.difficulty]}</span>
              <span>·</span>
              <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
              {question.topic && (
                <>
                  <span>·</span>
                  <span>{question.topic}</span>
                </>
              )}
              {!questionIsEssay && (
                <>
                  <span>·</span>
                  <span>{question.options.length} option{question.options.length === 1 ? "" : "s"}</span>
                </>
              )}
              {sectionLabel && (
                <>
                  <span>·</span>
                  <span className="font-medium text-primary">{sectionLabel}</span>
                </>
              )}
            </div>
            {questionIsEssay ? (
              <div className="mt-1.5 grid gap-1">
                {question.answer_guide && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Guide:</span> {question.answer_guide}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Students write full answers — this question is marked manually.
                </p>
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {question.options
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((o, i) => (
                    <span
                      key={o.id}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        o.is_correct ? "border-emerald-500 text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {o.option_text}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <FilePenLine className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
            <QuestionDeleteButton questionId={question.id} seriesId={seriesId} />
          </div>
        </div>
      </div>
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
          const result = await updateQuestionAction(question.id, seriesId, {
            questionText: values.questionText.trim(),
            questionType: values.questionType,
            answerGuide: isEssay ? values.answerGuide.trim() || null : null,
            topic: values.topic.trim() || null,
            difficulty: values.difficulty as "easy" | "medium" | "hard",
            marks: Number(values.marks),
            explanation: values.explanation.trim() || null,
            sectionId: values.sectionId || null,
            options: isEssay
              ? []
              : values.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`qtext-${question.id}`} className={fieldLabelClass()}>
          Question
        </Label>
        <textarea
          id={`qtext-${question.id}`}
          className={textareaClass()}
          rows={2}
          value={values.questionText}
          onChange={(e) => setValues((v) => ({ ...v, questionText: e.target.value }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`qtype-${question.id}`} className={fieldLabelClass()}>
            Question type
          </Label>
          <select
            id={`qtype-${question.id}`}
            className={nativeSelectClass()}
            value={values.questionType}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                questionType: e.target.value as "multiple_choice" | "essay",
              }))
            }
          >
            <option value="multiple_choice">Objective (auto-marked)</option>
            <option value="essay">Essay / full answer (teacher marks)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`qsection-${question.id}`} className={fieldLabelClass()}>
            Section (optional)
          </Label>
          <select
            id={`qsection-${question.id}`}
            className={nativeSelectClass()}
            value={values.sectionId}
            onChange={(e) => setValues((v) => ({ ...v, sectionId: e.target.value }))}
          >
            <option value="">General (no section)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`qtopic-${question.id}`} className={fieldLabelClass()}>
            Topic (optional)
          </Label>
          <Input
            id={`qtopic-${question.id}`}
            value={values.topic}
            onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`qdiff-${question.id}`} className={fieldLabelClass()}>
            Difficulty
          </Label>
          <select
            id={`qdiff-${question.id}`}
            className={nativeSelectClass()}
            value={values.difficulty}
            onChange={(e) => setValues((v) => ({ ...v, difficulty: e.target.value as QuestionDifficulty }))}
          >
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>
                {difficultyLabels[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`qmarks-${question.id}`} className={fieldLabelClass()}>
            Marks
          </Label>
          <Input
            id={`qmarks-${question.id}`}
            type="number"
            min={1}
            max={1000}
            step="any"
            value={values.marks}
            onChange={(e) => setValues((v) => ({ ...v, marks: e.target.value }))}
          />
        </div>
      </div>

      <OptionRows options={values.options} onChange={(o) => setValues((v) => ({ ...v, options: o }))} prefix="" />

      {isEssay && (
        <div className="grid gap-1.5">
          <Label htmlFor={`q-qguide-${question.id}`} className={fieldLabelClass()}>
            Answer guide / marking scheme (only visible to teachers)
          </Label>
          <textarea
            id={`q-qguide-${question.id}`}
            className={textareaClass()}
            rows={3}
            value={values.answerGuide}
            onChange={(e) => setValues((v) => ({ ...v, answerGuide: e.target.value }))}
            placeholder="Model answer, key points or rubric to award marks against"
          />
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor={`qexpl-${question.id}`} className={fieldLabelClass()}>
          Explanation (optional, shown after answering)
        </Label>
        <textarea
          id={`qexpl-${question.id}`}
          className={textareaClass()}
          rows={2}
          value={values.explanation}
          onChange={(e) => setValues((v) => ({ ...v, explanation: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function QuestionDeleteButton({
  questionId,
  seriesId,
}: {
  questionId: string;
  seriesId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Delete this question?")) return;
        setError(null);
        startTransition(async () => {
          const result = await deleteQuestionAction(questionId, seriesId);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      {error && <span className="ml-1 text-xs text-destructive">{error}</span>}
    </Button>
  );
}