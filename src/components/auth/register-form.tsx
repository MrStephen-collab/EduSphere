"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type ActionState } from "@/lib/auth/actions";
import { AuthCard } from "./auth-card";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(registerAction, null);

  return (
    <AuthCard
      title="Create your school account"
      description="Set up your school's digital learning environment."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium underline underline-offset-4">
            Sign in
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
            {state.error || "Account created. Check your email to confirm your account."}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required placeholder="e.g. Mrs. Adebayo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schoolName">School name</Label>
          <Input id="schoolName" name="schoolName" required placeholder="e.g. Greenfield College" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="admin@school.edu.ng" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account..." : "Create school account"}
        </Button>
      </form>
    </AuthCard>
  );
}