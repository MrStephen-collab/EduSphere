"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, School, Users, ArrowLeft, ArrowRight, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EDUCATION_LEVELS } from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";
import {
  onboardingCreateSchool,
  onboardingSaveClasses,
  onboardingSaveSubjects,
  onboardingSaveSession,
  onboardingImportTeachers,
  onboardingImportStudents,
  completeOnboarding,
} from "@/app/school/onboarding/actions";
import type { OnboardingInit } from "@/app/school/onboarding/page";

const DEFAULT_CLASSES = ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"];
const DEFAULT_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Basic Science",
  "Basic Technology",
  "Civic Education",
  "Social Studies",
  "Computer Studies",
];

const STEPS = [
  "School details",
  "Classes",
  "Subjects",
  "Academic session",
  "Teachers",
  "Students",
  "You're ready",
];

type ImportStats = { created: number; duplicates: number; errors: string[] };

export function OnboardingWizard({ init }: { init: OnboardingInit }) {
  const [schoolId, setSchoolId] = useState(init.schoolId);
  const [schoolName, setSchoolName] = useState(init.schoolName ?? "");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [motto, setMotto] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [classesText, setClassesText] = useState(
    init.classNames.length > 0 ? init.classNames.join("\n") : DEFAULT_CLASSES.join("\n"),
  );
  const [subjectsText, setSubjectsText] = useState(
    init.subjects.length > 0 ? init.subjects.map((s) => (s.code ? `${s.name},${s.code}` : s.name)).join("\n") : DEFAULT_SUBJECTS.join("\n"),
  );
  const [hasSession, setHasSession] = useState(init.hasSession);

  const [teachersCsv, setTeachersCsv] = useState("");
  const [studentsCsv, setStudentsCsv] = useState("");
  const [teachersStats, setTeachersStats] = useState<ImportStats | null>(null);
  const [studentsStats, setStudentsStats] = useState<ImportStats | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialStep =
    schoolId === null
      ? 0
      : init.classNames.length === 0
        ? 1
        : init.subjects.length === 0
          ? 2
          : !hasSession
            ? 3
            : 4;
  const [step, setStep] = useState(initialStep);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, next?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        next?.();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  async function handleReadCsv(file: File, setter: (s: string) => void) {
    const text = await file.text();
    setter(text);
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <School className="size-6 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold leading-tight">Set up your school</p>
            <p className="text-xs text-muted-foreground">A few quick steps to get going</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/15 text-primary ring-1 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </div>
              <span
                className={`hidden text-xs sm:block ${
                  i === step ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-3 bg-border" />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && "Tell us about your school."}
              {step === 1 && "Add the classes you run, one per line."}
              {step === 2 && "Add the subjects your school teaches."}
              {step === 3 && "We'll set up your current academic session and terms."}
              {step === 4 && "Add teachers from a CSV (name, email, title). Optional."}
              {step === 5 && "Add students from a CSV. Optional."}
              {step === 6 && "Everything is set up. You're ready to go."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 0 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="school-name">School name</Label>
                  <Input
                    id="school-name"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Bright Future College"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school-level">Portal level</Label>
                  <select
                    id="school-level"
                    className="h-9 w-full rounded-md border bg-background px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={educationLevel}
                    onChange={(e) =>
                      setEducationLevel(e.target.value as EducationLevel | "")
                    }
                  >
                    <option value="">Choose a level (defaults to secondary)</option>
                    {EDUCATION_LEVELS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label} — {entry.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    The level decides what classes are called, whether they are
                    grouped by department, and whether teachers get the Courses
                    and Lessons menus. You can change it later in School
                    structure.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school-motto">Motto</Label>
                  <Input
                    id="school-motto"
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    placeholder="e.g. Knowledge is light"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="school-city">City</Label>
                    <Input id="school-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Akure" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="school-state">State</Label>
                    <Input id="school-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Ondo" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school-address">Address</Label>
                  <Input id="school-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Example Street" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="school-email">Contact email</Label>
                    <Input id="school-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@school.ng" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="school-phone">Phone</Label>
                    <Input id="school-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0800 000 0000" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school-website">Website</Label>
                  <Input id="school-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://school.ng" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school-description">Short description</Label>
                  <Input id="school-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short blurb about your school" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-2">
                <Label htmlFor="classes-text">Classes (one per line)</Label>
                <textarea
                  id="classes-text"
                  className="min-h-40 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={classesText}
                  onChange={(e) => setClassesText(e.target.value)}
                  placeholder={DEFAULT_CLASSES.join("\n")}
                />
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-2">
                <Label htmlFor="subjects-text">Subjects (one per line, optionally <code>Name,Code</code>)</Label>
                <textarea
                  id="subjects-text"
                  className="min-h-40 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder={DEFAULT_SUBJECTS.join("\n")}
                />
              </div>
            )}

            {step === 3 && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Current session: {new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                <p className="mt-1 text-muted-foreground">
                  Terms: First Term, Second Term, Third Term. You can change these later in Academic Sessions.
                </p>
              </div>
            )}

            {step === 4 && (
              <ImportSection
                value={teachersCsv}
                onChange={setTeachersCsv}
                onFile={async (f) => handleReadCsv(f, setTeachersCsv)}
                stats={teachersStats}
                columns="full_name, email, title"
              />
            )}

            {step === 5 && (
              <ImportSection
                value={studentsCsv}
                onChange={setStudentsCsv}
                onFile={async (f) => handleReadCsv(f, setStudentsCsv)}
                stats={studentsStats}
                columns="first_name, last_name, email, admission_number, gender, date_of_birth"
              />
            )}

            {step === 6 && (
              <div className="text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" />
                  Your school is ready for the new term.
                </p>
                <ul className="mt-3 list-inside space-y-1">
                  <li>Invite your teachers and students now.</li>
                  <li>Next: create your first announcements and courses.</li>
                  <li>Add parents to keep them involved.</li>
                </ul>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isPending}>
                <ArrowLeft className="mr-1 size-4" aria-hidden="true" /> Back
              </Button>

              {step === 0 && (
                <Button
                  onClick={() =>
                    run(
                      async () => {
                        if (!schoolName.trim()) return { ok: false, error: "Enter your school name." };
                        const result = await onboardingCreateSchool({
                          name: schoolName.trim(),
                          educationLevel: educationLevel || null,
                          motto,
                          description,
                          email,
                          phone,
                          address,
                          city,
                          state,
                          website,
                        });
                        if (!result.ok) return { ok: false, error: result.error };
                        setSchoolId(result.data.schoolId);
                        return { ok: true };
                      },
                      nextStep,
                    )
                  }
                  disabled={isPending}
                >
                  {isPending ? "Creating…" : "Create school"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              )}

              {step === 1 && (
                <Button
                  onClick={() =>
                    run(
                      async () => {
                        if (!schoolId) return { ok: false, error: "School not created yet." };
                        const names = classesText.split("\n").map((n) => n.trim()).filter(Boolean);
                        if (names.length === 0) return { ok: false, error: "Add at least one class." };
                        return (await onboardingSaveClasses(schoolId, names)) as { ok: boolean; error?: string };
                      },
                      nextStep,
                    )
                  }
                  disabled={isPending}
                >
                  {isPending ? "Saving…" : "Save classes"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  onClick={() =>
                    run(
                      async () => {
                        if (!schoolId) return { ok: false, error: "School not created yet." };
                        const items = subjectsText
                          .split("\n")
                          .map((line) => {
                            const [name, code] = line.split(",");
                            return { name: (name ?? "").trim(), code };
                          })
                          .filter((i) => i.name);
                        if (items.length === 0) return { ok: false, error: "Add at least one subject." };
                        return (await onboardingSaveSubjects(schoolId, items)) as { ok: boolean; error?: string };
                      },
                      nextStep,
                    )
                  }
                  disabled={isPending}
                >
                  {isPending ? "Saving…" : "Save subjects"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  onClick={() =>
                    run(
                      async () => {
                        if (!schoolId) return { ok: false, error: "School not created yet." };
                        const result = await onboardingSaveSession(schoolId);
                        if (result.ok) setHasSession(true);
                        return result as { ok: boolean; error?: string };
                      },
                      nextStep,
                    )
                  }
                  disabled={isPending}
                >
                  {isPending ? "Setting up…" : "Create session"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              )}

              {step === 4 && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={nextStep} disabled={isPending}>
                    Skip
                  </Button>
                  <Button
                    onClick={() =>
                      run(
                        async () => {
                          if (!teachersCsv.trim()) return { ok: false, error: "Paste CSV text or choose a file first." };
                          const result = await onboardingImportTeachers(teachersCsv);
                          if (result.ok) setTeachersStats(result.data);
                          return result as { ok: boolean; error?: string };
                        },
                        nextStep,
                      )
                    }
                    disabled={isPending}
                  >
                    {isPending ? "Importing…" : "Import teachers"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {step === 5 && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={nextStep} disabled={isPending}>
                    Skip
                  </Button>
                  <Button
                    onClick={() =>
                      run(
                        async () => {
                          if (!studentsCsv.trim()) return { ok: false, error: "Paste CSV text or choose a file first." };
                          const result = await onboardingImportStudents(studentsCsv);
                          if (result.ok) setStudentsStats(result.data);
                          return result as { ok: boolean; error?: string };
                        },
                        nextStep,
                      )
                    }
                    disabled={isPending}
                  >
                    {isPending ? "Importing…" : "Import students"} <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {step === 6 && (
                <Button
                  onClick={() =>
                    run(async () => {
                      if (!schoolId) return { ok: false, error: "School not created yet." };
                      return (await completeOnboarding(schoolId)) as { ok: boolean; error?: string };
                    })
                  }
                  disabled={isPending}
                >
                  <Users className="mr-1 size-4" aria-hidden="true" /> Go to dashboard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

function ImportSection({
  value,
  onChange,
  onFile,
  stats,
  columns,
}: {
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => Promise<void>;
  stats: ImportStats | null;
  columns: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>CSV file</Label>
      <label
        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground"
        htmlFor="csv-file"
      >
        <Upload className="size-4" aria-hidden="true" />
        Choose a .csv file
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onFile(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
      <Label htmlFor="csv-paste">…or paste CSV text</Label>
      <textarea
        id="csv-paste"
        className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Header: ${columns}`}
      />
      {stats && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p>
            Imported <span className="font-medium">{stats.created}</span> row(s)
            {stats.duplicates > 0 && (
              <>, skipped <span className="font-medium">{stats.duplicates}</span> duplicate(s)</>
            )}
            .
          </p>
          {stats.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {stats.errors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}