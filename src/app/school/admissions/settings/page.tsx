import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Settings2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getAdmissionSettings } from "@/services/admissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { AdmissionSettingsForm } from "@/components/school/admission-settings-form";

export const metadata: Metadata = {
  title: "Admission settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdmissionSettingsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.some((r) => r === "SCHOOL_OWNER" || r === "SCHOOL_ADMIN")) {
    redirect("/school");
  }

  // The manager membership's school carries the slug the public page lives
  // under. `getAdmissionSettings` re-derives the school from the caller, so
  // this lookup is only for the link URL.
  const membership = context.memberships.find(
    (m) => m.role === "SCHOOL_OWNER" || m.role === "SCHOOL_ADMIN",
  );
  if (!membership) redirect("/school");

  const settings = await getAdmissionSettings();
  const slug = membership.school.slug;

  return (
    <DashboardShell title="Admission Settings" badge="Admin">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/school/admissions" className="inline-flex">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to inbox
            </Button>
          </Link>
          <a
            href={`/schools/${slug}/admissions`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4" aria-hidden="true" />
              Open public page
            </Button>
          </a>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Settings2 className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Decide when your school accepts applications and what applicants
              see. Changes take effect on the public page immediately.
            </p>
          </div>
          <AdmissionSettingsForm settings={settings} slug={slug} />
        </div>
      </div>
    </DashboardShell>
  );
}
