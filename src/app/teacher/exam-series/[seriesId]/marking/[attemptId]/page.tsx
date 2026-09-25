import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getAttemptForMarking } from "@/services/exam";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { MarkingForm } from "@/components/exam/marking-form";

export const metadata: Metadata = {
  title: "Mark attempt",
  robots: { index: false, follow: false },
};

export default async function TeacherSeriesMarkingAttemptPage({
  params,
}: {
  params: Promise<{ seriesId: string; attemptId: string }>;
}) {
  const { seriesId, attemptId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();
  const attempt = await getAttemptForMarking(schoolId, seriesId, attemptId);

  if (!attempt) {
    return (
      <DashboardShell title="Attempt not found">
        <p className="text-sm text-muted-foreground">
          This attempt doesn&apos;t exist or isn&apos;t part of this series.
        </p>
        <Link href={`/teacher/exam-series/${seriesId}/marking`} className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to marking
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={`Mark ${attempt.studentName}`} badge="Teacher">
      <div className="grid gap-4">
        <MarkingForm attempt={attempt} />
      </div>
    </DashboardShell>
  );
}