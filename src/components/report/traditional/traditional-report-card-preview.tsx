"use client";

import { TraditionalReportCard, type TraditionalReportData } from "./traditional-report-card";

export function TraditionalReportCardPreview() {
  const data: TraditionalReportData = {
    school: {
      name: "BRIGHTER FUTURE PRE-VERSITY INT'L ACADEMY",
      address: "Brighter Future Close, P.O. Box 4420, Igoba, Akure, Ondo State, Nigeria.",
      phone: "0803 123 4567, 0702 987 6543",
    },
    student: {
      fullName: "ADEBAYO TOLUWANI MICHELLE",
      admissionNo: "BF/2024/JS3/045",
      className: "JSS 3",
      sex: "FEMALE",
      house: "SUNSHINE",
      session: "2024/2025",
      term: "THIRD TERM",
      noOnRoll: 38,
      position: 5,
      totalInClass: 38,
      daysOpened: 112,
      daysPresent: 108,
      daysAbsent: 4,
    },
    subjects: [
      { name: "English Language", test1: 18, test2: 17, test3: 16, exam: 48, overall: 99, lastTerm: 94, cumulative: 96, classAvg: 76, position: 2, grade: "A", remark: "Excellent" },
      { name: "Mathematics", test1: 19, test2: 18, test3: 17, exam: 46, overall: 100, lastTerm: 98, cumulative: 99, classAvg: 72, position: 1, grade: "A", remark: "Outstanding" },
      { name: "Basic Science & Technology", test1: 17, test2: 16, test3: 16, exam: 44, overall: 93, lastTerm: 90, cumulative: 92, classAvg: 74, position: 3, grade: "A", remark: "Very Good" },
      { name: "Social Studies", test1: 16, test2: 17, test3: 15, exam: 42, overall: 90, lastTerm: 88, cumulative: 89, classAvg: 75, position: 4, grade: "A", remark: "Very Good" },
      { name: "Civic Education", test1: 18, test2: 16, test3: 17, exam: 43, overall: 94, lastTerm: 91, cumulative: 93, classAvg: 76, position: 2, grade: "A", remark: "Excellent" },
      { name: "Computer Studies", test1: 19, test2: 18, test3: 17, exam: 45, overall: 99, lastTerm: 96, cumulative: 98, classAvg: 78, position: 1, grade: "A", remark: "Excellent" },
      { name: "Creative & Cultural Art", test1: 18, test2: 17, test3: 18, exam: 42, overall: 95, lastTerm: 93, cumulative: 94, classAvg: 77, position: 2, grade: "A", remark: "Very Good" },
      { name: "Christian Religious Studies", test1: 17, test2: 18, test3: 16, exam: 44, overall: 95, lastTerm: 92, cumulative: 94, classAvg: 76, position: 2, grade: "A", remark: "Very Good" },
    ],
    affective: [
      { name: "Punctuality", value: "A" }, { name: "Attentiveness", value: "A" }, { name: "Honesty", value: "A" },
      { name: "Leadership", value: "B" }, { name: "Helping Others", value: "A" }, { name: "Emotional Stability", value: "A" },
      { name: "Health", value: "A" }, { name: "Attitude to School Work", value: "A" },
    ],
    psychomotor: [
      { name: "Verbal Fluency", value: "A" }, { name: "Musical Skills", value: "B" }, { name: "Sports", value: "B" },
      { name: "Drawing & Painting", value: "A" }, { name: "Handling Tools", value: "B" }, { name: "Hand Work", value: "A" }, { name: "Versatility", value: "A" },
    ],
    comments: {
      classTeacher: "A hardworking and well-behaved pupil. She has shown great improvement and consistently performs above average.",
      classTeacherName: "Miss A. Johnson",
      classTeacherDate: "12/07/2025",
      principal: "An excellent performance. Keep up the good work and aim even higher.",
      principalName: "Mrs. O. Adeyemi",
      principalDate: "15/07/2025",
      nextTermBegins: "08/09/2025",
    },
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Traditional Report Card Preview (A4)</h1>
        <button onClick={() => window.print()} className="rounded-md border px-3 py-1.5 text-sm">Print</button>
      </div>
      <div className="overflow-auto rounded-lg border bg-gray-100 p-4">
        <TraditionalReportCard data={data} />
      </div>
    </div>
  );
}
