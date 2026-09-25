import type { ClassReport } from "@/services/report-cards";

export function ClassReportSheet({ report }: { report: ClassReport }) {
  const { school } = report;
  const subjectColumns = report.subjectColumns;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
      <header className="flex items-center justify-between gap-4 border-b pb-4 print:border-foreground/20">
        <div>
          <p className="text-lg font-semibold leading-tight">{school.name}</p>
          <p className="text-xs text-muted-foreground">
            Termly results — {report.className} · {report.scopeName}
            {report.scopePeriod ? ` (${report.scopePeriod})` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{report.students.length} student{report.students.length === 1 ? "" : "s"}</p>
          <p>Generated {new Date(report.generatedAt).toLocaleDateString()}</p>
        </div>
      </header>

      {report.students.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No students are enrolled in this class yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Student</th>
                <th className="py-2 pr-3 font-medium">Ad no.</th>
                {subjectColumns.map((name) => (
                  <th key={name} className="py-2 pr-3 text-right font-medium">
                    {name}
                  </th>
                ))}
                <th className="py-2 pr-3 text-right font-medium">Total %</th>
                <th className="py-2 pr-3 text-right font-medium">Grade</th>
                <th className="py-2 pr-3 text-right font-medium">Attendance %</th>
                <th className="py-2 text-right font-medium">Pos</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((s) => (
                <tr key={s.studentId} className="border-b">
                  <td className="py-2 pr-2 text-muted-foreground">{s.position}</td>
                  <td className="py-2 pr-3 font-medium">{s.displayName}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{s.admissionNumber}</td>
                  {subjectColumns.map((name) => {
                    const subject = s.subjects.find((x) => x.name === name);
                    return (
                      <td key={name} className="py-2 pr-3 text-right">
                        {subject ? (
                          <span>
                            {subject.total ?? "—"}
                            {subject.total != null && subject.grade ? ` · ${subject.grade}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 text-right font-semibold">
                    {s.overall != null ? `${s.overall}%` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{s.grade ?? "—"}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">
                    {s.attendance.rate != null ? `${s.attendance.rate}%` : "—"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{s.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Cells show the combined total (assignment average + CBT best) for each subject,
        with the grade letter after the figure. Total % is the student&apos;s average across
        subjects with scored work for the period. Attendance % is days present (including
        late) out of the days the class register was opened; — means no register yet.
      </p>
    </div>
  );
}