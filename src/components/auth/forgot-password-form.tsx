"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction, type ActionState } from "@/lib/auth/actions";
import { AuthCard } from "./auth-card";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(forgotPasswordAction, null);

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
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
            If an account exists for that email, a password reset link has been sent.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@school.com" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending link..." : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}