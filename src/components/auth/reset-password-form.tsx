"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction, type ActionState } from "@/lib/auth/actions";
import { AuthCard } from "./auth-card";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(resetPasswordAction, null);

  return (
    <AuthCard
      title="Choose a new password"
      description="Enter a new password for your account."
      footer={
        <>
          <Link href="/auth/login" className="font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}
        {state?.success && !state.error && (
          <p
            className="rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            role="status"
          >
            Password updated successfully. You can now sign in.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}