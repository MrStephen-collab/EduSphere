import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getParents, getStudents } from "@/services/people";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ParentForm } from "@/components/school/people-form";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Parents",
  robots: { index: false, follow: false },
};

export default async function ParentsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [parents, students] = await Promise.all([
    getParents(schoolId),
    getStudents(schoolId),
  ]);

  const rows = parents.map((p) => ({
    id: p.id,
    name: asArray(p.profile)[0]?.full_name ?? p.display_name ?? "Unnamed parent",
    email: asArray(p.profile)[0]?.email ?? null,
    relationship: p.relationship,
    hasAccount: !!p.user_id,
  }));

  return (
    <DashboardShell title="Parents">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add parent</CardTitle>
            <CardDescription>
              Parents see their linked children&apos;s results, assignments and progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ParentForm
              students={students.map((s) => ({
                id: s.id,
                name: asArray(s.profile)[0]?.full_name ?? s.display_name ?? s.admission_number,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parents ({rows.length})</CardTitle>
            <CardDescription>Everyone connected to students at your school.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parents yet. Add a parent and link their children.
              </p>
            ) : (
              <ul className="grid gap-2">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.email ?? "No email (no login yet)"}
                        {row.relationship ? ` · ${row.relationship}` : ""}
                      </p>
                    </div>
                    {row.hasAccount && <span className="text-xs text-muted-foreground">Account ready</span>}
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