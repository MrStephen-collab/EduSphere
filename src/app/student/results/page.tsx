import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpenCheck, MoveUpRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentResults } from "@/services/analytics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { ResultsOverview } from "@/components/results/results-overview";

export const metadata: Metadata = {
  title: "My results",
  robots: { index: false, follow: false },
};

export default async function StudentResultsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("STUDENT")) redirect("/dashboard");

  const { schoolId, studentId } = await requireStudent();
  const data = await getStudentResults(schoolId, studentId);

  return (
    <DashboardShell title="My Results" badge="Student">
      <ResultsOverview
        data={data}
        footer={
          <Link href="/student/exam-series" className="inline-flex">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <BookOpenCheck className="size-4" aria-hidden="true" />
                Improve your average — practise more series
              </span>
              <MoveUpRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        }
      />
    </DashboardShell>
  );
}