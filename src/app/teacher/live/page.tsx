import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { getReportOptions } from "@/services/report-cards";
import { getTeacherLiveSessions } from "@/services/live";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LiveSessionForm } from "@/components/live/live-session-form";
import { LiveSessionList } from "@/components/live/live-session-list";
import { LiveAttendanceRegister } from "@/components/live/live-attendance-register";

export const metadata: Metadata = {
  title: "Live teaching",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TeacherLivePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER") redirect("/school/live");

  const options = await getReportOptions(editor.schoolId, editor.teacherId);
  const { sessions, register } = await getTeacherLiveSessions({
    schoolId: editor.schoolId,
    teacherId: editor.teacherId,
    sessionId: sessionParam ?? null,
  });

  const selected = sessions.find((s) => s.id === sessionParam) ?? sessions[0] ?? null;

  return (
    <DashboardShell title="Live teaching" badge="Teacher">
      <div className="grid gap-4">
        {!options.classes.length ? (
          <p className="text-sm text-muted-foreground">
            No classes assigned yet — ask your school admin to link you to a class
            before scheduling a session.
          </p>
        ) : (
          <>
            <LiveSessionForm classes={options.classes} />
            <LiveSessionList
              sessions={sessions}
              now={new Date().toISOString()}
              emptyMessage="No live sessions yet."
            />
            {selected && register && (
              <LiveAttendanceRegister
                key={selected.id}
                sessionId={selected.id}
                sessionTitle={selected.title}
                entries={register.entries}
              />
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Students see a session only once it is announced. Un-announcing hides it
          again without deleting the schedule or the register.
        </p>
      </div>
    </DashboardShell>
  );
}
