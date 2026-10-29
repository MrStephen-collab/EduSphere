import {
  BookOpen,
  CalendarClock,
  GraduationCap,
  IdCard,
  ScrollText,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoRow } from "@/components/profile/info-row";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/fee-labels";
import {
  getLevelDefinition,
  levelRegistrationNoun,
  levelTermNoun,
} from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";
import Link from "next/link";

export type StudentOverviewCardProps = {
  /** Who this is on the portal. */
  displayName: string;
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

export function StudentOverviewCard({
  displayName,
  admissionNumber,
  className,
  streamName,
  level,
  sessionName,
  termName,
  outstanding,
  currency,
}: StudentOverviewCardProps) {
  const levelDefinition = getLevelDefinition(level);
  const periodNoun = levelTermNoun(level);

  const rows = [
    { icon: IdCard, label: levelRegistrationNoun(level), value: admissionNumber || "—" },
    { icon: BookOpen, label: "Class", value: className || "—" },
    { icon: GraduationCap, label: "Level", value: levelDefinition.label },
    { icon: CalendarClock, label: "Academic year", value: sessionName || "—" },
    { icon: ScrollText, label: periodNoun, value: termName || "—" },
    { icon: UsersRound, label: "Stream", value: streamName || "—" },
  ];

  const outstandingTint = outstanding > 0 ? "text-destructive" : "text-success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{displayName}</CardTitle>
        <CardDescription>
          Your enrolment and fee position at a glance
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <InfoRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding balance</p>
              <p className={`text-lg font-semibold ${outstandingTint}`}>
                {formatNaira(outstanding, currency)}
              </p>
            </div>
          </div>
          <Link href="/student/fees">
            <Button variant="outline" size="sm">
              View fees
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
