import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Building2,
  Users,
  GraduationCap,
  CreditCard,
  Wallet,
  CalendarRange,
  TrendingUp,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlatformAnalytics } from "@/services/platform";

export const metadata: Metadata = {
  title: "Platform analytics",
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

export default async function PlatformAnalyticsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const data = await getPlatformAnalytics();

  const maxPlan = Math.max(1, ...data.planDistribution.map((p) => p.count));

  return (
    <DashboardShell title="Platform Analytics" badge="Super Admin">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Schools" value={data.totalSchools} icon={Building2} href="/platform/schools" tone="indigo" hint={`${data.activeSchools} active`} />
        <StatCard title="Students" value={data.totalStudents} icon={Users} href="/platform/users" tone="emerald" index={1} />
        <StatCard title="Teachers" value={data.totalTeachers} icon={GraduationCap} href="/platform/users" tone="sky" index={2} />
        <StatCard title="Active Subscriptions" value={data.activeSubscriptions} icon={CreditCard} href="/platform/subscriptions" tone="amber" index={3} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Monthly Revenue"
          value={formatMoney(data.monthlyRevenue)}
          icon={Wallet}
          href="/platform/subscriptions"
          tone="rose"
          index={4}
          hint="Paid since the start of this month"
        />
        <StatCard
          title="Annual Revenue"
          value={formatMoney(data.annualRevenue)}
          icon={CalendarRange}
          href="/platform/subscriptions"
          tone="fuchsia"
          index={5}
          hint="Paid this calendar year"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plans in use</CardTitle>
            <CardDescription>Active subscriptions by plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active subscriptions yet.
              </p>
            ) : (
              data.planDistribution.map((p) => (
                <div key={p.label} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{p.label}</p>
                    <p className="text-muted-foreground">{p.count}</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(p.count / maxPlan) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent schools</CardTitle>
            <CardDescription>Latest schools to join the platform.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {data.recentSchools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schools have registered yet.</p>
            ) : (
              data.recentSchools.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <p className="truncate font-medium">{s.name}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="size-3" aria-hidden="true" />
                      {new Date(s.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusClasses[s.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.status}
                    </span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}