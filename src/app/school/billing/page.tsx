import type { Metadata } from "next";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireSchoolAdmin } from "@/services/shared";
import {
  confirmSchoolPayment,
  formatPrice,
  getPublicPlans,
  getSchoolBilling,
  type VerifyOutcome,
} from "@/services/billing";
import { isPaystackConfigured } from "@/lib/paystack";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutButton } from "@/components/billing/checkout-button";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SchoolBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  const req = await requireSchoolAdmin();

  let outcome: VerifyOutcome | null = null;
  if (reference) {
    outcome = await confirmSchoolPayment(req.schoolId, reference);
  }

  const [plans, billing] = await Promise.all([
    getPublicPlans(),
    getSchoolBilling(req.schoolId),
  ]);
  const paystackReady = isPaystackConfigured();
  const currentPlanId = billing.subscription?.plan?.id ?? null;

  return (
    <DashboardShell title="Billing" badge="Administrator">
      <div className="grid gap-4">
        {reference && outcome && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              outcome.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/20 bg-destructive/5 text-destructive"
            }`}
          >
            {outcome.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <p>
              {outcome.ok
                ? outcome.alreadyProcessed
                  ? `Confirmed — your ${outcome.planName} subscription is already active.`
                  : `Payment confirmed — your ${outcome.planName} subscription is now active.`
                : outcome.ok === false && outcome.message}
            </p>
          </div>
        )}

        {!paystackReady && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Paystack isn&apos;t configured on this deployment yet, so checkout is
              disabled. Add <code className="rounded bg-amber-100 px-1">PAYSTACK_SECRET_KEY</code> to
              start taking payments.
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              Your school&apos;s subscription and billing period.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {billing.subscription ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
                  <p className="text-lg font-semibold">
                    {billing.subscription.plan?.name ?? "No plan"}
                  </p>
                  {billing.subscription.plan && (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(billing.subscription.plan.price)}
                      {billing.subscription.plan.billingInterval === "annual" ? "/year" : "/month"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        billing.subscription.statusTone === "ok"
                          ? "default"
                          : "outline"
                      }
                    >
                      {billing.subscription.statusLabel}
                    </Badge>
                    {billing.subscription.cancelAtPeriodEnd && (
                      <span className="text-xs text-muted-foreground">
                        Cancels at end of period
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {billing.subscription.periodLabel}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No subscription yet — choose a plan below to get started and report
                cards, exam series and school analytics unlock for your school.
              </p>
            )}
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Plans</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <p className="pt-2 text-2xl font-bold">
                      {formatPrice(plan.price)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {plan.billingInterval === "annual" ? "/year" : "/month"}
                      </span>
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <ul className="grid gap-1.5 text-sm text-muted-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button disabled>Current plan</Button>
                    ) : (
                      <CheckoutButton
                        planId={plan.id}
                        disabled={!paystackReady}
                        label={billing.subscription ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {plans.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No plans available yet — plan management is coming online.
              </p>
            )}
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Billing history</CardTitle>
            <CardDescription>Payments made by your school.</CardDescription>
          </CardHeader>
          <CardContent>
            {billing.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Description</th>
                      <th className="py-2 pr-3 text-right font-medium">Amount</th>
                      <th className="py-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.payments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(p.date).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3">{p.description}</td>
                        <td className="py-2 pr-3 text-right font-medium">
                          {formatPrice(p.amount)}
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant={p.status === "paid" ? "default" : "outline"}>
                            {p.status === "paid" ? "Paid" : p.status === "pending" ? "Pending" : p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}