"use client";

import { useState, useTransition } from "react";
import { Upload, Download, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCsv, mapCsvRows, type CsvMapping } from "@/lib/csv";
import { importStudentsAction } from "@/app/school/actions";

const STUDENT_COLUMNS: Record<string, string[]> = {
  firstName: ["first_name", "firstname", "given_name"],
  lastName: ["last_name", "lastname", "surname", "family_name"],
  email: ["email", "email_address"],
  admissionNumber: ["admission_number", "admission_no", "adm_no", "reg_no", "registration_number"],
  gender: ["gender", "sex"],
  dateOfBirth: ["date_of_birth", "dob", "birth_date"],
};

const CSV_TEMPLATE = [
  "first_name,last_name,email,admission_number,gender,date_of_birth",
  "Chidi,Okeke,chidi.okeke@example.ng,BFC-2026-001,male,2012-03-01",
  "Amina,Yusuf,amina.yusuf@example.ng,BFC-2026-002,female,2011-09-14",
].join("\n");

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function StudentImport() {
  const [rows, setRows] = useState<CsvMapping[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setError("The CSV needs a header row and at least one data row.");
        setRows(null);
        return;
      }
      const mapped = mapCsvRows(parsed, STUDENT_COLUMNS).filter(
        (r) => r.admissionNumber.trim() !== "",
      );
      setRows(mapped);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this CSV file.");
      setRows(null);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <Upload className="size-4" aria-hidden="true" />
          {fileName ?? "Choose a .csv file"}
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-1 size-4" aria-hidden="true" /> Template
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && <p className="text-sm text-muted-foreground">{result}</p>}

      {rows && rows.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-2 font-medium">{rows.length} student(s) ready to import</p>
          <ul className="grid max-h-48 gap-1 overflow-y-auto">
            {rows.slice(0, 10).map((row, i) => (
              <li key={i} className="flex items-center justify-between rounded border bg-card px-3 py-1.5 text-xs">
                <span>{[row.firstName, row.lastName].filter(Boolean).join(" ") || row.admissionNumber}</span>
                <span className="text-muted-foreground">{row.admissionNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows && rows.length > 0 && (
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setResult(null);
            startTransition(async () => {
              const outcome = await importStudentsAction(
                rows.map((r) => ({
                  firstName: r.firstName,
                  lastName: r.lastName,
                  email: r.email,
                  admissionNumber: r.admissionNumber,
                  gender: (r.gender as "male" | "female") || null,
                  dateOfBirth: r.dateOfBirth || null,
                })),
              );
              setRows(null);
              setFileName(null);
              if (!outcome.ok) {
                setError(outcome.error);
                return;
              }
              const created = "created" in outcome ? outcome.created : 0;
              const duplicates = "duplicates" in outcome ? outcome.duplicates : 0;
              const errorCount = "errors" in outcome ? outcome.errors.length : 0;
              setResult(
                `Imported ${created} student(s)` +
                  (duplicates > 0 ? `, skipped ${duplicates} duplicate(s)` : "") +
                  (errorCount > 0 ? `, ${errorCount} error(s)` : ""),
              );
            });
          }}
        >
          <Users className="mr-1 size-4" aria-hidden="true" />
          {isPending ? "Importing…" : "Import all students"}
        </Button>
      )}
    </div>
  );
}