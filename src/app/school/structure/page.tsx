import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSchoolLevel } from "@/services/schools";
import { getClasses, getDepartments } from "@/services/academics";
import { getLevelDefinition } from "@/lib/education/levels";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DepartmentManager,
  EducationLevelPicker,
} from "@/components/school/structure-forms";

export const metadata: Metadata = {
  title: "School structure",
  robots: { index: false, follow: false },
};

export default async function StructurePage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [level, departments, classes] = await Promise.all([
    getSchoolLevel(schoolId),
    getDepartments(schoolId),
    getClasses(schoolId),
  ]);

  const definition = getLevelDefinition(level);
  // Counted here rather than per department: one query for every class is cheaper
  // than one query per department, and a school has tens of classes, not tens of
  // thousands.
  const counts = new Map<string, number>();
  for (const row of classes) {
    if (!row.department_id) continue;
    counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
  }

  return (
    <DashboardShell title="School structure">
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Education level</CardTitle>
            <CardDescription>
              What this school teaches. The level decides what classes are called, whether
              they are grouped by {definition.groupNoun?.toLowerCase() ?? "department"}, and
              whether teachers get the Courses and Lessons menus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EducationLevelPicker schoolId={schoolId} level={level} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{definition.groupNoun ?? "Departments"}</CardTitle>
            <CardDescription>
              {definition.groupNoun
                ? `Classes and courses are grouped under a ${definition.groupNoun.toLowerCase()}. This school currently behaves as ${definition.label.toLowerCase()}, so these are optional — a school can change its level at any time and nothing already set up here is renamed.`
                : `${definition.label} schools group classes by subject rather than by ${definition.groupNoun?.toLowerCase() ?? "department"}. Set the level to college, polytechnic or university to use them; they will still be kept if you set one later, so nothing added now is wasted.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentManager
              departments={departments.map((department) => ({
                id: department.id,
                name: department.name,
                classCount: counts.get(department.id) ?? 0,
              }))}
              groupNoun={definition.groupNoun ?? "Department"}
            />
            {definition.groupNoun && (
              <p className="mt-3 text-sm text-muted-foreground">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  render={<Link href="/school/classes" />}
                >
                  Go to classes
                </Button>{" "}
                to create classes under them.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}