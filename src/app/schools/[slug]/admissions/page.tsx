import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardCheck, FileUser, MessageSquareText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSchoolSite } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `Admissions at ${site.name}` : "Admissions" };
}

const steps = [
  {
    icon: MessageSquareText,
    title: "Speak to the school",
    body: "Reach out through the contact page or by phone to confirm intake dates, fees and requirements for your child's class level.",
  },
  {
    icon: FileUser,
    title: "Register your interest",
    body: "Provide your details and the child's details so the school can prepare for the entrance assessment.",
  },
  {
    icon: ClipboardCheck,
    title: "Entrance assessment",
    body: "The child sits a short assessment (candidates are prepared through EduSphere CBT practice) and an interview where required.",
  },
  {
    icon: UserPlus,
    title: "Offer and enrolment",
    body: "Successful candidates receive an offer. Once fees are settled, the child is enrolled and given an EduSphere login to start learning.",
  },
];

export default async function AdmissionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Admissions</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        How to join {site.name} for the upcoming term.
      </p>

      <ol className="mt-10 grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-xl border bg-card p-5"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: site.colors.primary }}
            >
              <step.icon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </p>
              <h2 className="mt-0.5 font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 rounded-xl border bg-muted/40 p-6 text-center sm:p-8">
        <h2 className="text-xl font-semibold">Ready to begin?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Contact {site.name} to confirm this term&apos;s intake. Current students and
          parents sign in on EduSphere.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button
            render={<Link href={`/schools/${site.slug}/contact`} />}
          >
            Contact the school
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" render={<Link href="/auth/login" />}>
            Student / parent login
          </Button>
        </div>
      </section>
    </div>
  );
}