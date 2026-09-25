import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { School } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getPlatformSchools } from "@/services/platform";
import { subscriptionDisplayStatus } from "@/services/billing";
import type { SubscriptionStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Schools",
  robots: { index: false, follow: false },
};

const statusClasses: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PlatformSchoolsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const schools = await getPlatformSchools();

  return (
    <DashboardShell title="Schools" badge="Super Admin">
      <Card>
        <CardHeader>
          <CardTitle>All schools ({schools.length})</CardTitle>
          <CardDescription>
            Every school on the platform with its team size and subscription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schools.length === 0 ? (
            <EmptyState
              icon={School}
              title="No schools yet"
              description="Schools appear here as soon as they register and complete onboarding."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">School</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 text-right font-medium">Students</th>
                    <th className="py-2 pr-3 text-right font-medium">Teachers</th>
                    <th className="py-2 pr-3 font-medium">Subscription</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s) => {
                    const sub = subscriptionDisplayStatus({
                      status: s.subscriptionStatus as SubscriptionStatus,
                      current_period_end: s.periodEnd,
                    });
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.slug}</p>
                        </td>
                        <td className="py-2 pr-3">
                          {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{s.ownerName ?? "—"}</p>
                          {s.ownerEmail && (
                            <p className="text-xs text-muted-foreground">{s.ownerEmail}</p>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{s.students}</td>
                        <td className="py-2 pr-3 text-right">{s.teachers}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              sub.tone === "ok"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {sub.label}
                          </span>
                          {s.planName && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.planName}</p>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              statusClasses[s.status] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {formatDate(s.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}