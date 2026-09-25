"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { AuthCard } from "./auth-card";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<
    ActionState | null,
    FormData
  >(loginAction, null);

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your account to continue."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium underline underline-offset-4">
            Get started
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
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@school.com" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}