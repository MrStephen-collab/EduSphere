"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTeacherAction,
  createStudentAction,
  createParentAction,
} from "@/app/school/actions";

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function TeacherForm({ onDone }: { onDone?: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createTeacherAction({
            fullName: fullName.trim(),
            email: email.trim() || null,
            title: title.trim() || null,
          });
          if (result.ok) {
            setFullName("");
            setEmail("");
            setTitle("");
            onDone?.();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="t-name">Full name</Label>
        <Input id="t-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Aisha Bello" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-email">Email (optional)</Label>
        <Input id="t-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.ng" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-title">Title</Label>
        <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mr / Mrs" />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        <UserPlus className="mr-1 size-4" aria-hidden="true" />
        {isPending ? "Adding…" : "Add teacher"}
      </Button>
      <FieldError error={error} />
    </form>
  );
}

export function StudentForm({
  onDone,
  classes,
  streams,
}: {
  onDone?: () => void;
  classes: { id: string; name: string }[];
  streams: { id: string; name: string }[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createStudentAction({
            fullName: fullName.trim(),
            email: email.trim() || null,
            admissionNumber: admissionNumber.trim(),
            classId: classId || null,
            streamId: streamId || null,
            gender: (gender as "male" | "female") || null,
            dateOfBirth: dateOfBirth || null,
            guardianPhone: guardianPhone.trim() || null,
          });
          if (result.ok) {
            setFullName("");
            setEmail("");
            setAdmissionNumber("");
            setClassId("");
            setStreamId("");
            setGender("");
            setDateOfBirth("");
            setGuardianPhone("");
            onDone?.();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="s-name">Full name</Label>
        <Input id="s-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Chidi Okeke" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-adm">Admission number</Label>
        <Input id="s-adm" value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)} placeholder="e.g. BFC/2026/001" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-email">Email (optional)</Label>
        <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@school.ng" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-phone">Guardian phone</Label>
        <Input id="s-phone" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="0800 000 0000" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-class">Class</Label>
        <select id="s-class" className={nativeSelectClass()} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">No class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-stream">Stream</Label>
        <select id="s-stream" className={nativeSelectClass()} value={streamId} onChange={(e) => setStreamId(e.target.value)}>
          <option value="">No stream</option>
          {streams.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-gender">Gender</Label>
        <select id="s-gender" className={nativeSelectClass()} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-dob">Date of birth</Label>
        <Input id="s-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        <UserPlus className="mr-1 size-4" aria-hidden="true" />
        {isPending ? "Adding…" : "Add student"}
      </Button>
      <FieldError error={error} />
    </form>
  );
}

export function ParentForm({
  onDone,
  students,
}: {
  onDone?: () => void;
  students: { id: string; name: string }[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createParentAction({
            fullName: fullName.trim(),
            email: email.trim() || null,
            relationship: relationship.trim() || null,
            linkedStudentIds: linked,
          });
          if (result.ok) {
            setFullName("");
            setEmail("");
            setRelationship("");
            setLinked([]);
            onDone?.();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="p-name">Full name</Label>
        <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mrs. Ngozi Okeke" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-email">Email (optional)</Label>
        <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@email.ng" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-relation">Relationship</Label>
        <Input id="p-relation" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Father" />
      </div>
      <div className="grid gap-1.5">
        <Label>Linked students</Label>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students yet — add students first.</p>
        ) : (
          <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border bg-background p-2 text-sm">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={linked.includes(s.id)}
                  onChange={(e) => {
                    setLinked((prev) =>
                      e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                    );
                  }}
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        <UserPlus className="mr-1 size-4" aria-hidden="true" />
        {isPending ? "Adding…" : "Add parent"}
      </Button>
      <FieldError error={error} />
    </form>
  );
}