import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
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

export default async function TeacherProfilePage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolName } = await requireContentEditor();
  const displayName = context.profile?.full_name ?? "Teacher";

  return (
    <DashboardShell title="My Profile" badge="Teacher">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ProfileIdentityCard
          name={displayName}
          subtitle={schoolName}
          roleLabel="Teacher"
          email={context.user.email ?? undefined}
          avatarUrl={context.profile?.avatar_url}
          tone="fuchsia"
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teaching</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <InfoRow icon={Building2} label="School" value={schoolName} />
            </CardContent>
          </Card>

          <AccountDetailsCard
            email={context.user.email ?? undefined}
            memberSince={formatMemberSince(context.user.created_at)}
            initialName={displayName}
            initialPhone={context.profile?.phone}
            initialAvatarUrl={context.profile?.avatar_url}
          />
        </div>
      </div>
    </DashboardShell>
  );
}