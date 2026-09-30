import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { getReportOptions } from "@/services/report-cards";
import { getTimetableGrid, getTimetablePeriods } from "@/services/timetable";
import { saveTimetableCellAction, clearTimetableCellAction } from "@/app/timetable/actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TimetableEditor } from "@/components/timetable/timetable-editor";
import { TimetableFilters } from "@/components/timetable/timetable-filters";
import { PeriodManager } from "@/components/timetable/period-manager";

export const metadata: Metadata = {
  title: "Timetable",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchoolTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; session?: string }>;
}) {
  const { class: classParam, session: sessionParam } = await searchParams;

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  const options = await getReportOptions(editor.schoolId);

  // The current session by default, so the page opens on the timetable that is
  // actually running rather than the newest one created.
  const currentSession =
    options.sessions.find((s) => s.is_current) ?? options.sessions[0] ?? null;
  const session =
    options.sessions.find((s) => s.id === sessionParam) ?? currentSession;
  const cls =
    options.classes.find((c) => c.id === classParam) ?? options.classes[0] ?? null;

  if (!session || !cls) {
    return (
      <DashboardShell title="Timetable" badge="School">
        <p className="text-sm text-muted-foreground">
          A timetable needs at least one academic session and one class. Set those
          up first.
        </p>
      </DashboardShell>
    );
  }

  const [grid, periods] = await Promise.all([
    getTimetableGrid({
      schoolId: editor.schoolId,
      sessionId: session.id,
      classId: cls.id,
      withOptions: true,
    }),
    getTimetablePeriods(editor.schoolId),
  ]);

  return (
    <DashboardShell title="Timetable" badge="School">
      <div className="grid gap-4">
        <TimetableFilters
          sessions={options.sessions.map((s) => ({ id: s.id, name: s.name }))}
          classes={options.classes}
          sessionId={session.id}
          classId={cls.id}
        />

        <PeriodManager periods={periods} />

        {!periods.length ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This school has no periods yet. Add the shape of the school day above,
            then fill in the grid.
          </p>
        ) : (
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
          />
        )}

        <p className="text-xs text-muted-foreground">
          Periods belong to the whole school, so the bell times set here apply to
          every class. Lessons are per class and per session, so last year&apos;s
          grid survives a new session.
        </p>
      </div>
    </DashboardShell>
  );
}
