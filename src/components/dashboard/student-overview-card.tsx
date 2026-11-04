import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNaira } from "@/lib/fee-labels";
import {
  getLevelDefinition,
  levelRegistrationNoun,
  levelTermNoun,
} from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";

export type StudentOverviewCardProps = {
  /** Who this is on the portal. */
  displayName: string;
  /** Profile photo when the student has one. */
  avatarUrl?: string | null;
  /** Admission or registration number, with the level's own noun. */
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  level: EducationLevel | null;
  /** Current academic session name, e.g. the 2025/2026 year. */
  sessionName: string | null;
  /** Current term or semester name. */
  termName: string | null;
  /** Outstanding fee balance, in the student's currency. */
  outstanding: number;
  currency: string;
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The student's identity strip: photo, who they are, where they are in the
 * year, and what they owe.
 *
 * Deliberately a single band rather than a panel — the dashboard's job is to
 * show the day's work, so this answers "which student, which term, any balance"
 * in one compact row and gets out of the way.
 */
export function StudentOverviewCard({
  displayName,
  avatarUrl,
  admissionNumber,
  className,
  streamName,
  level,
  sessionName,
  termName,
  outstanding,
  currency,
}: StudentOverviewCardProps) {
  const levelLabel = getLevelDefinition(level).label;
  const periodNoun = levelTermNoun(level);
  const facts = [
    { label: "Academic year", value: sessionName },
    { label: periodNoun, value: termName },
  ];
  const outstandingTint = outstanding > 0 ? "text-destructive" : "text-success";

  return (
    <Card tone="indigo">
      <CardContent className="grid gap-2.5 p-3 sm:flex sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar className="size-9 shrink-0 ring-2 ring-primary/15">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-[11px] font-semibold">
              {initialsOf(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {displayName}
            </p>
            {/* Two short lines on a phone instead of one that truncates the
                class or the level; back to a single line from `sm` up. */}
            <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
              <span className="block truncate sm:inline">
                {levelRegistrationNoun(level)} {admissionNumber || "—"}
              </span>
              <span className="hidden sm:inline"> · </span>
              <span className="block truncate sm:inline">
                {className ? className : "No class"}
                {streamName ? ` · ${streamName}` : ""}
                {` · ${levelLabel}`}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 items-end gap-x-2 gap-y-1 sm:flex sm:items-center sm:gap-6">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <p className="whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                {fact.label}
              </p>
              <p className="truncate text-[11px] font-medium sm:text-xs">
                {fact.value || "—"}
              </p>
            </div>
          ))}

          <div className="min-w-0 text-right">
            <p className="whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
              Outstanding
            </p>
            <p
              className={`whitespace-nowrap text-[13px] font-semibold tabular-nums sm:text-sm ${outstandingTint}`}
            >
              {formatNaira(outstanding, currency)}
            </p>
          </div>

          <Link
            href="/student/fees"
            className="col-start-3 row-start-2 inline-flex items-center justify-self-end gap-1 text-[11px] font-medium text-primary underline-offset-4 hover:underline sm:text-xs"
          >
            Fees
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
