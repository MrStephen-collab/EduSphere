import type { ReactNode } from "react";
import type { AdmissionLetterData } from "@/services/admissions";

function longDate(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/**
 * A formal offer of admission, laid out to be printed on school letterhead and
 * given to the family. The application's <em>offered</em> state is the one that
 * produces it, so the letter always refers to a decision that was actually
 * made, and the decision note (if any) is carried through as the school's words
 * rather than being rewritten here.
 */
export function AdmissionLetterPaper({ data }: { data: AdmissionLetterData }) {
  const { application, school } = data;
  const child = `${application.applicant_first_name} ${application.applicant_last_name}`;
  const placement = application.class_name
    ? `a place in ${application.class_name}`
    : "a place at the school";

  return (
    <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6 text-sm shadow-sm sm:p-10">
      <header className="flex items-start justify-between gap-4 border-b pb-4 print:border-foreground/20">
        <div className="flex items-center gap-3">
          {school.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo_url}
              alt={`${school.name} logo`}
              className="size-12 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {school.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold leading-tight">{school.name}</p>
            {school.motto && <p className="text-xs italic text-muted-foreground">{school.motto}</p>}
            {school.address && <p className="text-xs text-muted-foreground">{school.address}</p>}
            {(school.city || school.state) && (
              <p className="text-xs text-muted-foreground">
                {[school.city, school.state].filter(Boolean).join(", ")}
              </p>
            )}
            {(school.phone || school.email) && (
              <p className="text-xs text-muted-foreground">
                {[school.phone, school.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase tracking-wide">Offer of admission</p>
          <p className="font-mono text-xs text-muted-foreground">{application.application_number}</p>
          <p className="mt-1 text-xs text-muted-foreground">{longDate(application.updated_at)}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">To the parent / guardian of</p>
          <p className="text-lg font-semibold">{child}</p>
          <p className="text-muted-foreground">{application.guardian_name}</p>
          {application.address && <p className="text-muted-foreground">{application.address}</p>}
        </div>

        <div className="grid gap-3">
          <p>Dear {application.guardian_name},</p>
          <p>
            Following your application and the school&apos;s assessment, we are pleased to
            offer <strong>{child}</strong> {placement} at {school.name}. This offer is made
            for the class named above and is subject to the school&apos;s admission terms.
          </p>
          {application.decision_note && (
            <p className="rounded-md border border-dashed p-3">{application.decision_note}</p>
          )}
        </div>

        <section className="rounded-md border p-4">
          <Row label="Candidate" value={child} />
          {application.date_of_birth && (
            <Row label="Date of birth" value={longDate(application.date_of_birth)} />
          )}
          <Row
            label="Class offered"
            value={application.class_name || "To be confirmed by the school"}
          />
          {application.entrance_score !== null && (
            <Row label="Entrance score" value={`${application.entrance_score}%`} />
          )}
          <Row label="Application reference" value={<span className="font-mono text-xs">{application.application_number}</span>} />
        </section>

        <p>
          To accept this offer, contact the school office with the reference number
          above so that enrolment and class placement can be completed. We look forward
          to welcoming {application.applicant_first_name} to {school.name}.
        </p>

        <div className="mt-4 grid gap-8 text-xs sm:grid-cols-2">
          <div>
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">Admissions officer</p>
          </div>
          <div>
            <div className="h-8 border-b border-foreground/30" />
            <p className="mt-1 text-muted-foreground">
              {application.reviewed_at ? longDate(application.reviewed_at) : "Date"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
