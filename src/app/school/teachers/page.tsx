import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getStaffAccounts, getTeachers } from "@/services/people";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TeacherForm } from "@/components/school/people-form";
import { StaffAccountForm } from "@/components/school/staff-account-form";
import { asArray } from "@/lib/embed";
import { GraduationCap, ShieldCheck, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Teachers",
  robots: { index: false, follow: false },
};

export default async function TeachersPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();
  const [teachers, staff] = await Promise.all([
    getTeachers(schoolId),
    getStaffAccounts(schoolId),
  ]);

  const rows = teachers.map((t) => ({
    id: t.id,
    name: asArray(t.profile)[0]?.full_name ?? t.display_name ?? "Unnamed teacher",
    email: asArray(t.profile)[0]?.email ?? null,
    hasAccount: !!t.user_id,
  }));

  return (
    <DashboardShell title="Teachers" badge="Staff">
      <div className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card tone="indigo">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <GraduationCap className="size-4" aria-hidden="true" />
                Add teacher
              </CardTitle>
              <CardDescription className="text-xs">
                Teachers with an email get a login account (default password from{" "}
                <code className="rounded bg-muted px-1">DEFAULT_ACCOUNT_PASSWORD</code>).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeacherForm />
            </CardContent>
          </Card>

          <Card tone="violet">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Principal &amp; bursar accounts
              </CardTitle>
              <CardDescription className="text-xs">
                Staff who run the school or the fee desk but do not teach. They get
                a login without joining the teaching roster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffAccountForm />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Teachers ({rows.length})</CardTitle>
              <CardDescription className="text-xs">
                Everyone currently on your teaching staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No teachers yet"
                  description="Add your first teacher and their classes, timetable and assignments will hang off their account."
                />
              ) : (
                <ul className="grid gap-1.5">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {row.email ?? "No email (no login yet)"}
                        </p>
                      </div>
                      {row.hasAccount ? (
                        <Badge variant="success">Login ready</Badge>
                      ) : (
                        <Badge variant="outline">No login</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card tone="violet">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fee-desk access ({staff.length})</CardTitle>
              <CardDescription className="text-xs">
                Principals and bursars who can open fees, invoices and payment
                approvals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {staff.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  No principal or bursar yet. Owners and admins keep the fee desk to
                  themselves until one is added.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {staff.map((member) => (
                    <li
                      key={`${member.userId}-${member.role}`}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.fullName ?? "Unnamed"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {member.email ?? "No email"}
                        </p>
                      </div>
                      <Badge variant={member.role === "BURSAR" ? "teal" : "violet"}>
                        {member.role === "BURSAR" ? (
                          <Wallet className="size-3" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="size-3" aria-hidden="true" />
                        )}
                        {member.role === "BURSAR" ? "Bursar" : "Principal"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
