import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { getReportOptions } from "@/services/report-cards";
import { getTimetableGrid } from "@/services/timetable";
import { saveTimetableCellAction, clearTimetableCellAction } from "@/app/timetable/actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TimetableEditor } from "@/components/timetable/timetable-editor";
import { TimetableFilters } from "@/components/timetable/timetable-filters";

export const metadata: Metadata = {
  title: "Timetable",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TeacherTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; session?: string }>;
}) {
  const { class: classParam, session: sessionParam } = await searchParams;

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER") {
    // Only teachers edit a timetable from this side. A school admin who lands
    // here belongs on /school/timetable, which is the page that can also move
    // the bell and reassign colleagues.
    redirect("/school/timetable");
  }

  // getReportOptions narrows the class list to the classes this teacher is
  // assigned to, so the picker cannot offer a class the database will refuse.
  const options = await getReportOptions(editor.schoolId, editor.teacherId);

  if (!options.classes.length) {
    return (
      <DashboardShell title="Timetable" badge="Teacher">
        <p className="text-sm text-muted-foreground">
          No classes assigned yet — ask your school admin to link you to a class.
        </p>
      </DashboardShell>
    );
  }

  const currentSession = options.sessions.find((s) => s.is_current) ?? options.sessions[0] ?? null;
  const session = options.sessions.find((s) => s.id === sessionParam) ?? currentSession;
  const cls = options.classes.find((c) => c.id === classParam) ?? options.classes[0] ?? null;

  if (!session || !cls) {
    return (
      <DashboardShell title="Timetable" badge="Teacher">
        <p className="text-sm text-muted-foreground">
          A timetable needs at least one academic session and one class assigned
          to you.
        </p>
      </DashboardShell>
    );
  }

  const grid = await getTimetableGrid({
    schoolId: editor.schoolId,
    sessionId: session.id,
    classId: cls.id,
    withOptions: true,
  });

  return (
    <DashboardShell title="Timetable" badge="Teacher">
      <div className="grid gap-4">
        <TimetableFilters
          sessions={options.sessions.map((s) => ({ id: s.id, name: s.name }))}
          classes={options.classes}
          sessionId={session.id}
          classId={cls.id}
        />

        {grid.periods.length ? (
          <TimetableEditor
            key={`${cls.id}-${session.id}`}
            classId={cls.id}
            sessionId={session.id}
            periods={grid.periods}
            cells={grid.cells}
            subjectOptions={grid.subjectOptions}
            teacherOptions={grid.teacherOptions}
            onSave={saveTimetableCellAction}
            onClear={clearTimetableCellAction}
            readOnlySubjects
          />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Your school admin has not set up the school day yet. Once they add the
            periods, you can fill in what you teach.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          You can set what each of your classes studies and when. A school admin
          assigns the teachers.
        </p>
      </div>
    </DashboardShell>
  );
}
