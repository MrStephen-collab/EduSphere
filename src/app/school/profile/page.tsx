import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, MapPin, Phone, Mail, Globe } from "lucide-react";
import { requireSchoolAdmin } from "@/services/shared";
import { primaryRoleLabel } from "@/lib/auth/roles";
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

export default async function SchoolProfilePage() {
  const { context, schoolName } = await requireSchoolAdmin();
  if (!context.user) redirect("/auth/login");

  const school = context.memberships.find(
    (m) => m.role === "SCHOOL_OWNER" || m.role === "SCHOOL_ADMIN" || m.role === "PRINCIPAL",
  )?.school;

  const displayName = context.profile?.full_name ?? "School administrator";
  const location = [school?.city, school?.state, school?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <DashboardShell title="My Profile" badge={primaryRoleLabel(context.roles)}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ProfileIdentityCard
          name={displayName}
          subtitle={schoolName}
          roleLabel={primaryRoleLabel(context.roles)}
          email={context.user.email ?? undefined}
          avatarUrl={context.profile?.avatar_url}
          tone="indigo"
        />

        <div className="grid gap-4">
          {school && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Building2 className="size-4" aria-hidden="true" />
                  {schoolName}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {location && (
                  <InfoRow icon={MapPin} label="Location" value={location} />
                )}
                {school.email && (
                  <InfoRow icon={Mail} label="Email" value={school.email} />
                )}
                {school.phone && (
                  <InfoRow icon={Phone} label="Phone" value={school.phone} />
                )}
                {school.website && (
                  <InfoRow icon={Globe} label="Website" value={school.website} />
                )}
              </CardContent>
            </Card>
          )}

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