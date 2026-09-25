import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, School, Wallet, Activity, CalendarRange } from "lucide-react";
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

export default async function PlatformDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) {
    redirect("/auth/login");
  }
  if (!context.roles.includes("SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  const data = await getPlatformAnalytics();

  return (
    <DashboardShell title="Platform Dashboard" badge="Super Admin">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Schools" value={data.totalSchools} icon={School} href="/platform/schools" tone="indigo" hint={`${data.activeSchools} active`} />
        <StatCard title="Students" value={data.totalStudents} icon={Users} href="/platform/users" tone="emerald" index={1} />
        <StatCard title="Teachers" value={data.totalTeachers} icon={Activity} href="/platform/users" tone="sky" index={2} />
        <StatCard title="Active Subscriptions" value={data.activeSubscriptions} icon={Wallet} href="/platform/subscriptions" tone="amber" index={3} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatCard
          title="Monthly Revenue"
          value={formatMoney(data.monthlyRevenue)}
          icon={Wallet}
          href="/platform/analytics"
          tone="rose"
          index={4}
          hint="Paid since the start of this month"
        />
        <StatCard
          title="Annual Revenue"
          value={formatMoney(data.annualRevenue)}
          icon={CalendarRange}
          href="/platform/analytics"
          tone="fuchsia"
          index={5}
          hint="Paid this calendar year"
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
    </DashboardShell>
  );
}