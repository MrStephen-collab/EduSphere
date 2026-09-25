import type { StudentReportCard } from "@/services/report-cards";

export function ReportCardPaper({ report }: { report: StudentReportCard }) {
  const { school, student, subjects } = report;
  const hasResults = subjects.length > 0;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
      <div className="grid gap-6">
        <header className="flex items-center justify-between gap-4 border-b pb-4 print:border-foreground/20">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {school.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">{school.name}</p>
              {school.motto && (
                <p className="text-xs italic text-muted-foreground">{school.motto}</p>
              )}
              {(school.address || school.city || school.state) && (
                <p className="text-xs text-muted-foreground">
                  {[school.address, school.city, school.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide">Report card</p>
            <p className="text-xs text-muted-foreground">
              {report.scopeName}
              {report.scopePeriod ? ` · ${report.scopePeriod}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated {new Date(report.generatedAt).toLocaleDateString()}
            </p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Student</p>
            <p className="font-medium">{student.displayName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Class</p>
            <p className="font-medium">{student.className ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admission no.</p>
            <p className="font-medium">{student.admissionNumber}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Stream</p>
            <p className="font-medium capitalize">{student.streamName ?? "—"}</p>
          </div>
        </section>

        {hasResults ? (
          <section className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">Teacher</th>
                  <th className="py-2 pr-3 text-right font-medium">Assignments %</th>
                  <th className="py-2 pr-3 text-right font-medium">CBT best %</th>
                  <th className="py-2 pr-3 text-right font-medium">Total %</th>
                  <th className="py-2 pr-3 text-right font-medium">Grade</th>
                  <th className="py-2 text-right font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr key={s.subjectId ?? i} className="border-b">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{s.teacherName ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{s.assignmentAverage ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{s.practiceBest ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      {s.total ?? "—"}
                      {s.total != null ? "%" : ""}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{s.grade ?? "—"}</td>
                    <td className="py-2 text-right text-muted-foreground">{s.remark ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No graded assignments or completed practice attempts for this period yet —
            scores appear here once you have submitted work.
          </p>
        )}

        <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall average</p>
            <p className="text-2xl font-bold">
              {report.overall != null ? `${report.overall}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Grade</p>
            <p className="text-2xl font-bold">{report.grade ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remark</p>
            <p className="font-medium">{report.remark ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Class position</p>
            <p className="font-medium">
              {report.position != null && report.totalStudents > 0
                ? `${report.position} of ${report.totalStudents}`
                : "—"}
            </p>
          </div>
        </section>

        <section className="rounded-md border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Attendance</p>
          {report.attendance && report.attendance.classDays > 0 ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Days present</p>
                <p className="font-semibold">
                  {report.attendance.present} of {report.attendance.classDays}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attendance rate</p>
                <p className="font-semibold">
                  {report.attendance.rate != null ? `${report.attendance.rate}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absences</p>
                <p className="font-semibold">{report.attendance.absent}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Times late / excused</p>
                <p className="font-semibold">
                  {report.attendance.late} / {report.attendance.excused}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No attendance recorded for this period yet.
            </p>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Assignments % is the average of graded continuous assessments; CBT best % is the
          student&apos;s top score in published exam-series practice for the period. Days present
          combine present and late marks out of the school days the class register was opened for
          the period; absent and excused days are shown separately.
        </p>

        <footer className="grid gap-8 border-t pt-6 text-xs sm:grid-cols-2">
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Class teacher&apos;s signature</p>
          </div>
          <div className="text-center">
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Head of school</p>
          </div>
        </footer>
      </div>
    </div>
  );
}