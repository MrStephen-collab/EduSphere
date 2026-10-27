"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TraditionalReportCard } from "./traditional-report-card";
import { saveTraditionalReportCardAction } from "@/app/teacher/report-card-actions";
import {
  emptySubject,
  recalculateSubject,
  toNumberOrNull,
  type TraditionalGrade,
  type TraditionalReportData,
  type TraditionalSubjectRow,
} from "@/lib/traditional-report";
import type {
  TraditionalEntryStudent,
  TraditionalReportRecord,
} from "@/services/traditional-report-cards";

const inputClass = "rounded-md border px-2 py-1 text-sm";
const scoreInputClass = "w-12 rounded border px-1 text-xs";

type NumericStudentField =
  | "noOnRoll"
  | "position"
  | "totalInClass"
  | "daysOpened"
  | "daysPresent"
  | "daysAbsent";

type ScoreField =
  | "test1"
  | "test2"
  | "test3"
  | "exam"
  | "overall"
  | "lastTerm"
  | "cumulative"
  | "classAvg"
  | "position";

function formatStamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function GradePicker({
  value,
  onChange,
}: {
  value?: TraditionalGrade | null;
  onChange: (value: TraditionalGrade | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {(["A", "B", "C", "D", "E"] as const).map((grade) => {
        const active = value === grade;
        return (
          <button
            key={grade}
            type="button"
            aria-label={`${grade}${active ? " (selected)" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(active ? null : grade)}
            className={`h-6 w-6 rounded border text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {grade}
          </button>
        );
      })}
    </div>
  );
}

export function TraditionalReportCardEntry({
  students,
  selection,
  record,
}: {
  students: TraditionalEntryStudent[];
  selection: { classId: string; termId: string; studentId: string };
  record: TraditionalReportRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<TraditionalReportData>(() => record.data);
  const [showPreview, setShowPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(record.savedAt);
  const [error, setError] = useState<string | null>(null);
  const storageReady = record.storageReady;

  const markDirty = () => {
    setDirty(true);
    setError(null);
  };

  const setStudentText = (
    key:
      | "fullName"
      | "admissionNo"
      | "className"
      | "session"
      | "term"
      | "sex"
      | "house",
    value: string,
  ) => {
    markDirty();
    setForm((current) => ({
      ...current,
      student: { ...current.student, [key]: value },
    }));
  };

  const setStudentNumber = (key: NumericStudentField, raw: string) => {
    markDirty();
    const parsed = toNumberOrNull(raw);
    setForm((current) => ({
      ...current,
      student: { ...current.student, [key]: parsed },
    }));
  };

  const updateSubject = (
    index: number,
    patch: Partial<TraditionalSubjectRow>,
    recalculate = false,
  ) => {
    markDirty();
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, i) => {
        if (i !== index) return subject;
        const next = { ...subject, ...patch };
        return recalculate ? recalculateSubject(next) : next;
      }),
    }));
  };

  const setSubjectNumber = (index: number, key: ScoreField, raw: string) => {
    const recalculate =
      key === "test1" || key === "test2" || key === "test3" || key === "exam";
    updateSubject(index, { [key]: toNumberOrNull(raw) } as Partial<TraditionalSubjectRow>, recalculate);
  };

  const setTrait = (
    kind: "affective" | "psychomotor",
    index: number,
    value: TraditionalGrade | null,
  ) => {
    markDirty();
    setForm((current) => ({
      ...current,
      [kind]: current[kind].map((trait, i) =>
        i === index ? { ...trait, value } : trait,
      ),
    }));
  };

  const setComment = (
    key:
      | "classTeacher"
      | "classTeacherName"
      | "classTeacherDate"
      | "principal"
      | "principalName"
      | "principalDate"
      | "nextTermBegins",
    value: string,
  ) => {
    markDirty();
    setForm((current) => ({
      ...current,
      comments: { ...current.comments, [key]: value },
    }));
  };

  const addSubject = () => {
    markDirty();
    setForm((current) => ({
      ...current,
      subjects: [...current.subjects, emptySubject("")],
    }));
  };

  const removeSubject = (index: number) => {
    markDirty();
    setForm((current) => ({
      ...current,
      subjects: current.subjects.filter((_, i) => i !== index),
    }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveTraditionalReportCardAction({
        studentId: selection.studentId,
        termId: selection.termId,
        data: {
          student: form.student,
          subjects: form.subjects,
          affective: form.affective,
          psychomotor: form.psychomotor,
          comments: form.comments,
        },
      });
      if (result.ok) {
        setSavedAt(result.savedAt);
        setDirty(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const selectedStudent = students.find((s) => s.id === selection.studentId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-semibold">
            {form.student.fullName || selectedStudent?.displayName || "Report card"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {form.student.admissionNo || selectedStudent?.admissionNumber}
            {form.student.className ? ` · ${form.student.className}` : ""}
            {form.student.term ? ` · ${form.student.term}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Printer className="size-4" aria-hidden="true" />
            {showPreview ? "Back to edit" : "Preview"}
          </Button>
          <Button
            onClick={save}
            disabled={isPending || !storageReady}
            title={storageReady ? undefined : "Apply migration 0035 to enable saving"}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isPending ? "Saving…" : "Save report card"}
          </Button>
        </div>
      </div>

      {!storageReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          Report card storage isn&apos;t set up on this database yet. Apply{" "}
          <code className="font-mono">supabase/migrations/0035_traditional_report_cards.sql</code>{" "}
          (with <code className="font-mono">supabase db push</code> or the SQL editor) and reload —
          saving is disabled until then.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground print:hidden">
        {savedAt && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
            Last saved {formatStamp(savedAt)}
          </span>
        )}
        {!savedAt && storageReady && <span>Not saved yet</span>}
        {dirty && <span className="text-amber-600">Unsaved changes</span>}
        {error && <span className="text-destructive">{error}</span>}
      </div>

      {showPreview ? (
        <div className="overflow-auto rounded-lg border bg-gray-100 p-4">
          <div className="mb-2 flex justify-end print:hidden">
            <Button onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print
            </Button>
          </div>
          <TraditionalReportCard data={form} />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Student information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Full name
                <input
                  className={inputClass}
                  value={form.student.fullName}
                  onChange={(e) => setStudentText("fullName", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Admission no.
                <input
                  className={inputClass}
                  value={form.student.admissionNo}
                  onChange={(e) => setStudentText("admissionNo", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Class
                <input
                  className={inputClass}
                  value={form.student.className}
                  onChange={(e) => setStudentText("className", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Sex
                <input
                  className={inputClass}
                  value={form.student.sex ?? ""}
                  onChange={(e) => setStudentText("sex", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Session
                <input
                  className={inputClass}
                  value={form.student.session}
                  onChange={(e) => setStudentText("session", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Term
                <input
                  className={inputClass}
                  value={form.student.term}
                  onChange={(e) => setStudentText("term", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                House
                <input
                  className={inputClass}
                  value={form.student.house ?? ""}
                  onChange={(e) => setStudentText("house", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                No. on roll
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.noOnRoll ?? ""}
                  onChange={(e) => setStudentNumber("noOnRoll", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Position in class
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.position ?? ""}
                  onChange={(e) => setStudentNumber("position", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Total in class
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.totalInClass ?? ""}
                  onChange={(e) => setStudentNumber("totalInClass", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                School opened (days)
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.daysOpened ?? ""}
                  onChange={(e) => setStudentNumber("daysOpened", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Days present
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.daysPresent ?? ""}
                  onChange={(e) => setStudentNumber("daysPresent", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Days absent
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.student.daysAbsent ?? ""}
                  onChange={(e) => setStudentNumber("daysAbsent", e.target.value)}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Academic performance</CardTitle>
              <Button variant="outline" size="sm" onClick={addSubject}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add subject
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-1 font-medium">Subject</th>
                    <th className="p-1 font-medium">Test 1</th>
                    <th className="p-1 font-medium">Test 2</th>
                    <th className="p-1 font-medium">Test 3</th>
                    <th className="p-1 font-medium">Total tests</th>
                    <th className="p-1 font-medium">Exam</th>
                    <th className="p-1 font-medium">Overall</th>
                    <th className="p-1 font-medium">Last term</th>
                    <th className="p-1 font-medium">Cumulative</th>
                    <th className="p-1 font-medium">Class avg</th>
                    <th className="p-1 font-medium">Pos.</th>
                    <th className="p-1 font-medium">Grade</th>
                    <th className="p-1 font-medium">Remark</th>
                    <th className="p-1" />
                  </tr>
                </thead>
                <tbody>
                  {form.subjects.map((subject, index) => (
                    <tr key={index} className="border-b align-top">
                      <td className="p-1">
                        <input
                          className="w-40 rounded border px-1 py-1 text-xs"
                          value={subject.name}
                          onChange={(e) =>
                            updateSubject(index, { name: e.target.value })
                          }
                          placeholder="Subject"
                        />
                      </td>
                      {(["test1", "test2", "test3"] as const).map((key) => (
                        <td key={key} className="p-1">
                          <input
                            className={scoreInputClass}
                            value={subject[key] ?? ""}
                            onChange={(e) =>
                              setSubjectNumber(index, key, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="p-1 text-muted-foreground">
                        {subject.totalTests ?? "—"}
                      </td>
                      <td className="p-1">
                        <input
                          className={scoreInputClass}
                          value={subject.exam ?? ""}
                          onChange={(e) =>
                            setSubjectNumber(index, "exam", e.target.value)
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className={scoreInputClass}
                          value={subject.overall ?? ""}
                          onChange={(e) =>
                            setSubjectNumber(index, "overall", e.target.value)
                          }
                        />
                      </td>
                      {(
                        ["lastTerm", "cumulative", "classAvg", "position"] as const
                      ).map((key) => (
                        <td key={key} className="p-1">
                          <input
                            className={scoreInputClass}
                            value={subject[key] ?? ""}
                            onChange={(e) =>
                              setSubjectNumber(index, key, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="p-1">
                        <input
                          className="w-12 rounded border px-1 py-1 text-xs"
                          value={subject.grade ?? ""}
                          onChange={(e) =>
                            updateSubject(index, { grade: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <input
                          className="w-36 rounded border px-1 py-1 text-xs"
                          value={subject.remark ?? ""}
                          onChange={(e) =>
                            updateSubject(index, { remark: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${subject.name || "subject"}`}
                          onClick={() => removeSubject(index)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {form.subjects.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                  No subjects yet — use “Add subject” to start a row.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Total tests is the sum of Test 1–3; overall is total tests + exam.
                Both update automatically when a test or exam score changes, and
                overall stays editable for schools that score differently.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Affective disposition</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1 text-left font-medium">Trait</th>
                      <th className="p-1 text-left font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.affective.map((trait, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-1">{trait.name}</td>
                        <td className="p-1">
                          <GradePicker
                            value={trait.value}
                            onChange={(value) =>
                              setTrait("affective", index, value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Psychomotor skills</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1 text-left font-medium">Skill</th>
                      <th className="p-1 text-left font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.psychomotor.map((trait, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-1">{trait.name}</td>
                        <td className="p-1">
                          <GradePicker
                            value={trait.value}
                            onChange={(value) =>
                              setTrait("psychomotor", index, value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comments &amp; approvals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Class teacher&apos;s comment
                <textarea
                  className="min-h-16 rounded-md border p-2 text-sm"
                  value={form.comments.classTeacher ?? ""}
                  onChange={(e) => setComment("classTeacher", e.target.value)}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Class teacher name
                  <input
                    className={inputClass}
                    value={form.comments.classTeacherName ?? ""}
                    onChange={(e) =>
                      setComment("classTeacherName", e.target.value)
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Date
                  <input
                    className={inputClass}
                    value={form.comments.classTeacherDate ?? ""}
                    onChange={(e) =>
                      setComment("classTeacherDate", e.target.value)
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Next term begins
                  <input
                    className={inputClass}
                    value={form.comments.nextTermBegins ?? ""}
                    onChange={(e) =>
                      setComment("nextTermBegins", e.target.value)
                    }
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Principal&apos;s comment
                <textarea
                  className="min-h-16 rounded-md border p-2 text-sm"
                  value={form.comments.principal ?? ""}
                  onChange={(e) => setComment("principal", e.target.value)}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Principal name
                  <input
                    className={inputClass}
                    value={form.comments.principalName ?? ""}
                    onChange={(e) =>
                      setComment("principalName", e.target.value)
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Date
                  <input
                    className={inputClass}
                    value={form.comments.principalDate ?? ""}
                    onChange={(e) =>
                      setComment("principalDate", e.target.value)
                    }
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Button onClick={save} disabled={isPending || !storageReady}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {isPending ? "Saving…" : "Save report card"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
