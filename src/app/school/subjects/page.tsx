import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSubjects } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInlineForm } from "@/components/school/forms";
import { createSubjectAction, deleteSubjectAction } from "@/app/school/actions";

export const metadata: Metadata = {
  title: "Subjects",
  robots: { index: false, follow: false },
};

export default async function SubjectsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();
  const subjects = await getSubjects(schoolId);

  return (
    <DashboardShell title="Subjects">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add a subject</CardTitle>
            <CardDescription>
              Subjects appear in course creation, question banks and results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateInlineForm
              onSubmit={createSubjectAction}
              placeholder="e.g. Mathematics"
              extraPlaceholder="Code (e.g. MAT)"
              extraLabel="Subject code"
              items={subjects.map((s) => ({ id: s.id, name: s.name, extra: s.code ?? undefined }))}
              onDelete={deleteSubjectAction}
            />
          </CardContent>
        </Card>
      </div>
      {subjects.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Add subjects so teachers can organise courses, lessons and examinations.
        </p>
      )}
    </DashboardShell>
  );
}