import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, PenLine } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getSeriesMarkingQueue } from "@/services/exam";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mark essays",
  robots: { index: false, follow: false },
};

export default async function TeacherSeriesMarkingPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();
  const queue = await getSeriesMarkingQueue(schoolId, seriesId);

  return (
    <DashboardShell title="Mark Essays" badge="Teacher">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{queue.seriesTitle}</p>
            <p className="text-xs text-muted-foreground">
              Student essay answers on this series, waiting for your marks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={queue.pendingAttempts > 0 ? "default" : "outline"}>
              <PenLine className="mr-1 size-3" aria-hidden="true" />
              {queue.pendingAttempts} essay answer{queue.pendingAttempts === 1 ? "" : "s to mark"}
            </Badge>
            <Link href={`/teacher/exam-series/${seriesId}`} className="inline-flex">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to series
              </Button>
            </Link>
          </div>
        </div>

        {queue.items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to mark"
            description="No submitted attempts with essay answers on this series. Essay answers appear here as soon as students submit them."
          />
        ) : (
          <div className="grid gap-3">
            {queue.items.map((item) => (
              <Link
                key={item.attemptId}
                href={`/teacher/exam-series/${seriesId}/marking/${item.attemptId}`}
                className="inline-flex"
              >
                <Card className="w-full transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <div className="grid">
                      <p className="font-semibold">{item.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.admissionNumber}
                        {item.className ? ` · ${item.className}` : ""}
                      </p>
                      {item.submittedAt && (
                        <p className="text-xs text-muted-foreground">
                          Submitted{" "}
                          {new Date(item.submittedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.autoScore != null && item.autoTotal != null && (
                        <Badge variant="outline">
                          Objective {item.autoScore}/{item.autoTotal}
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {item.essayCount} essay{item.essayCount === 1 ? "" : "s"}
                      </Badge>
                      {item.pendingCount > 0 && (
                        <Badge variant="destructive">{item.pendingCount} pending</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}