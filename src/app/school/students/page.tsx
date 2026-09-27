import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getStudents } from "@/services/people";
import { getClasses, getStreams } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StudentForm } from "@/components/school/people-form";
import { StudentImport } from "@/components/school/student-import";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Students",
  robots: { index: false, follow: false },
};

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

  return (
    <DashboardShell title="Students">
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add student</CardTitle>
              <CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Import students</CardTitle>
              <CardDescription>
                Upload a CSV to create many students at once. Duplicate admission numbers skip rows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudentImport />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Students ({rows.length})</span>
              <form method="GET" className="flex w-full max-w-xs items-center gap-2">
                <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                <Input name="q" defaultValue={q ?? ""} placeholder="Search admission no. or name" className="h-8" />
              </form>
            </CardTitle>
            <CardDescription>Find and manage enrolled students.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {q ? "No students match your search." : "No students yet. Add your first student or import a CSV."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
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
                          <p className="font-medium">{row.userName}</p>
                          {row.email && <p className="text-xs text-muted-foreground">{row.email}</p>}
                        </td>
                        <td className="px-2 py-2">{row.admissionNumber}</td>
                        <td className="px-2 py-2">
                          {row.className ? (
                            <span>
                              {row.className}
                              {row.streamName ? <span className="text-muted-foreground"> · {row.streamName}</span> : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 capitalize">{row.gender ?? "—"}</td>
                        <td className="px-2 py-2">
                          {row.email ? <Badge variant="secondary">Login ready</Badge> : <Badge variant="outline">No login</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}