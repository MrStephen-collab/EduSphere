import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getTeachers } from "@/services/people";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherForm } from "@/components/school/people-form";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Teachers",
  robots: { index: false, follow: false },
};

export default async function TeachersPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();
  const teachers = await getTeachers(schoolId);

  const rows = teachers.map((t) => ({
    id: t.id,
    name: asArray(t.profile)[0]?.full_name ?? t.display_name ?? "Unnamed teacher",
    email: asArray(t.profile)[0]?.email ?? null,
    hasAccount: !!t.user_id,
  }));

  return (
    <DashboardShell title="Teachers">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add teacher</CardTitle>
            <CardDescription>
              Teachers with an email get a login account (default password from{" "}
              <code className="rounded bg-muted px-1">DEFAULT_ACCOUNT_PASSWORD</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeacherForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teachers ({rows.length})</CardTitle>
            <CardDescription>Everyone currently on your staff.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teachers yet. Add your first teacher.</p>
            ) : (
              <ul className="grid gap-2">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.email ?? "No email (no login yet)"}
                        {row.hasAccount ? " · account ready" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}