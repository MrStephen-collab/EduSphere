"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TraditionalReportCard } from "./traditional-report-card";

const SUBJECTS = [
  "English Language", "Dictation", "Mathematics", "Basic Science & Technology",
  "Pre-Vocational Studies", "Business Studies", "Religion & National Values 1",
  "Religion & National Values 2", "Creative & Cultural Art", "Civic Education",
  "Animal Husbandry", "Computer Studies", "Chemistry", "Geography",
  "Further Mathematics", "Biology", "Physics", "Agricultural Science",
  "Economics", "History", "Government", "Christian Religious Studies",
  "Music (GNS)", "Yoruba"
];
const AFFECTIVE = ["Punctuality", "Attentiveness", "Honesty", "Leadership", "Helping Others", "Emotional Stability", "Health", "Attitude to School Work"];
const PSYCHOMOTOR = ["Verbal Fluency", "Musical Skills", "Sports", "Drawing & Painting", "Handling Tools", "Hand Work", "Versatility"];

export function TraditionalReportCardEntry() {
  const [studentName, setStudentName] = useState("ADEBAYO TOLUWANI MICHELLE");
  const [admissionNo, setAdmissionNo] = useState("BF/2024/JS3/045");
  const [className, setClassName] = useState("JSS 3");
  const [session, setSession] = useState("2024/2025");
  const [term, setTerm] = useState("THIRD TERM");
  const [sex, setSex] = useState("FEMALE");
  const [rows, setRows] = useState(SUBJECTS.map((name) => ({ name, test1: "", test2: "", test3: "", exam: "", overall: "", lastTerm: "", cumulative: "", classAvg: "", position: "", grade: "", remark: "" })));
  const [aff, setAff] = useState(AFFECTIVE.map((name) => ({ name, value: "" })));
  const [psy, setPsy] = useState(PSYCHOMOTOR.map((name) => ({ name, value: "" })));
  const [ctComment, setCtComment] = useState("A hardworking and well-behaved pupil.");
  const [ctName, setCtName] = useState("Miss A. Johnson");
  const [ctDate, setCtDate] = useState("12/07/2025");
  const [pComment, setPComment] = useState("An excellent performance. Keep up the good work.");
  const [pName, setPName] = useState("Mrs. O. Adeyemi");
  const [pDate, setPDate] = useState("15/07/2025");
  const [nextTerm, setNextTerm] = useState("08/09/2025");
  const [showPreview, setShowPreview] = useState(false);

  const update = (i: number, field: string, val: string) => {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  };

  const previewData = {
    school: { name: "BRIGHTER FUTURE PRE-VERSITY INT'L ACADEMY", address: "Brighter Future Close, P.O. Box 4420, Igoba, Akure, Ondo State, Nigeria.", phone: "0803 123 4567" },
    student: { fullName: studentName, admissionNo, className, sex, session, term, noOnRoll: 38, position: 5, totalInClass: 38, daysOpened: 112, daysPresent: 108, daysAbsent: 4 },
    subjects: rows.map((r) => ({
      name: r.name,
      test1: r.test1 ? Number(r.test1) : null,
      test2: r.test2 ? Number(r.test2) : null,
      test3: r.test3 ? Number(r.test3) : null,
      exam: r.exam ? Number(r.exam) : null,
      overall: r.overall ? Number(r.overall) : null,
      lastTerm: r.lastTerm ? Number(r.lastTerm) : null,
      cumulative: r.cumulative ? Number(r.cumulative) : null,
      classAvg: r.classAvg ? Number(r.classAvg) : null,
      position: r.position ? Number(r.position) : null,
      grade: r.grade || null,
      remark: r.remark || null,
    })),
    affective: aff,
    psychomotor: psy,
    comments: { classTeacher: ctComment, classTeacherName: ctName, classTeacherDate: ctDate, principal: pComment, principalName: pName, principalDate: pDate, nextTermBegins: nextTerm },
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Traditional Report Card Entry</h1>
        <Button onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Edit" : "Preview & Print"}</Button>
      </div>

      {!showPreview ? (
        <>
          <Card>
            <CardHeader><CardTitle>Student Information</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input className="rounded-md border px-2 py-1 text-sm" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Full Name" />
              <input className="rounded-md border px-2 py-1 text-sm" value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="Admission No" />
              <input className="rounded-md border px-2 py-1 text-sm" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class" />
              <input className="rounded-md border px-2 py-1 text-sm" value={session} onChange={(e) => setSession(e.target.value)} placeholder="Session" />
              <input className="rounded-md border px-2 py-1 text-sm" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
              <input className="rounded-md border px-2 py-1 text-sm" value={sex} onChange={(e) => setSex(e.target.value)} placeholder="Sex" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Academic Performance</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="p-1 text-left">Subject</th>
                    <th className="p-1">Test1</th><th className="p-1">Test2</th><th className="p-1">Test3</th>
                    <th className="p-1">Exam</th><th className="p-1">Overall</th><th className="p-1">Last Term</th>
                    <th className="p-1">Cumulative</th><th className="p-1">Class Avg</th><th className="p-1">Pos</th>
                    <th className="p-1">Grade</th><th className="p-1">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-1">{r.name}</td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.test1} onChange={(e) => update(i, "test1", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.test2} onChange={(e) => update(i, "test2", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.test3} onChange={(e) => update(i, "test3", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.exam} onChange={(e) => update(i, "exam", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.overall} onChange={(e) => update(i, "overall", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.lastTerm} onChange={(e) => update(i, "lastTerm", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.cumulative} onChange={(e) => update(i, "cumulative", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.classAvg} onChange={(e) => update(i, "classAvg", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.position} onChange={(e) => update(i, "position", e.target.value)} /></td>
                      <td className="p-1"><input className="w-12 rounded border px-1" value={r.grade} onChange={(e) => update(i, "grade", e.target.value)} /></td>
                      <td className="p-1"><input className="w-32 rounded border px-1" value={r.remark} onChange={(e) => update(i, "remark", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Affective Disposition</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead><tr><th className="p-1 text-left">Trait</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
                  <tbody>
                    {aff.map((a, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-1">{a.name}</td>
                        {["A","B","C","D","E"].map((v) => <td key={v} className="text-center"><input type="radio" name={`aff-${i}`} checked={a.value === v} onChange={() => setAff(aff.map((x,idx) => idx===i ? {...x,value:v} : x))} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Psychomotor Skills</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead><tr><th className="p-1 text-left">Skill</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
                  <tbody>
                    {psy.map((p, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-1">{p.name}</td>
                        {["A","B","C","D","E"].map((v) => <td key={v} className="text-center"><input type="radio" name={`psy-${i}`} checked={p.value === v} onChange={() => setPsy(psy.map((x,idx) => idx===i ? {...x,value:v} : x))} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Comments & Approvals</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <textarea className="rounded-md border p-2 text-sm" value={ctComment} onChange={(e) => setCtComment(e.target.value)} placeholder="Class Teacher's Comment" />
              <div className="grid gap-2 sm:grid-cols-3">
                <input className="rounded-md border px-2 py-1 text-sm" value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Class Teacher Name" />
                <input className="rounded-md border px-2 py-1 text-sm" value={ctDate} onChange={(e) => setCtDate(e.target.value)} placeholder="Date" />
                <input className="rounded-md border px-2 py-1 text-sm" value={nextTerm} onChange={(e) => setNextTerm(e.target.value)} placeholder="Next Term Begins" />
              </div>
              <textarea className="rounded-md border p-2 text-sm" value={pComment} onChange={(e) => setPComment(e.target.value)} placeholder="Principal's Comment" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="rounded-md border px-2 py-1 text-sm" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Principal Name" />
                <input className="rounded-md border px-2 py-1 text-sm" value={pDate} onChange={(e) => setPDate(e.target.value)} placeholder="Date" />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="overflow-auto rounded-lg border bg-gray-100 p-4">
          <div className="mb-2 flex justify-end print:hidden"><Button onClick={() => window.print()}>Print</Button></div>
          <TraditionalReportCard data={previewData} />
        </div>
      )}
    </div>
  );
}
