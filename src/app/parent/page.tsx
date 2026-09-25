import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { getParentChildren, requireParent } from "@/services/parent";
import { getStudentResults } from "@/services/analytics";
import { getParentAnnouncements } from "@/services/announcements";
import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Parent dashboard",
  robots: { index: false, follow: false },
};

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
}

function ParentDashboardSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-44 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            <div className="skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </>
  );
}

async function ParentDashboardContent({
  schoolId,
  parentId,
  kids,
}: {
  schoolId: string;
  parentId: string;
  kids: Awaited<ReturnType<typeof getParentChildren>>;
}) {
  const [announcements, rows] = await Promise.all([
    getParentAnnouncements(schoolId, parentId),
    Promise.all(
      kids.map((c) =>
        getStudentResults(schoolId, c.studentId).then((r) => ({
          child: c,
          data: r,
        })),
      ),
    ),
  ]);

  const overallAverage = avg(rows.map((r) => r.data.overallAverage));
  const practiceAttempts = rows.reduce((s, r) => s + r.data.practiceAttempts, 0);
  const gradedWork = rows.reduce(
    (s, r) => s + r.data.gradedAssignments.length + r.data.results.length,
    0,
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Children" value={kids.length} icon={UsersRound} href="/parent/children" tone="indigo" />
        <StatCard
          title="Average Performance"
          value={overallAverage != null ? `${overallAverage}%` : "—"}
          icon={BarChart3}
          href="/parent/results"
          tone="emerald"
          index={1}
          hint="Across linked children"
        />
        <StatCard
          title="Practice Attempts"
          value={practiceAttempts}
          icon={BookOpenCheck}
          href="/parent/progress"
          tone="rose"
          index={2}
          hint="Across your children"
        />
        <StatCard
          title="Graded Work"
          value={gradedWork}
          icon={ClipboardList}
          href="/parent/assignments"
          tone="amber"
          index={3}
          hint="Results + graded assignments"
        />
      </div>

      <AnnouncementBanner announcements={announcements} className="mt-6" />

      {kids.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={UsersRound}
            title="No children linked yet"
            description="Children linked to your account will appear here, giving you access to their results, assignments and progress. Ask your school to link your account."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ child, data }) => (
            <Card key={child.studentId}>
              <CardContent className="grid gap-3 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      <UserRoundCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {child.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {child.className ?? "No class"}
                      {child.streamName ? ` · ${child.streamName}` : ""} · {child.admissionNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {data.overallAverage != null ? `${data.overallAverage}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.grade ? `Grade ${data.grade}` : "No results yet"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Link href={`/parent/results?child=${child.studentId}`} className="inline-flex">
                    <Button variant="outline" className="w-full justify-between">
                      <span>Results &amp; analytics</span>
                    </Button>
                  </Link>
                  <Link href={`/parent/assignments?child=${child.studentId}`} className="inline-flex">
                    <Button variant="outline" className="w-full justify-between">
                      <span>Assignments</span>
                    </Button>
                  </Link>
                  <Link href={`/parent/report-cards?child=${child.studentId}`} className="inline-flex">
                    <Button variant="outline" className="w-full justify-between">
                      <span>Report cards</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}

          <Link href="/parent/children" className="inline-flex">
            <Card className="flex h-full min-h-40 w-full items-center justify-center border-dashed hover:bg-muted/40">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <GraduationCap className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">View all children</p>
                <p className="text-xs text-muted-foreground">
                  Every linked child &amp; their progress in one place.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </>
  );
}

export default async function ParentDashboardPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("PARENT")) redirect("/dashboard");

  const { schoolId, parentId } = await requireParent();
  const children = await getParentChildren(schoolId, parentId);

  return (
    <DashboardShell title="Parent Dashboard" badge="Parent">
      <Suspense fallback={<ParentDashboardSkeleton />}>
        <ParentDashboardContent schoolId={schoolId} parentId={parentId} kids={children} />
      </Suspense>
    </DashboardShell>
  );
}