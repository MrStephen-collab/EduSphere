"use client";

import { useState, useTransition } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueFeeInvoiceAction } from "@/app/school/actions";

const field =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Issues a one-off charge to a single child. Used for the things a term fee
 * cannot express: a resit, an excursion, a replacement uniform.
 */
export function FeeIssueForm({
  students,
  terms,
}: {
  students: { id: string; label: string }[];
  terms: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await issueFeeInvoiceAction({
        studentId,
        termId: termId || null,
        description,
        amount,
        dueDate: dueDate || null,
      });
      if (result.ok) {
        setDone("Invoice issued and the parent notified.");
        setDescription("");
        setAmount("");
        setDueDate("");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="fee-student" className="text-sm font-medium">
          Child
        </label>
        <select
          id="fee-student"
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className={field}
        >
          <option value="">Choose a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="fee-term" className="text-sm font-medium">
          Term (optional)
        </label>
        <select
          id="fee-term"
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className={field}
        >
          <option value="">No term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="fee-description" className="text-sm font-medium">
          What is it for?
        </label>
        <input
          id="fee-description"
          required
          minLength={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Third term school fees"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <label htmlFor="fee-amount" className="text-sm font-medium">
            Amount (₦)
          </label>
          <input
            id="fee-amount"
            required
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={field}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="fee-due" className="text-sm font-medium">
            Due date (optional)
          </label>
          <input
            id="fee-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending || !studentId}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Receipt className="size-4" aria-hidden="true" />
        )}
        Issue invoice
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && <p className="text-xs text-emerald-700">{done}</p>}
    </form>
  );
}
