import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireContentEditor } from "@/services/shared";
import { getReportOptions } from "@/services/report-cards";
import type { ReportOptions } from "@/services/report-cards";
import { getClassRegister } from "@/services/attendance";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { AttendanceRegister } from "@/components/attendance/attendance-register";

export const metadata: Metadata = {
  title: "Attendance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function resolveClass(
  options: ReportOptions,
  classId: string | null | undefined,
) {
  return (
    options.classes.find((c) => c.id === classId) ?? options.classes[0] ?? null
  );
}

function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function validDateParam(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value <= todayKey()
  );
}

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const { class: classParam, date: dateParam } = await searchParams;

  const editor = await requireContentEditor();
  if (!editor.context.user) redirect("/auth/login");
  if (editor.role !== "TEACHER" && editor.role !== "SCHOOL_ADMIN" && editor.role !== "SCHOOL_OWNER") {
    redirect("/dashboard");
  }

  const teacherId = editor.role === "TEACHER" ? editor.teacherId : null;
  const options = await getReportOptions(editor.schoolId, teacherId);

  if (!options.classes.length) {
    return (
      <DashboardShell title="Attendance" badge="Teacher">
        <p className="text-sm text-muted-foreground">
          No classes assigned yet — ask your school admin to link you to a class.
        </p>
      </DashboardShell>
    );
  }

  const cls = resolveClass(options, classParam);
  const date = validDateParam(dateParam) ? dateParam : todayKey();

  const register = await getClassRegister(editor.schoolId, cls!.id, date, teacherId);

  return (
    <DashboardShell title="Attendance" badge="Teacher">
      <div className="grid gap-4">
        <AttendanceFilters
          classes={options.classes}
          classId={cls!.id}
          date={date}
        />

        {register ? (
          <AttendanceRegister
            key={`${cls!.id}-${date}`}
            classId={cls!.id}
            date={date}
            entries={register.entries}
          />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Attendance for this class and date isn&apos;t available.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Marks are saved per student per day. Present and late days count as days
          present on report cards; absent and excused days are shown separately.
        </p>
      </div>
    </DashboardShell>
  );
}