import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Database, KeyRound, Settings2, ShieldCheck } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Platform settings",
  robots: { index: false, follow: false },
};

function EnvRow({ label, configured, detail }: { label: string; configured: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
        {label}
      </span>
      <span className="flex items-center gap-2 text-xs">
        {detail && <span className="text-muted-foreground">{detail}</span>}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
            configured
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          <CheckCircle2 className="size-3" aria-hidden="true" />
          {configured ? "Configured" : "Not set"}
        </span>
      </span>
    </div>
  );
}

export default async function PlatformSettingsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const integrations = [
    {
      label: "Supabase URL",
      configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      detail: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? process.env.NEXT_PUBLIC_SUPABASE_URL
        : undefined,
    },
    {
      label: "Paystack secret key",
      configured: !!process.env.PAYSTACK_SECRET_KEY,
    },
    {
      label: "Paystack public key",
      configured: !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    },
    {
      label: "App URL",
      configured: !!process.env.NEXT_PUBLIC_APP_URL,
      detail: process.env.NEXT_PUBLIC_APP_URL ?? undefined,
    },
  ];

  return (
    <DashboardShell title="Platform Settings" badge="Super Admin">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-5" aria-hidden="true" />
            Integrations
          </CardTitle>
          <CardDescription>
            Health check for the third-party services the platform depends on.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid divide-y">
          {integrations.map((i) => (
            <EnvRow key={i.label} {...i} />
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" aria-hidden="true" />
              Tenant boundary
            </CardTitle>
            <CardDescription>
              Every school is fully isolated at the database layer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Row-level security scopes every query to the caller&apos;s school
              (or the platform for super admins), so one school can never read
              another&apos;s students, teachers or results. Managing schools,
              plans and support tickets is restricted to platform administrators.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" aria-hidden="true" />
              Platform administration
            </CardTitle>
            <CardDescription>
              Where the platform-wide controls live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              <li>· School directory — {`/platform/schools`}</li>
              <li>· Revenue and rollout metrics — {`/platform/analytics`}</li>
              <li>· Plans, subscriptions and refunds — {`/platform/subscriptions`}</li>
              <li>· School support tickets — {`/platform/support`}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}