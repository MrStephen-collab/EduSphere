import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, type Plan } from "@/services/billing";

export function PricingCards({
  plans,
  ctaHref = "/auth/register",
}: {
  plans: Plan[];
  ctaHref?: string;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan, i) => {
        const highlight = plans.length > 1 && i === 1;
        return (
          <div
            key={plan.id}
            className={`flex flex-col rounded-xl border bg-background p-6 ${
              highlight ? "border-primary shadow-lg" : ""
            }`}
          >
            {highlight && (
              <span className="mb-2 w-fit rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                Most Popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            <p className="mt-4">
              <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
              <span className="text-sm text-muted-foreground">
                {plan.billingInterval === "annual" ? "/year" : "/month"}
              </span>
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex-1" />
            <Button
              variant={highlight ? "default" : "outline"}
              render={<Link href={ctaHref} />}
              className="w-full"
            >
              Choose {plan.name}
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}