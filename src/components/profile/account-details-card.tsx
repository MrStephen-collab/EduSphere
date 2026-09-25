"use client";

import { useActionState } from "react";
import { CalendarDays, Image as ImageIcon, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { updateAccountAction, type AccountActionState } from "@/app/account/actions";

export function AccountDetailsCard({
  email,
  memberSince,
  initialName,
  initialPhone,
  initialAvatarUrl,
}: {
  email?: string;
  memberSince?: string;
  initialName: string;
  initialPhone?: string | null;
  initialAvatarUrl?: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    AccountActionState | null,
    FormData
  >(updateAccountAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account details</CardTitle>
        <CardDescription>
          Update your personal information shown across EduSphere.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {email && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium text-foreground">{email}</span>
          </div>
        )}
        {memberSince && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            Member since {memberSince}
          </div>
        )}

        <form action={formAction} className="grid gap-3 pt-2">
          {state?.error && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          )}
          {state?.success && (
            <p
              className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              Details saved.
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={initialName}
              required
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden="true" />
                Phone
              </span>
            </Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={initialPhone ?? ""}
              autoComplete="tel"
              placeholder="+234 800 000 0000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="avatarUrl">
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="size-3.5" aria-hidden="true" />
                Avatar URL
              </span>
            </Label>
            <Input
              id="avatarUrl"
              name="avatarUrl"
              defaultValue={initialAvatarUrl ?? ""}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
          <div className="pt-1">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}