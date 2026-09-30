"use client";

import { useState, useTransition } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTermInvoicesAction } from "@/app/school/actions";

const field =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Charges one amount to a whole class (or the entire school) for a term.
 *
 * The server makes this safe to run twice: a deterministic billing key means a
 * repeat run reports the students it skipped rather than issuing a second
 * invoice to each of them. The button therefore stays enabled after a
 * successful run so a bursar can confirm the count.
 */
export function FeeGenerateForm({
  classes,
  terms,
}: {
  classes: { id: string; label: string }[];
  terms: { id: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await generateTermInvoicesAction({
        termId,
        classId: classId || null,
        description,
        amount,
        dueDate: dueDate || null,
      });
      if (result.ok) {
        setDone(result.message ?? "Invoices issued.");
      } else {
        setError(result.error);
      }
    });
  };

  const scope = classId
    ? (classes.find((c) => c.id === classId)?.label ?? "the selected class")
    : "every student in the school";

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="gen-term" className="text-sm font-medium">
          Term
        </label>
        <select
          id="gen-term"
          required
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className={field}
        >
          <option value="">Choose a term…</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="gen-class" className="text-sm font-medium">
          Who to bill
        </label>
        <select
          id="gen-class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={field}
        >
          <option value="">Every student in the school</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="gen-description" className="text-sm font-medium">
          What is it for?
        </label>
        <input
          id="gen-description"
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
          <label htmlFor="gen-amount" className="text-sm font-medium">
            Amount each (₦)
          </label>
          <input
            id="gen-amount"
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
          <label htmlFor="gen-due" className="text-sm font-medium">
            Due date (optional)
          </label>
          <input
            id="gen-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending || !termId}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Users className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Issuing…" : `Bill ${scope}`}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && <p className="text-xs text-emerald-700">{done}</p>}
    </form>
  );
}
