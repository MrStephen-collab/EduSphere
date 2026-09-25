import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { School, Wallet } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlatformAnalytics } from "@/services/platform";

export const metadata: Metadata = {
  title: "Platform dashboard",
  robots: { index: false, follow: false },
};

const statusClasses: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function formatMoney(value: number): string {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function PlatformDashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-56 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function PlatformDashboardContent() {
  const data = await getPlatformAnalytics();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Schools" value={data.totalSchools} icon={School} href="/platform/schools" tone="indigo" hint={`${data.activeSchools} active`} />
        <StatCard
          title="Monthly Revenue"
          value={formatMoney(data.monthlyRevenue)}
          icon={Wallet}
          href="/platform/analytics"
          tone="rose"
          index={1}
          hint="Paid since the start of this month"
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "240ms" }}>
          <CardHeader>
            <CardTitle>Recent schools</CardTitle>
            <CardDescription>Schools that recently joined the platform</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {data.recentSchools.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No schools yet — they appear here as they register.
              </p>
            ) : (
              data.recentSchools.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <p className="truncate font-medium">{s.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusClasses[s.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="animate-card-enter" style={{ animationDelay: "320ms" }}>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active subscriptions yet — manage plans and payments from the subscriptions manager.
              </p>
            ) : (
              data.planDistribution.map((p) => (
                <div key={p.label} className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium">{p.label}</p>
                  <p className="text-muted-foreground">{p.count}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default async function PlatformDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) {
    redirect("/auth/login");
  }
  if (!context.roles.includes("SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <DashboardShell title="Platform Dashboard" badge="Super Admin">
      <Suspense fallback={<PlatformDashboardSkeleton />}>
        <PlatformDashboardContent />
      </Suspense>
    </DashboardShell>
  );
}