import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  GraduationCap,
  UsersRound,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getTeacherClassRosters } from "@/services/teacher-classes";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata: Metadata = {
  title: "My classes",
  robots: { index: false, follow: false },
};

export default async function TeacherClassesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId, teacherId } = await requireContentEditor();
  const classes = await getTeacherClassRosters(schoolId, teacherId);

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);

  return (
    <DashboardShell title="My Classes" badge="Teacher">
      {classes.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No classes assigned yet"
          description="Classes assigned to you by the school administrator will appear here with their student rosters."
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="grid gap-1 pt-4">
                <p className="text-2xl font-semibold">{classes.length}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GraduationCap className="size-4" aria-hidden="true" />
                  Classes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-1 pt-4">
                <p className="text-2xl font-semibold">{totalStudents}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UsersRound className="size-4" aria-hidden="true" />
                  Students
                </p>
              </CardContent>
            </Card>
          </div>

          {classes.map((c) => (
            <Card key={c.classId}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>{c.className}</CardTitle>
                  <CardDescription>
                    {c.students.length} student{c.students.length === 1 ? "" : "s"}{" "}
                    enrolled
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" render={<Link href="/teacher/attendance" />}>
                    <ClipboardCheck className="mr-1 size-4" aria-hidden="true" />
                    Attendance
                  </Button>
                  <Button size="sm" variant="outline" render={<Link href="/teacher/analytics" />}>
                    <BarChart3 className="mr-1 size-4" aria-hidden="true" />
                    Analytics
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {c.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No students enrolled yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Student</th>
                          <th className="py-2 pr-3 font-medium">Admission</th>
                          <th className="py-2 text-right font-medium">Gender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.students.map((s) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">
                              {s.displayName ?? "Student"}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {s.admissionNumber}
                            </td>
                            <td className="py-2 text-right capitalize text-muted-foreground">
                              {s.gender ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowRight className="size-4" aria-hidden="true" />
            Use Attendance and Analytics above to mark registers or review each
            class&apos;s performance.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}