import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap,
  MonitorPlay,
  FileQuestion,
  BarChart3,
  ShieldCheck,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicPlans } from "@/services/billing";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Your School. Your Digital Classroom.",
  description:
    "Give your school a modern digital learning environment where teachers teach, students learn, assessments happen and parents stay connected.",
};

export const revalidate = 300;

const features = [
  {
    icon: MonitorPlay,
    title: "Digital Learning",
    description:
      "Courses, modules and lessons with videos, PDFs, notes and practice for every subject.",
  },
  {
    icon: FileQuestion,
    title: "Computer-Based Testing",
    description:
      "A serious CBT engine with question banks, randomization, timers, auto-marking and instant results.",
  },
  {
    title: "Assignments & Grading",
    icon: GraduationCap,
    description:
      "Create assignments, accept multimedia submissions and grade with feedback in minutes.",
  },
  {
    icon: BarChart3,
    title: "Academic Analytics",
    description:
      "Understand class performance, spot weak topics and track every student's progress.",
  },
  {
    icon: Users,
    title: "Parent Engagement",
    description:
      "Parents see results, assignments and progress for their children in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Multi-Tenant",
    description:
      "Every school gets an isolated, branded environment protected end to end.",
  },
];

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center md:pt-24">
        <span className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Built for Nigerian schools 🇳🇬
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Your School. Your{" "}
          <span className="text-primary">Digital Classroom.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Give your school a modern digital learning environment where teachers
          teach, students learn, assessments happen and parents stay connected.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/auth/register" />} className="w-full sm:w-auto">
            Get Started <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/contact" />} className="w-full sm:w-auto">
            Book a Demo
          </Button>
        </div>
      </section>

      <section id="how-it-works" className="border-t bg-muted/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            The complete learning loop, powered by one platform.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Teacher creates content", text: "Lessons, materials and CBT exams." },
              { step: "02", title: "Student learns & practises", text: "Videos, notes, quizzes and assignments." },
              { step: "03", title: "System marks & reports", text: "Auto-graded results with instant feedback." },
              { step: "04", title: "School & parents act", text: "Analytics guide better academic decisions." },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border bg-background p-6">
                <span className="text-3xl font-bold text-primary/70">{item.step}</span>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">Everything your school needs</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            One platform replaces scattered tools for teaching, assessment and
            parent communication.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border bg-card p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t bg-muted/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Start small and grow. Prices are configurable per plan.
          </p>
          <div className="mt-10">
            <PricingCards plans={plans} />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to digitize your school?</h2>
          <p className="mt-3 text-muted-foreground">
            Join the first schools in Akure already moving their classrooms online.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/auth/register" />}>
              Get Started <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/contact" />}>
              Talk to us
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}