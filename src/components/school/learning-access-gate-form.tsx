"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLearningAccessThresholdAction } from "@/app/school/actions";

/**
 * The school's fee gate, as one number.
 *
 * A bursar setting this needs to know two things that are not obvious from a
 * number field: that 0 is off rather than "nothing is ever owed", and that a
 * waived invoice is what exempts a student, not a separate list they have to
 * maintain. Both are stated here rather than in a tooltip, because the cost of
 * getting them wrong is a family locked out of lessons.
 */
export function LearningAccessGateForm({
  schoolId,
  thresholdPct,
}: {
  schoolId: string;
  thresholdPct: number;
}) {
  const [value, setValue] = useState(String(thresholdPct));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100;
  const asNumber = valid ? parsed : thresholdPct;

  function save() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await setLearningAccessThresholdAction({
        schoolId,
        thresholdPct: value,
      });
      if (result.ok) {
        setSaved(result.message ?? "Saved.");
        setValue(String(asNumber));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor="learning-threshold" className="text-sm font-medium">
            Percentage of fees to pay before materials open
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="learning-threshold"
              name="threshold"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24"
              aria-describedby="learning-threshold-help"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <Button onClick={save} disabled={!valid || isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save
        </Button>
      </div>

      <p id="learning-threshold-help" className="text-sm text-muted-foreground">
        {asNumber === 0 ? (
          <>
            <strong className="font-medium text-foreground">Currently off.</strong> Materials
            open for every student. Set a percentage above zero to hold materials from students who
            are below it.
          </>
        ) : (
          <>
            <strong className="font-medium text-foreground">Currently {asNumber}%.</strong> A
            student who has paid less than {asNumber}% of what they have been billed cannot open
            course materials. Their lessons, notes and progress stay visible.
          </>
        )}
      </p>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          To exempt a student, waive their invoice rather than adding them here: a waived or void
          invoice leaves the billed figure at zero, and a student who has never been billed is
          never held. Pending payments do not count until an administrator approves them.
        </span>
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-primary">
          {saved}
        </p>
      )}
    </div>
  );
}
