import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, IdCard, UserRound, Cake, PhoneCall } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireStudent } from "@/services/learning";
import { getStudentProfile } from "@/services/profile";
import { formatMemberSince } from "@/lib/format";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { AccountDetailsCard } from "@/components/profile/account-details-card";
import { InfoRow } from "@/components/profile/info-row";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export default async function StudentProfilePage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const { schoolId, studentId } = await requireStudent();
  const profile = await getStudentProfile(schoolId, studentId);

  if (!profile) {
    return (
      <DashboardShell title="My Profile" badge="Student">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your profile.
        </p>
      </DashboardShell>
    );
  }

  const gradeLine = [profile.className, profile.streamName].filter(Boolean).join(" · ");
  const memberSince = formatMemberSince(context.user.created_at);

  return (
    <DashboardShell title="My Profile" badge="Student">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ProfileIdentityCard
          name={profile.displayName}
          subtitle={`Admission no. ${profile.admissionNumber}`}
          roleLabel="Student"
          email={context.user.email ?? undefined}
          avatarUrl={context.profile?.avatar_url}
          tone="sky"
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <InfoRow icon={Building2} label="Class" value={gradeLine || "—"} />
              <InfoRow
                icon={IdCard}
                label="Admission number"
                value={profile.admissionNumber}
              />
              <InfoRow
                icon={UserRound}
                label="Gender"
                value={
                  profile.gender
                    ? profile.gender[0].toUpperCase() + profile.gender.slice(1)
                    : "—"
                }
              />
              <InfoRow
                icon={Cake}
                label="Date of birth"
                value={profile.dateOfBirth ?? "—"}
              />
              <InfoRow
                icon={PhoneCall}
                label="Guardian phone"
                value={profile.guardianPhone ?? "—"}
              />
            </CardContent>
          </Card>

          <AccountDetailsCard
            email={context.user.email ?? undefined}
            memberSince={memberSince}
            initialName={profile.displayName}
            initialPhone={context.profile?.phone}
            initialAvatarUrl={context.profile?.avatar_url}
          />
        </div>
      </div>
    </DashboardShell>
  );
}