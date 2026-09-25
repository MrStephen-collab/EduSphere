"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createPlanAction,
  setPlanStatusAction,
  updatePlanAction,
} from "@/app/platform/actions";
import type { PlanInput } from "@/services/billing";

export type PlanFormValue = {
  name: string;
  description: string;
  price: string;
  billingInterval: "monthly" | "annual";
  studentLimit: string;
  teacherLimit: string;
  features: string;
};

export type ClientPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingInterval: "monthly" | "annual";
  studentLimit: number | null;
  teacherLimit: number | null;
  features: string[];
  status: string;
};

function toInput(v: PlanFormValue): PlanInput {
  return {
    name: v.name,
    description: v.description || null,
    price: Number(v.price || 0),
    billingInterval: v.billingInterval,
    studentLimit: v.studentLimit.trim() === "" ? null : Number(v.studentLimit),
    teacherLimit: v.teacherLimit.trim() === "" ? null : Number(v.teacherLimit),
    features: v.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
  };
}

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PlanFields({
  value,
  onChange,
}: {
  value: PlanFormValue;
  onChange: (v: PlanFormValue) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        Plan name
        <input
          className={inputClass}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Starter"
        />
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        Description
        <input
          className={inputClass}
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="For small schools getting started."
        />
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Price (₦)
        <input
          className={inputClass}
          type="number"
          min={0}
          step="any"
          value={value.price}
          onChange={(e) => onChange({ ...value, price: e.target.value })}
        />
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Billing interval
        <select
          className={inputClass}
          value={value.billingInterval}
          onChange={(e) =>
            onChange({ ...value, billingInterval: e.target.value as "monthly" | "annual" })
          }
        >
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Student limit
        <input
          className={inputClass}
          type="number"
          min={0}
          value={value.studentLimit}
          onChange={(e) => onChange({ ...value, studentLimit: e.target.value })}
          placeholder="Unlimited"
        />
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Teacher limit
        <input
          className={inputClass}
          type="number"
          min={0}
          value={value.teacherLimit}
          onChange={(e) => onChange({ ...value, teacherLimit: e.target.value })}
          placeholder="Unlimited"
        />
      </Label>
      <Label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        Features (one per line)
        <textarea
          className={textareaClass}
          value={value.features}
          onChange={(e) => onChange({ ...value, features: e.target.value })}
          placeholder={"Up to 100 students\nCourses & lessons\nEmail support"}
        />
      </Label>
    </div>
  );
}

export function emptyPlanForm(): PlanFormValue {
  return {
    name: "",
    description: "",
    price: "0",
    billingInterval: "monthly",
    studentLimit: "",
    teacherLimit: "",
    features: "",
  };
}

export function planToForm(plan: ClientPlan): PlanFormValue {
  return {
    name: plan.name,
    description: plan.description ?? "",
    price: String(plan.price),
    billingInterval: plan.billingInterval,
    studentLimit: plan.studentLimit != null ? String(plan.studentLimit) : "",
    teacherLimit: plan.teacherLimit != null ? String(plan.teacherLimit) : "",
    features: plan.features.join("\n"),
  };
}

export function PlanForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PlanFormValue>(emptyPlanForm);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Add plan
      </Button>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createPlanAction(toInput(values));
      if (result.ok) {
        setOpen(false);
        router.refresh();
        onDone?.();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="grid gap-4 rounded-md border bg-background p-4">
      <PlanFields value={values} onChange={setValues} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={isPending} onClick={submit}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Create plan
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PlanRowEdit({ plan }: { plan: ClientPlan }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<PlanFormValue>(() => planToForm(plan));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updatePlanAction(plan.id, toInput(values));
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const toggleStatus = (status: "active" | "inactive") => {
    setError(null);
    startTransition(async () => {
      const result = await setPlanStatusAction(plan.id, status);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="grid gap-3 rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{plan.name}</p>
            <Badge variant={plan.status === "active" ? "default" : "outline"}>
              {plan.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            {plan.status === "active" ? (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleStatus("inactive")}>
                Deactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggleStatus("active")}>
                Activate
              </Button>
            )}
          </div>
        )}
      </div>
      {!editing ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">₦{plan.price.toLocaleString()}</span>
          {plan.billingInterval === "annual" ? "/year" : "/month"}
          {plan.studentLimit != null && <> · up to {plan.studentLimit} students</>}
          {plan.teacherLimit != null && <> · up to {plan.teacherLimit} teachers</>}
          {plan.features.length > 0 && <> · {plan.features.length} featured items</>}
        </p>
      ) : (
        <div className="grid gap-3">
          <PlanFields value={values} onChange={setValues} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={isPending} onClick={save}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}