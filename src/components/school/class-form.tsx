"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLevelDefinition, classNameOptions } from "@/lib/education/levels";
import type { Department, EducationLevel } from "@/types/database";
import { createClassAction, deleteClassAction } from "@/app/school/actions";

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

/**
 * Creates a class at the level this school teaches at.
 *
 * Two things the plain name box could not do. It offers the level's conventional
 * names so an admin is not inventing "JSS 1" from memory, and it attaches the
 * department or programme that goes with the chosen name, so a polytechnic class
 * is not left with a department nobody set. The name stays free text: a school
 * that calls its classes "Sets" is describing itself accurately, and the list is
 * a suggestion rather than a constraint.
 *
 * Picking a suggestion fills the department and programme in for the admin, but
 * both stay editable afterwards because the suggestion is a starting point.
 */
export function ClassCreateForm({
  level,
  departments,
}: {
  level: EducationLevel | null;
  departments: Pick<Department, "id" | "name">[];
}) {
  const definition = getLevelDefinition(level);
  const suggestions = useMemo(
    () => classNameOptions(level, departments),
    [level, departments],
  );

  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programme, setProgramme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usesDepartments = definition.groupNoun !== null;
  const hasProgrammes = definition.programmes.length > 0;
  const listId = "class-name-suggestions";

  const onNameChange = (value: string) => {
    setName(value);
    // An exact match on a suggestion means the admin picked one, so the
    // department and programme that belong with it come along. A typed name that
    // merely starts the same way leaves them alone.
    const match = suggestions.find((option) => option.name === value.trim());
    if (match) {
      setDepartmentId(match.departmentId ?? "");
      setProgramme(match.programme ?? "");
    }
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createClassAction({
            name: name.trim(),
            departmentId: departmentId || null,
            programme: programme || null,
          });
          if (result.ok) {
            setName("");
            setDepartmentId("");
            setProgramme("");
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-40 flex-1 gap-1.5">
          <label htmlFor="class-name" className="text-xs font-medium text-muted-foreground">
            Class name
          </label>
          <Input
            id="class-name"
            list={listId}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={suggestions[0]?.name ?? "e.g. Year 1"}
            required
            disabled={isPending}
          />
          <datalist id={listId}>
            {suggestions.map((option) => (
              <option key={option.name} value={option.name} />
            ))}
          </datalist>
        </div>

        {usesDepartments && (
          <div className="grid min-w-36 gap-1.5">
            <label
              htmlFor="class-department"
              className="text-xs font-medium text-muted-foreground"
            >
              {definition.groupNoun}
            </label>
            <select
              id="class-department"
              className={nativeSelectClass()}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={isPending}
            >
              <option value="">None</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {hasProgrammes && (
          <div className="grid min-w-28 gap-1.5">
            <label
              htmlFor="class-programme"
              className="text-xs font-medium text-muted-foreground"
            >
              Programme
            </label>
            <select
              id="class-programme"
              className={nativeSelectClass()}
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              disabled={isPending}
            >
              <option value="">None</option>
              {definition.programmes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
          <Plus className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>

      {usesDepartments && departments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          This school teaches at {definition.label.toLowerCase()}, where classes sit inside
          a {definition.groupNoun?.toLowerCase()}.{" "}
          <Link href="/school/structure" className="underline underline-offset-2">
            Add one
          </Link>{" "}
          and class names will be suggested for each.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
/**
 * The school's classes, each showing the grouping it was created with.
 *
 * Shown next to the name rather than instead of it: at a university "Level 200"
 * alone does not say which faculty, and the department is what makes the row
 * useful when the list runs to forty rows.
 */
export function ClassList({
  classes,
}: {
  classes: {
    id: string;
    name: string;
    departmentName: string | null;
    programme: string | null;
  }[];
}) {
  return (
    <ul className="grid gap-1.5">
      {classes.map((row) => (
        <ClassRow
          key={row.id}
          id={row.id}
          name={row.name}
          departmentName={row.departmentName}
          programme={row.programme}
        />
      ))}
    </ul>
  );
}

function ClassRow({
  id,
  name,
  departmentName,
  programme,
}: {
  id: string;
  name: string;
  departmentName: string | null;
  programme: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name}</span>
        {programme && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {programme}
          </span>
        )}
        {departmentName && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {departmentName}
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
            if (typeof window !== "undefined" && !window.confirm(`Delete ${name}?`)) return;
            setError(null);
            startTransition(async () => {
              const result = await deleteClassAction(id);
              if (!result.ok) setError(result.error);
            });
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Delete {name}</span>
        </Button>
      </span>
    </li>
  );
}
