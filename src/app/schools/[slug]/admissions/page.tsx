import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  FileUser,
  MessageSquareText,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdmissionApplicationForm } from "@/components/site/admission-application-form";
import { getSchoolSite } from "@/services/school-site";
import { getAdmissionLinkStateBySlug } from "@/services/admissions";
import { formatNaira } from "@/lib/fee-labels";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AdmissionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  // Whether the school is accepting applications right now, and what it has
  // said about the fee and the intake. Fetched separately from the site page
  // because it changes whenever an admin flips the link or the window passes.
  const link = await getAdmissionLinkStateBySlug(slug);
  const accepting = link.status === "open";

  const windowText = (() => {
    if (link.opensAt && link.closesAt) {
      return `Applications are open from ${formatDate(link.opensAt)} to ${formatDate(link.closesAt)}.`;
    }
    if (link.closesAt) return `Applications close on ${formatDate(link.closesAt)}.`;
    if (link.opensAt) return `Applications open on ${formatDate(link.opensAt)}.`;
    return null;
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Admissions</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {link.intakeLabel
          ? `${link.intakeLabel} at ${site.name}.`
          : `How to join ${site.name} for the upcoming term.`}
      </p>
      {link.introMessage ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {link.introMessage}
        </p>
      ) : null}
      {windowText ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {windowText}
        </p>
      ) : null}

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

      {accepting ? (
        <>
          <section className="mt-10 rounded-xl border bg-muted/40 p-6 text-center sm:p-8">
            <h2 className="text-xl font-semibold">Ready to begin?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Apply online below and the school will receive your application
              immediately. Current students and parents sign in on EduSphere.
            </p>
            {link.fee ? (
              <p className="mx-auto mt-3 max-w-xl text-sm">
                Application fee:{" "}
                <span className="font-semibold">
                  {formatNaira(link.fee.amount, link.fee.currency)}
                </span>
                {link.fee.note ? (
                  <span className="text-muted-foreground"> — {link.fee.note}</span>
                ) : null}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button render={<a href="#apply" />}>
                Start an application
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/schools/${site.slug}/contact`} />}
              >
                Contact the school
              </Button>
            </div>
          </section>

          <section id="apply" className="mt-10 scroll-mt-20">
            <AdmissionApplicationForm slug={site.slug} classes={site.classes} />
          </section>
        </>
      ) : (
        <section className="mt-10 rounded-xl border bg-muted/40 p-6 text-center sm:p-8">
          <h2 className="flex items-center justify-center gap-2 text-xl font-semibold">
            <Clock className="size-5" aria-hidden="true" />
            {link.status === "closed"
              ? "Applications are closed"
              : "Applications are not open yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {link.status === "closed"
              ? windowText ?? "The application window for this intake has closed."
              : windowText ?? "Please check back soon, or contact the school to register your interest."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              render={<Link href={`/schools/${site.slug}/contact`} />}
            >
              Contact the school
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}