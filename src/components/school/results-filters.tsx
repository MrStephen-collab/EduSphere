"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };
type ExamOption = { id: string; title: string };

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function ResultsFilters({
  classes,
  subjects,
  examinations,
}: {
  classes: Option[];
  subjects: Option[];
  examinations: ExamOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const isEmpty =
    !searchParams.get("class_id") &&
    !searchParams.get("subject_id") &&
    !searchParams.get("examination_id");

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        apply({
          class_id: String(data.get("class_id") ?? ""),
          subject_id: String(data.get("subject_id") ?? ""),
          examination_id: String(data.get("examination_id") ?? ""),
        });
      }}
    >
      <div className="grid gap-1.5 sm:col-span-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Filter className="size-3.5" aria-hidden="true" />
          Filters
        </p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="f-class" className="text-sm font-medium sr-only">
          Class
        </label>
        <select
          id="f-class"
          name="class_id"
          defaultValue={searchParams.get("class_id") ?? ""}
          className={nativeSelectClass()}
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
        <label htmlFor="f-subject" className="sr-only">
          Subject
        </label>
        <select
          id="f-subject"
          name="subject_id"
          defaultValue={searchParams.get("subject_id") ?? ""}
          className={nativeSelectClass()}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="f-exam" className="sr-only">
          Examination
        </label>
        <select
          id="f-exam"
          name="examination_id"
          defaultValue={searchParams.get("examination_id") ?? ""}
          className={nativeSelectClass()}
        >
<option value="">All examinations</option>
          {examinations.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 sm:col-span-3">
        <Button type="submit" size="sm" variant="outline">
          Apply filters
        </Button>
        {!isEmpty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => apply({})}
          >
            <X className="mr-1 size-4" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}