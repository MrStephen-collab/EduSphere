"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { genderOptions } from "@/lib/admission-labels";

type FormValues = {
  applicantFirstName: string;
  applicantLastName: string;
  dateOfBirth: string;
  gender: string;
  classId: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  address: string;
  previousSchool: string;
  notes: string;
};

const EMPTY: FormValues = {
  applicantFirstName: "",
  applicantLastName: "",
  dateOfBirth: "",
  gender: "",
  classId: "",
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
  address: "",
  previousSchool: "",
  notes: "",
};

function nativeSelectClass() {
  return "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

export function AdmissionApplicationForm({
  slug,
  classes,
}: {
  slug: string;
  classes: { id: string; name: string }[];
}) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);

  function set<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admissions/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; applicationNumber?: string; error?: string }
        | null;

      if (!response.ok || !json?.ok || !json.applicationNumber) {
        setError(json?.error ?? "We couldn't submit your application. Please try again.");
        return;
      }
      setApplicationNumber(json.applicationNumber);
    } catch {
      setError(
        "We couldn't reach the school. Please check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (applicationNumber) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center sm:p-8">
        <CheckCircle2
          className="mx-auto size-10 text-emerald-600"
          aria-hidden="true"
        />
        <h2 className="mt-3 text-xl font-semibold">Application received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The school has your application. Quote this reference if you follow up:
        </p>
        <p className="mt-3 inline-block rounded-lg border bg-muted/50 px-4 py-2 font-mono text-lg font-semibold tracking-wide">
          {applicationNumber}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Keep this page or a photo of it. You do not need an EduSphere account to
          apply.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Apply online</h2>
          <p className="text-sm text-muted-foreground">
            Tell the school about the child you are applying for. Fields marked with
            an asterisk are required.
          </p>
        </div>

        <fieldset className="grid gap-4">
          <legend className="text-sm font-semibold">The child</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="applicantFirstName">First name *</Label>
              <Input
                id="applicantFirstName"
                required
                maxLength={80}
                value={values.applicantFirstName}
                onChange={(e) => set("applicantFirstName", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="applicantLastName">Surname *</Label>
              <Input
                id="applicantLastName"
                required
                maxLength={80}
                value={values.applicantLastName}
                onChange={(e) => set("applicantLastName", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={values.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={values.gender}
                onChange={(e) => set("gender", e.target.value)}
                className={nativeSelectClass()}
              >
                <option value="">Not specified</option>
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {classes.length > 0 && (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="classId">Class being applied for</Label>
                <select
                  id="classId"
                  value={values.classId}
                  onChange={(e) => set("classId", e.target.value)}
                  className={nativeSelectClass()}
                >
                  <option value="">Let the school advise</option>
                  {classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-4 border-t pt-4">
          <legend className="text-sm font-semibold">Parent / guardian</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="guardianName">Full name *</Label>
              <Input
                id="guardianName"
                required
                maxLength={120}
                value={values.guardianName}
                onChange={(e) => set("guardianName", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="guardianEmail">Email *</Label>
              <Input
                id="guardianEmail"
                type="email"
                required
                maxLength={160}
                value={values.guardianEmail}
                onChange={(e) => set("guardianEmail", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="guardianPhone">Phone</Label>
              <Input
                id="guardianPhone"
                type="tel"
                maxLength={40}
                value={values.guardianPhone}
                onChange={(e) => set("guardianPhone", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="previousSchool">Previous school</Label>
              <Input
                id="previousSchool"
                maxLength={160}
                value={values.previousSchool}
                onChange={(e) => set("previousSchool", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="address">Home address</Label>
              <Input
                id="address"
                maxLength={300}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Anything else the school should know</Label>
              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {pending ? "Submitting…" : "Submit application"}
          </Button>
          <p className="text-xs text-muted-foreground">
            The school reviews every application and will be in touch.
          </p>
        </div>
      </div>
    </form>
  );
}
