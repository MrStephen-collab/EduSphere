"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStaffAccountAction } from "@/app/school/actions";

/**
 * Issues a principal or bursar login.
 *
 * These people run the school but do not teach, so the account is created
 * without a teacher record — it will not appear in the teaching roster or use a
 * teacher seat. The role is chosen here because it is the one decision that
 * decides what the person can open.
 */
export function StaffAccountForm() {
  const router = useRouter();
  const [role, setRole] = useState<"PRINCIPAL" | "BURSAR">("BURSAR");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createStaffAccountAction({ fullName, email, role });
      if (result.ok) {
        setNotice(
          `${role === "BURSAR" ? "Bursar" : "Principal"} account ready. They can sign in with the default password.`,
        );
        setFullName("");
        setEmail("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-1">
        <label htmlFor="staff-role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="staff-role"
          value={role}
          onChange={(event) => setRole(event.target.value as "PRINCIPAL" | "BURSAR")}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="BURSAR">Bursar / accountant — fee desk only</option>
          <option value="PRINCIPAL">Principal — leadership and fee desk</option>
        </select>
      </div>

      <div className="grid gap-1">
        <label htmlFor="staff-name" className="text-sm font-medium">
          Full name
        </label>
        <Input
          id="staff-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Ada Mbeki"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="staff-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="staff-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="bursar@school.com"
          autoComplete="off"
        />
      </div>

      <Button type="submit" disabled={isPending || !fullName.trim() || !email.trim()}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserRoundPlus className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Creating…" : "Create account"}
      </Button>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-medium text-primary">
          {notice}
        </p>
      )}
    </form>
  );
}
