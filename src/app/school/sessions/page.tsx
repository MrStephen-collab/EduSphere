import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSessions, getTerms } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionsManager } from "@/components/school/sessions-manager";

export const metadata: Metadata = {
  title: "Academic sessions",
  robots: { index: false, follow: false },
};

export default async function SessionsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const sessions = await getSessions(schoolId);
  const withTerms = await Promise.all(
    sessions.map(async (session) => ({
      ...session,
      terms: await getTerms(session.id),
    })),
  );

  return (
    <DashboardShell title="Academic Sessions">
      <div className="max-w-3xl">
        <SessionsManager sessions={withTerms} />
      </div>
    </DashboardShell>
  );
}