import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap, Search, UserCheck, UserX, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getStudents } from "@/services/people";
import { getClasses, getStreams } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { StudentForm } from "@/components/school/people-form";
import { StudentImport } from "@/components/school/student-import";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Students",
  robots: { index: false, follow: false },
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [students, classes, streams] = await Promise.all([
    getStudents(schoolId, { search: q }),
    getClasses(schoolId),
    getStreams(schoolId),
  ]);

  const rows = students.map((s) => ({
    id: s.id,
    userName: asArray(s.profile)[0]?.full_name ?? s.display_name ?? "Unnamed",
    email: asArray(s.profile)[0]?.email ?? null,
    admissionNumber: s.admission_number,
    className: asArray(s.classes)[0]?.name ?? null,
    streamName: asArray(s.streams)[0]?.name ?? null,
    gender: s.gender ?? null,
  }));

  const withLogin = rows.filter((row) => row.email).length;
  const withoutLogin = rows.length - withLogin;
  const classCount = new Set(
    rows.map((row) => row.className).filter((name): name is string => Boolean(name)),
  ).size;

  return (
    <DashboardShell title="Students" badge="Administrator">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            title="Students"
            value={rows.length}
            icon={UsersRound}
            tone="indigo"
            hint={q ? "Matching your search" : "Enrolled in the school"}
          />
          <StatCard
            title="With login"
            value={withLogin}
            icon={UserCheck}
            tone="emerald"
            index={1}
            hint="Can sign in today"
          />
          <StatCard
            title="No login"
            value={withoutLogin}
            icon={UserX}
            tone="amber"
            index={2}
            hint="Added without an email"
          />
          <StatCard
            title="Classes"
            value={classCount}
            icon={GraduationCap}
            tone="sky"
            index={3}
            hint="Represented by these students"
          />
        </div>

        <CollapsibleSection
          compact
          title="Add students"
          description="Create one student, or import a whole class from a CSV."
          defaultOpen
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Card tone="indigo">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add student</CardTitle>
                <CardDescription className="text-xs">
                  A student with an email gets a login account (default password from{" "}
                  <code className="rounded bg-muted px-1">DEFAULT_ACCOUNT_PASSWORD</code>).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StudentForm
                  classes={classes.map((c) => ({ id: c.id, name: c.name }))}
                  streams={streams.map((s) => ({ id: s.id, name: s.name }))}
                />
              </CardContent>
            </Card>

            <Card tone="sky">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Import students</CardTitle>
                <CardDescription className="text-xs">
                  Upload a CSV to create many students at once. Duplicate admission
                  numbers skip rows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StudentImport />
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm">Students</CardTitle>
                <CardDescription className="text-xs">
                  {rows.length} enrolled{q ? " · filtered by your search" : ""}
                </CardDescription>
              </div>
              <form method="GET" className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Search name or admission no."
                  className="h-9 w-full pl-8 sm:w-64"
                  aria-label="Search students"
                />
              </form>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <EmptyState
                icon={q ? Search : UsersRound}
                title={q ? "No matches" : "No students yet"}
                description={
                  q
                    ? "No student matches that name or admission number. Try a shorter search."
                    : "Add your first student above, or import a CSV to enrol a whole class at once."
                }
              />
            ) : (
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Admission no.</th>
                    <th className="px-2 py-2 font-medium">Class</th>
                    <th className="px-2 py-2 font-medium">Gender</th>
                    <th className="px-2 py-2 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(row.userName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.userName}</p>
                            {row.email && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {row.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs tabular-nums">
                        {row.admissionNumber}
                      </td>
                      <td className="px-2 py-2">
                        {row.className ? (
                          <span className="inline-flex items-center gap-1">
                            <Badge variant="blue">{row.className}</Badge>
                            {row.streamName && (
                              <span className="text-[11px] text-muted-foreground">
                                {row.streamName}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 capitalize text-muted-foreground">
                        {row.gender ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        {row.email ? (
                          <Badge variant="success">Login ready</Badge>
                        ) : (
                          <Badge variant="outline">No login</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
