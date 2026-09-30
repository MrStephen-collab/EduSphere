"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { TimetablePeriod } from "@/types/database";
import type { ActionState } from "@/app/timetable/actions";
import { createTimetablePeriodAction, deleteTimetablePeriodAction } from "@/app/timetable/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeriodTime } from "@/lib/timetable-labels";

/**
 * The shape of the school day, editable by a school admin only.
 *
 * Deleting a period deletes every lesson in it, so it asks first and says what
 * it will take with it rather than quietly emptying a morning for every class.
 */
export function PeriodManager({ periods }: { periods: TimetablePeriod[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createTimetablePeriodAction({
        name: name.trim(),
        startTime,
        endTime,
      });
      if (result.ok) {
        setName("");
        setStartTime("");
        setEndTime("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const remove = (period: TimetablePeriod) => {
    const prompt = period.is_break
      ? `Remove ${period.name}?`
      : `Remove ${period.name}? Every lesson scheduled in this period will be deleted too.`;
    if (!window.confirm(prompt)) return;

    setError(null);
    startTransition(async () => {
      const result: ActionState = await deleteTimetablePeriodAction(period.id);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Periods</CardTitle>
        <p className="text-sm text-muted-foreground">
          When the school day starts, and where the breaks fall.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {periods.length > 0 && (
          <ul className="grid gap-2">
            {periods.map((period) => (
              <li key={period.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 font-medium">{period.name}</span>
                <span className="text-muted-foreground">
                  {formatPeriodTime(period.start_time, period.end_time)}
                </span>
                {period.is_break && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    break
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(period)}
                  disabled={isPending}
                  className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${period.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-40 gap-1.5">
            <label htmlFor="period-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id="period-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Period 1"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="period-start" className="text-xs font-medium text-muted-foreground">
              Starts
            </label>
            <Input
              id="period-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="period-end" className="text-xs font-medium text-muted-foreground">
              Ends
            </label>
            <Input
              id="period-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <Button type="button" onClick={submit} disabled={isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Add period
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
