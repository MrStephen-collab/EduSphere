"use client";

import { useState, useTransition } from "react";
import { Building2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EDUCATION_LEVELS,
  levelOffersCourses,
  levelUsesDepartments,
} from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  setEducationLevelAction,
} from "@/app/school/actions";

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

/**
 * What changing the level actually changes, said plainly.
 *
 * A level is not a label here: it decides whether Courses and Lessons appear at
 * all, which class names get suggested, and whether classes and courses are
 * grouped under departments. An admin picking "University" deserves to know all
 * three before they commit to it, because existing classes are never renamed for
 * them.
 */
function levelConsequences(level: EducationLevel): string[] {
  const definition = EDUCATION_LEVELS.find((entry) => entry.value === level);
  const notes = [
    `Classes will be suggested as ${
      definition?.groupNoun
        ? `${definition.groupNoun.toLowerCase()} + ${definition.pluralClassNoun.toLowerCase()}`
        : definition?.pluralClassNoun.toLowerCase() ?? "years"
    }.`,
  ];
  notes.push(
    levelOffersCourses(level)
      ? "Courses and Lessons will appear in the teacher navigation."
      : "Courses and Lessons stay hidden for teachers.",
  );
  notes.push(
    levelUsesDepartments(level)
      ? `Classes and courses can be grouped by ${
          definition?.groupNoun?.toLowerCase() ?? "department"
        }.`
      : "Classes and courses are not grouped by department.",
  );
  if (definition?.programmes.length) {
    notes.push(
      `Classes can sit in a programme (${definition.programmes.join(" or ")}).`,
    );
  }
  return notes;
}

export function EducationLevelPicker({
  schoolId,
  level,
}: {
  schoolId: string;
  level: EducationLevel | null;
}) {
  const [selected, setSelected] = useState<string>(level ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changed = selected !== (level ?? "");
  const chosen = EDUCATION_LEVELS.find((entry) => entry.value === selected);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="education-level" className="text-sm font-medium">
          Education level
        </label>
        <select
          id="education-level"
          className={nativeSelectClass()}
          value={selected}
          disabled={isPending}
          onChange={(e) => {
            setError(null);
            setSelected(e.target.value);
          }}
        >
          <option value="">Not set — treated as secondary</option>
          {EDUCATION_LEVELS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label} — {entry.description}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        <ul className="grid gap-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {levelConsequences(chosen.value).map((note) => (
            <li key={note} className="flex items-start gap-1.5">
              <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{note}</span>
            </li>
          ))}
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>Existing classes keep the names they already have.</span>
          </li>
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !changed || !selected}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await setEducationLevelAction({
                schoolId,
                level: selected,
              });
              if (!result.ok) setError(result.error);
            });
          }}
        >
          {isPending && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save level"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Departments (college, polytechnic) or faculties (university).
 *
 * The noun is the level's, not this component's: the table is the same either way
 * and only the vocabulary differs, so an admin is never asked to think about a
 * university calling them faculties. Adding one is the whole capability, and
 * removing one leaves its classes and courses in place, ungrouped.
 */
export function DepartmentManager({
  departments,
  groupNoun,
}: {
  departments: { id: string; name: string; classCount?: number }[];
  groupNoun: string;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await createDepartmentAction({ name: name.trim() });
            if (result.ok) setName("");
            else setError(result.error);
          });
        }}
      >
        <div className="grid min-w-40 flex-1 gap-1.5">
          <label htmlFor="department-name" className="sr-only">
            {groupNoun} name
          </label>
          <Input
            id="department-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${groupNoun === "Faculty" ? "Engineering" : "Computer Science"}`}
            required
            disabled={isPending}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding…" : `Add ${groupNoun.toLowerCase()}`}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {departments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="size-4" aria-hidden="true" />
          No {groupNoun.toLowerCase()}s yet. Classes will be suggested without one until
          you add some.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {departments.map((department) => (
            <DepartmentRow key={department.id} department={department} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DepartmentRow({
  department,
}: {
  department: { id: string; name: string; classCount?: number };
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span className="font-medium">{department.name}</span>
        {typeof department.classCount === "number" && department.classCount > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {department.classCount} class{department.classCount === 1 ? "" : "es"}
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-2">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              !window.confirm(
                `Remove ${department.name}? Its classes and courses stay, ungrouped.`,
              )
            ) {
              return;
            }
            setError(null);
            startTransition(async () => {
              const result = await deleteDepartmentAction(department.id);
              if (!result.ok) setError(result.error);
            });
          }}
        >
          Remove
        </Button>
      </span>
    </li>
  );
}