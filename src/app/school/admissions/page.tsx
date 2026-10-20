import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Inbox,
  ClipboardCheck,
  Award,
  GraduationCap,
  Settings2,
  CircleDot,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import {
  getAdmissionApplications,
  getAdmissionCounts,
  getAdmissionApplication,
  getAdmissionLinkStateBySlug,
  type AdmissionLinkState,
} from "@/services/admissions";
import { formatNaira } from "@/lib/fee-labels";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { AdmissionsInbox } from "@/components/school/admissions-inbox";
import { ADMISSION_STATUSES, admissionStatusLabel } from "@/lib/admission-labels";
import type { AdmissionEvent, AdmissionStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Admissions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The stages an application moves through on its way to a place, in order.
 * Rejected and withdrawn sit outside the funnel -- they are exits, not steps
 * toward enrolment -- so the bars read as progress toward a real outcome.
 */
const FUNNEL: { status: AdmissionStatus; label: string }[] = [
  { status: "submitted", label: "New" },
  { status: "under_review", label: "Under review" },
  { status: "entrance", label: "Entrance assessment" },
  { status: "offered", label: "Offer made" },
  { status: "enrolled", label: "Enrolled" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function linkStatusStrip(state: AdmissionLinkState): {
  text: string;
  tone: string;
} {
  switch (state.status) {
    case "open": {
      const window =
        state.closesAt && state.opensAt
          ? ` · ${formatDate(state.opensAt)} – ${formatDate(state.closesAt)}`
          : state.closesAt
            ? ` · closes ${formatDate(state.closesAt)}`
            : "";
      return {
        text: `Admissions open${window}`,
        tone: "text-emerald-600",
      };
    }
    case "not_open_yet":
      return {
        text: state.opensAt
          ? `Admissions open ${formatDate(state.opensAt)} at ${formatTime(state.opensAt)}`
          : "Admissions open soon",
        tone: "text-amber-600",
      };
    case "closed":
      return {
        text: state.closesAt
          ? `Admissions closed on ${formatDate(state.closesAt)}`
          : "Admissions closed",
        tone: "text-rose-600",
      };
    default:
      return {
        text: "Admissions link is off — applicants can't submit right now",
        tone: "text-muted-foreground",
      };
  }
}

export default async function SchoolAdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.some((r) => r === "SCHOOL_OWNER" || r === "SCHOOL_ADMIN")) {
    redirect("/school");
  }

  await requireSchoolAdmin();

  // The status comes from the query string, so it is only honoured when it is a
  // real status. Anything else means "no filter".
  const activeStatus = (ADMISSION_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as AdmissionStatus)
    : undefined;

  const [applications, counts] = await Promise.all([
    getAdmissionApplications(activeStatus ? { status: activeStatus } : {}),
    getAdmissionCounts(),
  ]);

  // Resolved through the same helper the public page uses, so this strip tells
  // an admin exactly what an applicant sees right now.
  const membership = context.memberships.find(
    (m) => m.role === "SCHOOL_OWNER" || m.role === "SCHOOL_ADMIN",
  );
  const slug = membership?.school.slug ?? "";
  const linkState = await getAdmissionLinkStateBySlug(slug);
  const strip = linkStatusStrip(linkState);

  // The list carries the application rows; fetch each timeline so the inbox can
  // show the "Activity" trail without a second round trip on expand.
  const details = await Promise.all(applications.map((a) => getAdmissionApplication(a.id)));
  const events: Record<string, AdmissionEvent[]> = {};
  for (const detail of details) {
    if (detail) events[detail.application.id] = detail.events;
  }

  // How far applications get, as a share of everything filed. Used by the
  // funnel so "18% become enrolled" means something against a real total.
  const funnelBase = FUNNEL.reduce((sum, stage) => sum + (counts[stage.status] ?? 0), 0);
  const maxStage = Math.max(
    1,
    ...FUNNEL.map((stage) => counts[stage.status] ?? 0),
  );
  const enrolledPct =
    funnelBase === 0 ? 0 : Math.round(((counts.enrolled ?? 0) / funnelBase) * 100);

  return (
    <DashboardShell title="Admissions" badge="Admin">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`flex items-center gap-1.5 text-sm ${strip.tone}`}>
          <CircleDot className="size-4 shrink-0" aria-hidden="true" />
          {strip.text}
          {linkState.fee ? (
            <span className="text-muted-foreground">
              {" "}
              · application fee{" "}
              {formatNaira(linkState.fee.amount, linkState.fee.currency)}
            </span>
          ) : null}
        </p>
        <Link href="/school/admissions/settings" className="inline-flex">
          <Button variant="outline" size="sm">
            <Settings2 className="size-4" aria-hidden="true" />
            Admission settings
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="New"
          value={counts.submitted ?? 0}
          icon={Inbox}
          tone="amber"
          href="/school/admissions?status=submitted"
        />
        <StatCard
          title="Under review"
          value={counts.under_review ?? 0}
          icon={ClipboardCheck}
          tone="sky"
          index={1}
          href="/school/admissions?status=under_review"
        />
        <StatCard
          title="Offered"
          value={counts.offered ?? 0}
          icon={Award}
          tone="emerald"
          index={2}
          href="/school/admissions?status=offered"
        />
        <StatCard
          title="Enrolled"
          value={counts.enrolled ?? 0}
          icon={GraduationCap}
          tone="indigo"
          index={3}
          href="/school/admissions?status=enrolled"
        />
      </div>

      <section className="mt-5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Admission progress</h2>
          <p className="text-sm text-muted-foreground">
            {enrolledPct}% of applications end in enrolment
          </p>
        </div>
        {funnelBase === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No applications yet. Once families start applying, this shows how
            many reach each stage.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {FUNNEL.map((stage) => {
              const value = counts[stage.status] ?? 0;
              const pct = Math.round((value / maxStage) * 100);
              return (
                <li key={stage.status} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <Link
                      href={`/school/admissions?status=${stage.status}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {stage.label}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {value} of {funnelBase}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {(counts.rejected ?? 0) > 0 || (counts.withdrawn ?? 0) > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Outside the funnel: {counts.rejected ?? 0} not offered ·{" "}
            {counts.withdrawn ?? 0} withdrawn
          </p>
        ) : null}
      </section>

      <div className="mt-5">
        {activeStatus ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Showing {admissionStatusLabel(activeStatus)} applications ·{" "}
            <a href="/school/admissions" className="underline">
              show all
            </a>
          </p>
        ) : null}

        <AdmissionsInbox applications={applications} events={events} />
      </div>

      {applications.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Applicants apply from your school&apos;s public admissions page. Share the
          link with prospective families.
        </p>
      )}
    </DashboardShell>
  );
}
