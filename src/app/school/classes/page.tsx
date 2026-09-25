import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getClasses, getStreams } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInlineForm } from "@/components/school/forms";
import {
  createClassAction,
  createStreamAction,
  deleteClassAction,
} from "@/app/school/actions";

export const metadata: Metadata = {
  title: "Classes & streams",
  robots: { index: false, follow: false },
};

export default async function ClassesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [classes, streams] = await Promise.all([
    getClasses(schoolId),
    getStreams(schoolId),
  ]);

  return (
    <DashboardShell title="Classes & Streams">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>
              Class groupings used across subjects, courses and results (e.g. JSS 1, SS 2).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateInlineForm
              onSubmit={createClassAction}
              placeholder="e.g. JSS 1"
              items={classes.map((c) => ({ id: c.id, name: c.name }))}
              onDelete={deleteClassAction}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Streams</CardTitle>
            <CardDescription>
              Arm/stream labels within a class (e.g. A, B, Gold).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateInlineForm
              onSubmit={createStreamAction}
              placeholder="e.g. A"
              items={streams.map((s) => ({ id: s.id, name: s.name }))}
            />
          </CardContent>
        </Card>
      </div>

      {classes.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Add a class to start assigning students, courses and examinations.
        </p>
      )}
    </DashboardShell>
  );
}