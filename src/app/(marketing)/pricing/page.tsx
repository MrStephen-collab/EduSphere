import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicPlans } from "@/services/billing";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing plans for schools of every size.",
};

export const revalidate = 300;

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Start small and grow. Every plan includes your school&apos;s own branded
          digital classroom, and you can upgrade any time.
        </p>
      </div>
      <div className="mt-12">
        <PricingCards plans={plans} />
      </div>
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Need a plan that fits your school exactly?
        </p>
        <Button variant="outline" render={<Link href="/contact" />} className="mt-3">
          Talk to us <ArrowRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}