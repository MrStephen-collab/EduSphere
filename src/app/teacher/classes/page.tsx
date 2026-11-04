import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  UsersRound,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getTeacherClassRosters } from "@/services/teacher-classes";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardTone,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";

export const metadata: Metadata = {
  title: "My classes",
  robots: { index: false, follow: false },
};

// Each class card takes the next accent, so a teacher scanning the grid can tell
// one class from another before reading a single word.
const CLASS_TONES: readonly CardTone[] = [
  "indigo",
  "sky",
  "violet",
  "teal",
  "fuchsia",
  "emerald",
];

function initials(name: string | null): string {
  return (name ?? "Student")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function TeacherClassesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, teacherId } = await requireContentEditor();
  const classes = await getTeacherClassRosters(schoolId, teacherId);

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);
  const averageClass =
    classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;

  return (
    <DashboardShell title="My Classes">
      {classes.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No classes assigned yet"
          description="Classes assigned to you by the school administrator will appear here with their student rosters."
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatCard
              title="Classes"
              value={classes.length}
              icon={GraduationCap}
              tone="indigo"
              hint="Assigned to you"
            />
            <StatCard
              title="Students"
              value={totalStudents}
              icon={UsersRound}
              tone="sky"
              index={1}
              hint="Across every class"
            />
            <div className="col-span-2 sm:col-span-1">
              <StatCard
                title="Average class"
                value={averageClass}
                icon={BarChart3}
                tone="emerald"
                index={2}
                hint="Students per class"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((c, index) => {
              const boys = c.students.filter((s) => s.gender === "male").length;
              const girls = c.students.filter((s) => s.gender === "female").length;
              const firstNames = c.students
                .slice(0, 3)
                .map((s) => s.displayName?.split(" ")[0])
                .filter(Boolean)
                .join(", ");

              return (
                <Card
                  key={c.classId}
                  tone={CLASS_TONES[index % CLASS_TONES.length]}
                  className="flex h-full flex-col"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {c.className}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {c.students.length === 0
                            ? "No students enrolled yet"
                            : `${c.students.length} student${
                                c.students.length === 1 ? "" : "s"
                              } · ${boys} boys · ${girls} girls`}
                        </CardDescription>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {c.students.length}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="grid flex-1 content-start gap-3">
                    {c.students.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {c.students.slice(0, 5).map((s) => (
                            <span
                              key={s.id}
                              title={s.displayName ?? "Student"}
                              className="grid size-7 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-2 ring-card"
                            >
                              {initials(s.displayName)}
                            </span>
                          ))}
                          {c.students.length > 5 && (
                            <span className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                              +{c.students.length - 5}
                            </span>
                          )}
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {firstNames}
                          {c.students.length > 3 ? " and others" : ""}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/teacher/attendance?class=${c.classId}`}
                        className="inline-flex"
                      >
                        <Button size="sm" className="w-full">
                          <ClipboardCheck className="mr-1 size-4" aria-hidden="true" />
                          Attendance
                        </Button>
                      </Link>
                      <Link
                        href={`/teacher/analytics?class=${c.classId}`}
                        className="inline-flex"
                      >
                        <Button size="sm" variant="outline" className="w-full">
                          <BarChart3 className="mr-1 size-4" aria-hidden="true" />
                          Analytics
                        </Button>
                      </Link>
                    </div>

                    {c.students.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Students appear here once the school enrols them.
                      </div>
                    ) : (
                      <details className="group rounded-lg border bg-background/40">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                          Full roster
                          <ChevronDown
                            className="size-4 shrink-0 transition-transform group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <ul className="max-h-64 divide-y overflow-y-auto border-t">
                          {c.students.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                                  {initials(s.displayName)}
                                </span>
                                <span className="truncate font-medium">
                                  {s.displayName ?? "Student"}
                                </span>
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                {s.admissionNumber}
                                {s.gender ? ` · ${s.gender}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Attendance and Analytics open already filtered to that class.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
