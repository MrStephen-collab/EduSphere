import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import {
  getTraditionalEntryContext,
  getTraditionalReportCard,
  getTraditionalStudents,
} from "@/services/traditional-report-cards";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TraditionalReportCardFilters } from "@/components/report/traditional/traditional-report-card-filters";
import { TraditionalReportCardEntry } from "@/components/report/traditional/traditional-report-card-entry";

export const metadata: Metadata = {
  title: "Report Card Entry",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TeacherReportCardEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string; student?: string }>;
}) {
  const { class: classParam, term: termParam, student: studentParam } =
    await searchParams;

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (
    editor.role !== "TEACHER" &&
    editor.role !== "SCHOOL_ADMIN" &&
    editor.role !== "SCHOOL_OWNER"
  ) {
    redirect("/dashboard");
  }

  // A teacher must have a teacher record; without it every class query below
  // would fall back to "no filter" and show classes the teacher cannot save
  // for. Stop with an actionable message instead.
  if (editor.role === "TEACHER" && !editor.teacherId) {
    return (
      <DashboardShell title="Report Card Entry">
        <p className="text-sm text-muted-foreground">
          Your teacher profile isn&apos;t linked to this school yet — ask a
          school admin to add you to a class before entering report cards.
        </p>
      </DashboardShell>
    );
  }

  const teacherId = editor.role === "TEACHER" ? editor.teacherId : null;
  const context = await getTraditionalEntryContext(editor.schoolId, teacherId);

  if (context.classes.length === 0) {
    return (
      <DashboardShell title="Report Card Entry">
        <p className="text-sm text-muted-foreground">
          No classes are available yet — ask your school admin to create a class
          {editor.role === "TEACHER" ? " and link you to it" : ""}.
        </p>
      </DashboardShell>
    );
  }

  if (context.terms.length === 0) {
    return (
      <DashboardShell title="Report Card Entry">
        <p className="text-sm text-muted-foreground">
          This school has no terms yet — add a session and its terms before
          entering report cards.
        </p>
      </DashboardShell>
    );
  }

  const classId =
    context.classes.find((c) => c.id === classParam)?.id ??
    context.defaultClassId ??
    context.classes[0].id;
  const termId =
    context.terms.find((t) => t.id === termParam)?.id ??
    context.defaultTermId ??
    context.terms[0].id;

  const students = await getTraditionalStudents(
    editor.schoolId,
    classId,
    teacherId,
  );

  if (students.length === 0) {
    return (
      <DashboardShell title="Report Card Entry">
        <div className="grid gap-4">
          <TraditionalReportCardFilters
            classes={context.classes}
            terms={context.terms}
            students={students}
            classId={classId}
            termId={termId}
            studentId=""
          />
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No students are enrolled in this class yet.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const student =
    students.find((s) => s.id === studentParam) ?? students[0];

  const record = await getTraditionalReportCard(
    editor.schoolId,
    student.id,
    termId,
    teacherId,
  );

  if (!record) {
    return (
      <DashboardShell title="Report Card Entry">
        <div className="grid gap-4">
          <TraditionalReportCardFilters
            classes={context.classes}
            terms={context.terms}
            students={students}
            classId={classId}
            termId={termId}
            studentId={student.id}
          />
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This student&apos;s report card isn&apos;t available for your account.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Report Card Entry">
      <div className="grid gap-4">
        <TraditionalReportCardFilters
          classes={context.classes}
          terms={context.terms}
          students={students}
          classId={classId}
          termId={termId}
          studentId={student.id}
        />
        <TraditionalReportCardEntry
          key={`${classId}:${termId}:${student.id}`}
          students={students}
          selection={{ classId, termId, studentId: student.id }}
          record={record}
        />
      </div>
    </DashboardShell>
  );
}
