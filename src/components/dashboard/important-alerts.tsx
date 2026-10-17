import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  TrendingDown,
  UserMinus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { SchoolAlerts } from "@/services/school-alerts";

const MAX_ITEMS = 4;

function AlertSection({
  icon: Icon,
  title,
  count,
  href,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  href?: string;
  empty: string;
  children: React.ReactNode;
}) {
  const heading = (
    <span className="flex items-center gap-1.5 text-sm font-medium">
      <Icon className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      {title}
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        {count}
      </span>
    </span>
  );

  return (
    <div className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      {href ? (
        <Link href={href} className="w-fit transition-opacity hover:opacity-80">
          {heading}
        </Link>
      ) : (
        heading
      )}
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-1.5">
          {children}
        </ul>
      )}
    </div>
  );
}

export function ImportantAlerts({ alerts }: { alerts: SchoolAlerts }) {
  const {
    decliningStudents,
    pendingAssignments,
    upcomingExaminations,
    inactiveStudents,
    lowSubjects,
  } = alerts;

  const total =
    decliningStudents.length +
    pendingAssignments.length +
    upcomingExaminations.length +
    inactiveStudents.length +
    lowSubjects.length;

  return (
    <Card className="animate-card-enter" style={{ animationDelay: "360ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {total === 0 ? (
            <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
          )}
          Important alerts
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "Nothing needs your attention right now."
            : `${total} thing${total === 1 ? "" : "s"} worth a look.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <AlertSection
          icon={TrendingDown}
          title="Declining performance"
          count={decliningStudents.length}
          href="/school/analytics"
          empty="No students are slipping."
        >
          {decliningStudents.slice(0, MAX_ITEMS).map((s) => (
            <li key={s.studentId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{s.displayName}</span>
              <span className="shrink-0 text-muted-foreground">
                {s.previousAverage}% → {s.recentAverage}% ({s.change})
              </span>
            </li>
          ))}
          {decliningStudents.length > MAX_ITEMS && (
            <li className="text-xs text-muted-foreground">
              +{decliningStudents.length - MAX_ITEMS} more
            </li>
          )}
        </AlertSection>

        <AlertSection
          icon={ClipboardList}
          title="Assignments awaiting marking"
          count={pendingAssignments.length}
          empty="Every submission has been marked."
        >
          {pendingAssignments.slice(0, MAX_ITEMS).map((a) => (
            <li key={a.assignmentId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{a.title}</span>
              <span className="shrink-0 text-muted-foreground">
                {a.awaiting} to mark
                {a.dueDate ? ` · due ${formatDate(a.dueDate, { day: "numeric", month: "short" })}` : ""}
              </span>
            </li>
          ))}
          {pendingAssignments.length > MAX_ITEMS && (
            <li className="text-xs text-muted-foreground">
              +{pendingAssignments.length - MAX_ITEMS} more
            </li>
          )}
        </AlertSection>

        <AlertSection
          icon={CalendarClock}
          title="Upcoming examinations"
          count={upcomingExaminations.length}
          empty="No examinations scheduled in the next two weeks."
        >
          {upcomingExaminations.slice(0, MAX_ITEMS).map((e) => (
            <li key={e.examinationId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">
                {e.title}
                {e.className ? ` · ${e.className}` : ""}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatDate(e.startsAt)}</span>
            </li>
          ))}
          {upcomingExaminations.length > MAX_ITEMS && (
            <li className="text-xs text-muted-foreground">
              +{upcomingExaminations.length - MAX_ITEMS} more
            </li>
          )}
        </AlertSection>

        <AlertSection
          icon={UserMinus}
          title="Inactive students"
          count={inactiveStudents.length}
          href="/school/students"
          empty="Everyone has been active recently."
        >
          {inactiveStudents.slice(0, MAX_ITEMS).map((s) => (
            <li key={s.studentId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">
                {s.displayName}
                {s.className ? ` · ${s.className}` : ""}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {s.neverActive ? "Never active" : `${s.daysInactive} days quiet`}
              </span>
            </li>
          ))}
          {inactiveStudents.length > MAX_ITEMS && (
            <li className="text-xs text-muted-foreground">
              +{inactiveStudents.length - MAX_ITEMS} more
            </li>
          )}
        </AlertSection>

        <AlertSection
          icon={AlertTriangle}
          title="Subjects below par"
          count={lowSubjects.length}
          href="/school/analytics"
          empty="No subject is averaging below the pass mark."
        >
          {lowSubjects.slice(0, MAX_ITEMS).map((s) => (
            <li key={s.subjectId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium">{s.subjectName}</span>
              <span className="shrink-0 text-muted-foreground">
                {s.average}% · {s.results} result{s.results === 1 ? "" : "s"}
              </span>
            </li>
          ))}
          {lowSubjects.length > MAX_ITEMS && (
            <li className="text-xs text-muted-foreground">
              +{lowSubjects.length - MAX_ITEMS} more
            </li>
          )}
        </AlertSection>
      </CardContent>
    </Card>
  );
}
