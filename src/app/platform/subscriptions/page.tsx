import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wallet, Repeat, TrendingUp, Hourglass } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import {
  formatPrice,
  getBillingOverview,
} from "@/services/billing";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlanForm, PlanRowEdit, type ClientPlan } from "@/components/billing/plan-form";
import { RefundPaymentButton } from "@/components/billing/refund-button";

export const metadata: Metadata = {
  title: "Subscriptions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PlatformSubscriptionsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const overview = await getBillingOverview();

  return (
    <DashboardShell title="Subscriptions & Payments" badge="Super Admin">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Subscriptions"
          value={overview.activeSubscriptions}
          icon={Wallet}
          hint={`${overview.totalSubscriptions} total`}
        />
        <StatCard
          title="Revenue So Far"
          value={formatPrice(overview.annualRevenue)}
          icon={TrendingUp}
          hint="This calendar year"
        />
        <StatCard
          title="This Month"
          value={formatPrice(overview.monthlyRevenue)}
          icon={Repeat}
          hint="Paid this month"
        />
        <StatCard
          title="Pending"
          value={formatPrice(overview.pendingAmount)}
          icon={Hourglass}
          hint="Awaiting payment"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>
              Pricing displayed across the site and at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <PlanForm />
            {(overview.plans as ClientPlan[]).map((plan) => (
              <PlanRowEdit key={plan.id} plan={plan} />
            ))}
            {overview.plans.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No plans yet — create your first pricing plan above.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>School subscriptions</CardTitle>
              <CardDescription>Latest subscription activity.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
              ) : (
                <div className="grid gap-3">
                  {overview.subscriptions.map((s) => (
                      <div
                        key={s.id}
                        className="grid gap-1 rounded-md border bg-muted/30 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{s.schoolName}</p>
                          <Badge variant={s.statusTone === "ok" ? "default" : "outline"}>
                            {s.statusLabel}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.planName} · {formatPrice(s.price)}
                          {s.billingInterval === "annual" ? "/year" : "/month"}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.periodLabel}</p>
                      </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Latest payments across schools.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <div className="divide-y">
                  {overview.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div className="grid">
                        <p className="text-sm font-medium">{p.schoolName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.description} ·{" "}
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{formatPrice(p.amount)}</p>
                        <Badge
                          variant={p.status === "paid" ? "default" : "outline"}
                        >
                          {p.status === "paid"
                            ? "Paid"
                            : p.status === "refunded"
                              ? "Refunded"
                              : p.status}
                        </Badge>
                        {p.status === "paid" && <RefundPaymentButton paymentId={p.id} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}