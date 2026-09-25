"use client";

import { useState, useTransition } from "react";
import { Library, Plus, PlusCircle, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createQuestionBankAction,
  deleteQuestionBankAction,
  addBankQuestionAction,
  deleteBankQuestionAction,
  type ActionState,
} from "@/app/teacher/actions";
import { difficultyLabels, questionTypeLabels } from "@/lib/exam-labels";

export type OptionDef = { id: string; name: string };
export type BankQuestionView = {
  id: string;
  questionText: string;
  questionType: string;
  topic: string | null;
  difficulty: string;
  marks: number;
  explanation: string | null;
  options: { id: string; optionText: string; isCorrect: boolean }[];
};

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function textareaClass() {
  return "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function CreateQuestionBankForm({
  subjects,
  classes,
}: {
  subjects: OptionDef[];
  classes: OptionDef[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    name: "",
    description: "",
    subjectId: "",
    classId: "",
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="mr-1 size-4" aria-hidden="true" />
        New question bank
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
          const result = await createQuestionBankAction({
            name: values.name.trim(),
            description: values.description.trim() || null,
            subjectId: values.subjectId || null,
            classId: values.classId || null,
          });
          if (result.ok) {
            setValues({ name: "", description: "", subjectId: "", classId: "" });
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">New question bank</p>
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

      <div className="grid gap-1.5">
        <Label htmlFor="qb-name">Name</Label>
        <Input
          id="qb-name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="e.g. JSS3 Math — Mock 1"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="qb-desc">Description (optional)</Label>
        <textarea
          id="qb-desc"
          className={textareaClass()}
          rows={2}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder="What is this bank for?"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="qb-subject">Subject (optional)</Label>
          <select
            id="qb-subject"
            className={nativeSelectClass()}
            value={values.subjectId}
            onChange={(e) => setValues((v) => ({ ...v, subjectId: e.target.value }))}
          >
            <option value="">Any subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="qb-class">Class (optional)</Label>
          <select
            id="qb-class"
            className={nativeSelectClass()}
            value={values.classId}
            onChange={(e) => setValues((v) => ({ ...v, classId: e.target.value }))}
          >
            <option value="">Any class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Library className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Creating…" : "Create bank"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function BankDeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <BankActionButton
      label="Delete bank"
      confirm={`Delete "${name}"? All questions inside it will be removed.`}
      run={() => deleteQuestionBankAction(id)}
    />
  );
}

export function BankQuestionDeleteButton({
  id,
  bankId,
}: {
  id: string;
  bankId: string;
}) {
  return (
    <BankActionButton
      label="Delete question"
      confirm="Delete this question? This cannot be undone."
      run={() => deleteBankQuestionAction(id, bankId)}
    />
  );
}

function BankActionButton({
  label,
  confirm,
  run,
}: {
  label: string;
  confirm: string;
  run: () => Promise<ActionState>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1.5">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => {
          if (typeof window !== "undefined" && !window.confirm(confirm)) return;
          setError(null);
          startTransition(async () => {
            const result = await run();
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Button>
    </span>
  );
}

type QuestionFormValues = {
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "multiple_answer" | "essay";
  answerGuide: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  marks: string;
  explanation: string;
  options: { text: string; isCorrect: boolean }[];
};

function emptyOptions(type: QuestionFormValues["questionType"]) {
  if (type === "essay") return [];
  if (type === "true_false") {
    return [
      { text: "True", isCorrect: false },
      { text: "False", isCorrect: false },
    ];
  }
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

const emptyQuestion: QuestionFormValues = {
  questionText: "",
  questionType: "multiple_choice",
  answerGuide: "",
  topic: "",
  difficulty: "medium",
  marks: "1",
  explanation: "",
  options: emptyOptions("multiple_choice"),
};

export function BankQuestionForm({ bankId }: { bankId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<QuestionFormValues>(emptyQuestion);

  const isEssay = values.questionType === "essay";
  const canAdd =
    values.questionText.trim().length >= 3 &&
    (isEssay
      ? true
      : values.options.length >= 2 &&
        values.options.some((o) => o.isCorrect) &&
        values.options.every((o) => o.text.trim()));

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" aria-hidden="true" />
        Add a question
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
          const result = await addBankQuestionAction(bankId, {
            questionText: values.questionText.trim(),
            questionType: values.questionType,
            answerGuide: isEssay ? values.answerGuide.trim() || null : null,
            topic: values.topic.trim() || null,
            difficulty: values.difficulty,
            marks: Number(values.marks),
            explanation: values.explanation.trim() || null,
            options: isEssay
              ? []
              : values.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
          });
          if (result.ok) {
            setValues(emptyQuestion);
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add a question</p>
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

      <div className="grid gap-1.5">
        <Label htmlFor="bq-text">Question</Label>
        <textarea
          id="bq-text"
          className={textareaClass()}
          rows={2}
          value={values.questionText}
          onChange={(e) => setValues((v) => ({ ...v, questionText: e.target.value }))}
          placeholder="Type the question here…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="bq-type">Question type</Label>
          <select
            id="bq-type"
            className={nativeSelectClass()}
            value={values.questionType}
            onChange={(e) => {
              const type = e.target.value as QuestionFormValues["questionType"];
              setValues((v) => ({ ...v, questionType: type, options: emptyOptions(type) }));
            }}
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">True / False</option>
            <option value="multiple_answer">Multiple answer</option>
            <option value="essay">Essay (teacher marks)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bq-topic">Topic (optional)</Label>
          <Input
            id="bq-topic"
            value={values.topic}
            onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
            placeholder="e.g. Algebra"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bq-diff">Difficulty</Label>
          <select
            id="bq-diff"
            className={nativeSelectClass()}
            value={values.difficulty}
            onChange={(e) =>
              setValues((v) => ({ ...v, difficulty: e.target.value as QuestionFormValues["difficulty"] }))
            }
          >
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>
                {difficultyLabels[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bq-marks">Marks</Label>
          <Input
            id="bq-marks"
            type="number"
            min={1}
            value={values.marks}
            onChange={(e) => setValues((v) => ({ ...v, marks: e.target.value }))}
          />
        </div>
      </div>

      {isEssay ? (
        <div className="grid gap-1.5">
          <Label htmlFor="bq-guide">Marking guide / model answer (optional)</Label>
          <textarea
            id="bq-guide"
            className={textareaClass()}
            rows={3}
            value={values.answerGuide}
            onChange={(e) => setValues((v) => ({ ...v, answerGuide: e.target.value }))}
            placeholder="Key points students need to include…"
          />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Options</p>
          <div className="grid gap-1.5">
            {values.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs font-medium text-muted-foreground">
                  {String.fromCharCode(65 + index)}
                </span>
                <Input
                  aria-label={`Option ${String.fromCharCode(65 + index)}`}
                  className="flex-1"
                  value={option.text}
                  onChange={(e) =>
                    setValues((v) => {
                      const options = v.options.map((o, i) =>
                        i === index ? { ...o, text: e.target.value } : o,
                      );
                      return { ...v, options };
                    })
                  }
                />
                <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-emerald-600"
                    checked={option.isCorrect}
                    onChange={(e) =>
                      setValues((v) => {
                        const options = v.options.map((o, i) =>
                          i === index ? { ...o, isCorrect: e.target.checked } : o,
                        );
                        return { ...v, options };
                      })
                    }
                    aria-label={`Mark option ${String.fromCharCode(65 + index)} correct`}
                  />
                  Correct
                </label>
                {values.options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setValues((v) => ({ ...v, options: v.options.filter((_, i) => i !== index) }))
                    }
                    aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              setValues((v) => ({ ...v, options: [...v.options, { text: "", isCorrect: false }] }))
            }
          >
            <Plus className="mr-1 size-4" aria-hidden="true" />
            Add option
          </Button>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="bq-explanation">Explanation (optional)</Label>
        <textarea
          id="bq-explanation"
          className={textareaClass()}
          rows={2}
          value={values.explanation}
          onChange={(e) => setValues((v) => ({ ...v, explanation: e.target.value }))}
          placeholder="Shown to students after answering…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending || !canAdd}>
          <PlusCircle className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Saving…" : "Save question"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function BankQuestionRow({
  question,
  bankId,
}: {
  question: BankQuestionView;
  bankId: string;
}) {
  const isEssay = question.questionType === "essay";

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className="text-sm font-medium">{question.questionText}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-0.5 font-medium text-foreground">
              {questionTypeLabels[question.questionType as keyof typeof questionTypeLabels] ??
                question.questionType}
            </span>
            <span>{difficultyLabels[question.difficulty as keyof typeof difficultyLabels] ?? question.difficulty}</span>
            <span>·</span>
            <span>
              {question.marks} mark{question.marks === 1 ? "" : "s"}
            </span>
            {question.topic && (
              <>
                <span>·</span>
                <span>{question.topic}</span>
              </>
            )}
          </div>
          {isEssay ? (
            <p className="text-xs text-muted-foreground">
              Students write full answers — this question is marked manually.
            </p>
          ) : (
            <div className="mt-1 grid gap-0.5">
              {question.options.map((option, i) => (
                <p key={option.id} className="flex items-center gap-1.5 text-xs">
                  {option.isCorrect && <Check className="size-3 text-emerald-600" aria-hidden="true" />}
                  <span
                    className={
                      option.isCorrect
                        ? "font-medium text-emerald-600"
                        : "text-muted-foreground"
                    }
                  >
                    {String.fromCharCode(65 + i)}. {option.optionText}
                  </span>
                </p>
              ))}
            </div>
          )}
          {question.explanation && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Explanation:</span>{" "}
              {question.explanation}
            </p>
          )}
        </div>
        <BankQuestionDeleteButton id={question.id} bankId={bankId} />
      </div>
    </div>
  );
}