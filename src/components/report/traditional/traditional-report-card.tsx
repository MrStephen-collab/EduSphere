"use client";

import { type TraditionalReportData } from "@/lib/traditional-report";

export type { TraditionalReportData };

function Check({ value, target }: { value?: string | null; target: string }) {
  return <span className="inline-block w-4 text-center">{value === target ? "✓" : ""}</span>;
}

export function TraditionalReportCard({ data }: { data: TraditionalReportData }) {
  const subjects = data.subjects;
  const affective = data.affective;
  const psychomotor = data.psychomotor;

  return (
    <div className="mx-auto w-[210mm] bg-white text-black print:w-full print:max-w-none" style={{ fontFamily: "Times New Roman, serif" }}>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="flex items-start gap-3 border-b-2 border-[#006400] pb-2">
        <div className="h-16 w-16 flex-shrink-0">
          {data.school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.school.logoUrl} alt="School crest" className="h-16 w-16 object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#006400] text-xs font-bold text-[#006400]">LOGO</div>
          )}
        </div>
        <div className="flex-1 text-center">
          <h1 className="text-[18px] font-bold uppercase tracking-wide text-[#006400]">{data.school.name}</h1>
          <p className="text-[9px] leading-tight">{data.school.address}{data.school.phone ? ` • Tel: ${data.school.phone}` : ""}</p>
          <h2 className="mt-1 text-[14px] font-bold uppercase tracking-widest text-[#8B0000]">END OF TERM REPORT SHEET</h2>
        </div>
        <div className="h-16 w-16 flex-shrink-0" />
      </header>

      <section className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-[9px]">
        <div className="col-span-2 flex items-center gap-2"><span className="font-semibold">NAME OF PUPIL:</span><span className="flex-1 border-b border-black">{data.student.fullName}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">SEX:</span><span className="flex-1 border-b border-black">{data.student.sex ?? ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">SESSION:</span><span className="flex-1 border-b border-black">{data.student.session}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">TERM:</span><span className="flex-1 border-b border-black">{data.student.term}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">CLASS:</span><span className="flex-1 border-b border-black">{data.student.className}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">HOUSE:</span><span className="flex-1 border-b border-black">{data.student.house ?? ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">ADM. NO.:</span><span className="flex-1 border-b border-black">{data.student.admissionNo}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">NO. ON ROLL:</span><span className="flex-1 border-b border-black">{data.student.noOnRoll ?? ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">POSITION IN CLASS:</span><span className="flex-1 border-b border-black">{data.student.position ?? ""}{data.student.totalInClass ? ` OUT OF ${data.student.totalInClass}` : ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">NO. OF TIMES SCHOOL OPENED:</span><span className="flex-1 border-b border-black">{data.student.daysOpened ?? ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">NO. OF TIMES PRESENT:</span><span className="flex-1 border-b border-black">{data.student.daysPresent ?? ""}</span></div>
        <div className="flex items-center gap-2"><span className="font-semibold">NO. OF TIMES ABSENT:</span><span className="flex-1 border-b border-black">{data.student.daysAbsent ?? ""}</span></div>
      </section>

      <section className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[7.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black p-0.5 text-left">SUBJECTS</th>
              <th colSpan={3} className="border border-black p-0.5">TESTS</th>
              <th rowSpan={2} className="border border-black p-0.5">TOTAL TESTS</th>
              <th rowSpan={2} className="border border-black p-0.5">ETT/EXAM</th>
              <th rowSpan={2} className="border border-black p-0.5">OVERALL SCORE (100%)</th>
              <th rowSpan={2} className="border border-black p-0.5">LAST TERM SCORE</th>
              <th rowSpan={2} className="border border-black p-0.5">CUMULATIVE SCORE</th>
              <th rowSpan={2} className="border border-black p-0.5">CLASS AVERAGE</th>
              <th rowSpan={2} className="border border-black p-0.5">POSITION</th>
              <th rowSpan={2} className="border border-black p-0.5">SUBJECT GRADE</th>
              <th rowSpan={2} className="border border-black p-0.5">TEACHER&apos;S REMARK &amp; SIGNATURE</th>
            </tr>
            <tr>
              <th className="border border-black p-0.5">TEST 1</th>
              <th className="border border-black p-0.5">TEST 2</th>
              <th className="border border-black p-0.5">TEST 3</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={i}>
                <td className="border border-black p-0.5 text-left">{s.name}</td>
                <td className="border border-black p-0.5 text-center">{s.test1 ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.test2 ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.test3 ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.totalTests ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.exam ?? ""}</td>
                <td className="border border-black p-0.5 text-center font-semibold">{s.overall ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.lastTerm ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.cumulative ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.classAvg ?? ""}</td>
                <td className="border border-black p-0.5 text-center">{s.position ?? ""}</td>
                <td className="border border-black p-0.5 text-center font-semibold">{s.grade ?? ""}</td>
                <td className="border border-black p-0.5">{s.remark ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-2 grid grid-cols-2 gap-2 text-[8px]">
        <div>
          <div className="border border-black">
            <div className="border-b border-black bg-gray-50 text-center font-bold">AFFECTIVE DISPOSITION</div>
            <table className="w-full">
              <thead>
                <tr><th className="border-r border-black p-0.5 text-left">TRAITS</th><th className="border-r border-black p-0.5">A</th><th className="border-r border-black p-0.5">B</th><th className="border-r border-black p-0.5">C</th><th className="border-r border-black p-0.5">D</th><th className="p-0.5">E</th></tr>
              </thead>
              <tbody>
                {affective.map((a, i) => (
                  <tr key={i}>
                    <td className="border-r border-t border-black p-0.5">{a.name}</td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={a.value} target="A" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={a.value} target="B" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={a.value} target="C" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={a.value} target="D" /></td>
                    <td className="border-t border-black p-0.5 text-center"><Check value={a.value} target="E" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="border border-black">
            <div className="border-b border-black bg-gray-50 text-center font-bold">PSYCHOMOTOR SKILLS</div>
            <table className="w-full">
              <thead>
                <tr><th className="border-r border-black p-0.5 text-left">SKILLS</th><th className="border-r border-black p-0.5">A</th><th className="border-r border-black p-0.5">B</th><th className="border-r border-black p-0.5">C</th><th className="border-r border-black p-0.5">D</th><th className="p-0.5">E</th></tr>
              </thead>
              <tbody>
                {psychomotor.map((p, i) => (
                  <tr key={i}>
                    <td className="border-r border-t border-black p-0.5">{p.name}</td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={p.value} target="A" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={p.value} target="B" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={p.value} target="C" /></td>
                    <td className="border-r border-t border-black p-0.5 text-center"><Check value={p.value} target="D" /></td>
                    <td className="border-t border-black p-0.5 text-center"><Check value={p.value} target="E" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1 border border-black p-1 text-[7.5px]">
            <div className="font-bold">GRADE INTERPRETATION: A = Excellent, B = Good, C = Average, D = Fair, E = Poor</div>
          </div>
        </div>
      </section>

      <section className="mt-2 grid grid-cols-2 gap-2 text-[8px]">
        <div className="border border-black">
          <div className="border-b border-black px-1 font-bold">CLASS TEACHER&apos;S COMMENT</div>
          <div className="min-h-[40px] px-1 py-0.5">{data.comments.classTeacher || ""}</div>
          <div className="flex items-end justify-between px-1 pb-1">
            <div className="flex-1"><span className="font-semibold">Name:</span> <span className="border-b border-black inline-block w-24">{data.comments.classTeacherName || ""}</span></div>
            <div><span className="font-semibold">Signature/Date:</span> <span className="border-b border-black inline-block w-24">{data.comments.classTeacherDate || ""}</span></div>
          </div>
        </div>
        <div className="border border-black">
          <div className="border-b border-black px-1 font-bold">PRINCIPAL&apos;S COMMENT</div>
          <div className="min-h-[40px] px-1 py-0.5">{data.comments.principal || ""}</div>
          <div className="flex items-end justify-between px-1 pb-1">
            <div className="flex-1"><span className="font-semibold">Name:</span> <span className="border-b border-black inline-block w-24">{data.comments.principalName || ""}</span></div>
            <div><span className="font-semibold">Signature/Date:</span> <span className="border-b border-black inline-block w-24">{data.comments.principalDate || ""}</span></div>
          </div>
        </div>
      </section>

      <section className="mt-2 flex items-end justify-between text-[8px]">
        <div className="flex items-center gap-2"><span className="font-bold">NEXT TERM BEGINS:</span><span className="border-b border-black inline-block w-40">{data.comments.nextTermBegins || ""}</span></div>
        <div className="text-center">
          <div className="h-12 w-24 border border-dashed border-black">
            {data.stampUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.stampUrl} alt="Stamp" className="h-12 w-24 object-contain" />
            ) : null}
          </div>
          <div className="mt-0.5 font-semibold">SCHOOL STAMP</div>
        </div>
      </section>
    </div>
  );
}
