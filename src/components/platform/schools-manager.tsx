"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  archiveSchoolAction,
  deleteSchoolAction,
  restoreSchoolAction,
  setSchoolLevelAction,
  setSchoolPlanAction,
  setSchoolStatusAction,
  updateSchoolAction,
} from "@/app/platform/actions";
import type { PlatformSchoolStatus } from "@/services/platform";
import { EDUCATION_LEVELS } from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";

export type ClientPlanOption = {
  id: string;
  name: string;
  priceLabel: string;
};

export type ClientSchool = {
  id: string;
  name: string;
  slug: string;
  educationLevel: EducationLevel | null;
  status: PlatformSchoolStatus;
  archived: boolean;
  motto: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  students: number;
  teachers: number;
  planId: string | null;
  planName: string | null;
  subscriptionLabel: string;
  subscriptionTone: "ok" | "muted";
  joinedLabel: string;
};

const schoolStatuses: PlatformSchoolStatus[] = [
  "active",
  "pending",
  "suspended",
  "inactive",
];

const statusClasses: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
  inactive: "bg-muted text-muted-foreground",
};

const selectClass =
  "h-8 w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const levelSelectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function levelLabel(level: EducationLevel | null): string {
  if (!level) return "Not set";
  return EDUCATION_LEVELS.find((entry) => entry.value === level)?.label ?? level;
}

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type SchoolForm = {
  name: string;
  educationLevel: EducationLevel | "";
  motto: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  website: string;
};

function toForm(s: ClientSchool): SchoolForm {
  return {
    name: s.name,
    educationLevel: s.educationLevel ?? "",
    motto: s.motto ?? "",
    description: s.description ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    address: s.address ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    website: s.website ?? "",
  };
}

function StatusSelect({ school }: { school: ClientSchool }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <select
        aria-label={`Status for ${school.name}`}
        className={selectClass}
        value={school.status}
        disabled={isPending || school.archived}
        onChange={(e) => {
          setError(null);
          const next = e.target.value as PlatformSchoolStatus;
          startTransition(async () => {
            const result = await setSchoolStatusAction(school.id, next);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {schoolStatuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function LevelSelect({ school }: { school: ClientSchool }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <select
        aria-label={`Portal level for ${school.name}`}
        className={selectClass}
        value={school.educationLevel ?? ""}
        disabled={isPending || school.archived}
        onChange={(e) => {
          setError(null);
          const next = e.target.value;
          startTransition(async () => {
            const result = await setSchoolLevelAction(
              school.id,
              next === "" ? null : (next as EducationLevel),
            );
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        <option value="">Not set</option>
        {EDUCATION_LEVELS.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PlanSelect({ school, plans }: { school: ClientSchool; plans: ClientPlanOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A school can be on a plan that has since been deactivated. It is not in the
  // picker, so it is offered here as the row's own current plan: otherwise the
  // select would render blank and an admin would think the school had none.
  const missingCurrentPlan =
    school.planId != null && !plans.some((p) => p.id === school.planId);

  return (
    <div className="grid gap-1">
      <select
        aria-label={`Plan for ${school.name}`}
        className={selectClass}
        value={school.planId ?? ""}
        disabled={isPending || school.archived}
        onChange={(e) => {
          setError(null);
          const next = e.target.value;
          if (!next) return;
          startTransition(async () => {
            const result = await setSchoolPlanAction(school.id, next);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        <option value="">No plan</option>
        {missingCurrentPlan && (
          <option value={school.planId ?? ""}>
            {school.planName} (inactive)
          </option>
        )}
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.priceLabel}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SchoolEditor({
  school,
  onClose,
}: {
  school: ClientSchool;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<SchoolForm>(() => toForm(school));
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateSchoolAction(school.id, {
        ...values,
        educationLevel: values.educationLevel || null,
        motto: values.motto || null,
        description: values.description || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        website: values.website || null,
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const archive = () => {
    setError(null);
    startTransition(async () => {
      const result = await archiveSchoolAction(school.id, confirmation);
      if (result.ok) {
        setConfirmation("");
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const restore = () => {
    setError(null);
    startTransition(async () => {
      const result = await restoreSchoolAction(school.id);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteSchoolAction(school.id, deleteConfirmation);
      if (result.ok) {
        setDeleteConfirmation("");
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const nameMatchesDelete =
    deleteConfirmation.trim().toLowerCase() === school.name.trim().toLowerCase();

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          School name
          <input
            className={inputClass}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Portal level
          <select
            className={levelSelectClass}
            value={values.educationLevel}
            onChange={(e) =>
              setValues({
                ...values,
                educationLevel: e.target.value as SchoolForm["educationLevel"],
              })
            }
          >
            <option value="">Not set — treated as secondary</option>
            {EDUCATION_LEVELS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-muted-foreground">
            Decides whether teachers get the Courses and Lessons menus.
          </span>
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Motto
          <input
            className={inputClass}
            value={values.motto}
            onChange={(e) => setValues({ ...values, motto: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Description
          <textarea
            className={textareaClass}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Email
          <input
            className={inputClass}
            type="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Phone
          <input
            className={inputClass}
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Address
          <input
            className={inputClass}
            value={values.address}
            onChange={(e) => setValues({ ...values, address: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
          City
          <input
            className={inputClass}
            value={values.city}
            onChange={(e) => setValues({ ...values, city: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
          State
          <input
            className={inputClass}
            value={values.state}
            onChange={(e) => setValues({ ...values, state: e.target.value })}
          />
        </Label>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Website
          <input
            className={inputClass}
            value={values.website}
            onChange={(e) => setValues({ ...values, website: e.target.value })}
          />
        </Label>
      </div>

      <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
        <p className="text-sm font-medium text-destructive">
          {school.archived ? "This school is archived" : "Archive this school"}
        </p>
        <p className="text-xs text-muted-foreground">
          {school.archived
            ? "Its data is all still here. Restoring signs every user back in."
            : "Archiving signs the school out and hides it, but keeps every student, result and course. It can be restored afterwards."}
        </p>
        {school.archived ? (
          <div>
            <Button variant="outline" size="sm" disabled={isPending} onClick={restore}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Restore school
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Type <span className="font-semibold text-foreground">{school.name}</span>{" "}
              to confirm
              <input
                className={inputClass}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Label>
            <div>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={archive}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Archive className="size-4" aria-hidden="true" />
                )}
                Archive school
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-md border border-destructive bg-destructive/10 p-3">
        <p className="text-sm font-medium text-destructive">
          Delete this school permanently
        </p>
        <p className="text-xs text-muted-foreground">
          This cannot be undone. The school and everything under it — classes,
          students, results, courses and invoices — is removed for good. Archive
          it instead if you only mean to switch it off.
        </p>
        <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Type <span className="font-semibold text-foreground">{school.name}</span>{" "}
          to confirm
          <input
            className={inputClass}
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            autoComplete="off"
          />
        </Label>
        <div>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending || !nameMatchesDelete}
            onClick={remove}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Delete permanently
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <SheetFooter>
        <Button disabled={isPending} onClick={save}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save changes
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </SheetFooter>
    </div>
  );
}

export function SchoolsManager({
  schools,
  plans,
  emptyState,
}: {
  schools: ClientSchool[];
  plans: ClientPlanOption[];
  emptyState: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ClientSchool | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((s) => {
      if (s.archived && !showArchived) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        [s.city, s.state, s.ownerName, s.ownerEmail, s.planName]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      );
    });
  }, [schools, query, showArchived]);

  const archivedCount = schools.filter((s) => s.archived).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search school, owner or city…"
            aria-label="Search schools"
          />
        </div>
        {archivedCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived ({archivedCount})
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        schools.length === 0 ? (
          emptyState
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No schools match your search.
          </p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">School</th>
                <th className="py-2 pr-3 font-medium">Location</th>
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Owner</th>
                <th className="py-2 pr-3 text-right font-medium">Students</th>
                <th className="py-2 pr-3 text-right font-medium">Teachers</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Joined</th>
                <th className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium">
                      {s.name}
                      {s.archived && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          archived
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.slug}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.educationLevel
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {levelLabel(s.educationLevel)}
                    </span>
                    <div className="mt-1 w-40">
                      <LevelSelect school={s} />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{s.ownerName ?? "—"}</p>
                    {s.ownerEmail && (
                      <p className="text-xs text-muted-foreground">{s.ownerEmail}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{s.students}</td>
                  <td className="py-2 pr-3 text-right">{s.teachers}</td>
                  <td className="py-2 pr-3">
                    <p
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.subscriptionTone === "ok"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.subscriptionLabel}
                    </p>
                    <div className="mt-1 w-40">
                      <PlanSelect school={s} plans={plans} />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusClasses[s.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.status}
                    </span>
                    <div className="mt-1 w-32">
                      <StatusSelect school={s} />
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right text-xs text-muted-foreground">
                    {s.joinedLabel}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(s)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editing.name}</SheetTitle>
                <SheetDescription>
                  {editing.slug} · owner{" "}
                  {editing.ownerName ?? editing.ownerEmail ?? "unknown"}
                </SheetDescription>
              </SheetHeader>
              <SchoolEditor school={editing} onClose={() => setEditing(null)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}