import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { formatMemberSince } from "@/lib/format";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { AccountDetailsCard } from "@/components/profile/account-details-card";
import { InfoRow } from "@/components/profile/info-row";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export default async function PlatformProfilePage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const displayName = context.profile?.full_name ?? "Platform administrator";

  return (
    <DashboardShell title="My Profile" badge="Super admin">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ProfileIdentityCard
          name={displayName}
          roleLabel="Super admin"
          email={context.user.email ?? undefined}
          avatarUrl={context.profile?.avatar_url}
          tone="amber"
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Platform access
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <InfoRow icon={ShieldCheck} label="Role" value="Super admin" />
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