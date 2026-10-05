import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getClasses, getDepartments, getStreams } from "@/services/academics";
import { getSchoolLevel } from "@/services/schools";
import { getLevelDefinition } from "@/lib/education/levels";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateInlineForm } from "@/components/school/forms";
import { ClassCreateForm, ClassList } from "@/components/school/class-form";
import { createStreamAction } from "@/app/school/actions";
import type { EducationLevel } from "@/types/database";

export const metadata: Metadata = {
  title: "Classes & streams",
  robots: { index: false, follow: false },
};

export default async function ClassesPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [classes, streams, departments, level] = await Promise.all([
    getClasses(schoolId),
    getStreams(schoolId),
    getDepartments(schoolId),
    getSchoolLevel(schoolId),
  ]);

  const definition = getLevelDefinition(level);
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <DashboardShell title="Classes & Streams">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{definition.pluralClassNoun}</CardTitle>
            <CardDescription>
              Class groupings used across subjects, courses and results
              {describeConvention(level, departments.length)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ClassCreateForm level={level} departments={departments} />
            {classes.length > 0 && (
              <ClassList
                classes={classes.map((row) => ({
                  id: row.id,
                  name: row.name,
                  programme: row.programme,
                  departmentName: row.department_id
                    ? (departmentNames.get(row.department_id) ?? null)
                    : null,
                }))}
              />
            )}
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

/**
 * The naming convention this level implies, in one clause.
 *
 * The form already offers the right names as suggestions, so this is only here to
 * explain why they are what they are — a secondary school's "JSS 1" looks odd
 * until you know the school declared itself secondary.
 */
function describeConvention(
  level: EducationLevel | null,
  departmentCount: number,
): string {
  const definition = getLevelDefinition(level);
  if (definition.programmes.length > 0) {
    return departmentCount > 0
      ? ` — ${definition.programmes.join(" and ")} years within each ${definition.groupNoun?.toLowerCase()}`
      : ` — ${definition.programmes.join(" and ")} years`;
  }
  if (definition.groupNoun) {
    return departmentCount > 0
      ? ` — one per year within each ${definition.groupNoun.toLowerCase()}`
      : ` — add a ${definition.groupNoun.toLowerCase()} in School structure to qualify them`;
  }
  return " (e.g. JSS 1, SS 2)";
}