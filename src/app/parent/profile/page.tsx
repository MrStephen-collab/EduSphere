import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartHandshake, GraduationCap } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireParent, getParentChildren } from "@/services/parent";
import { getParentProfile } from "@/services/profile";
import { formatMemberSince } from "@/lib/format";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { AccountDetailsCard } from "@/components/profile/account-details-card";
import { initials } from "@/components/profile/initials";

export const metadata: Metadata = {
  title: "My profile",
  robots: { index: false, follow: false },
};

export default async function ParentProfilePage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const { schoolId, parentId } = await requireParent();
  const [profile, children] = await Promise.all([
    getParentProfile(schoolId, parentId),
    getParentChildren(schoolId, parentId),
  ]);

  if (!profile) {
    return (
      <DashboardShell title="My Profile" badge="Parent">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your profile.
        </p>
      </DashboardShell>
    );
  }

  const memberSince = formatMemberSince(context.user.created_at);

  return (
    <DashboardShell title="My Profile" badge="Parent">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ProfileIdentityCard
          name={profile.displayName}
          subtitle={profile.relationship ?? undefined}
          roleLabel="Parent"
          email={context.user.email ?? undefined}
          avatarUrl={context.profile?.avatar_url}
          tone="emerald"
        />

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <HeartHandshake className="size-4" aria-hidden="true" />
                My children
              </CardTitle>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No children linked"
                  description="The school hasn't linked any students to this account yet."
                />
              ) : (
                <ul className="grid gap-2">
                  {children.map((child) => (
                    <li
                      key={child.studentId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback className="text-xs">
                            {initials(child.displayName ?? "S")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid">
                          <span className="font-medium">{child.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {child.admissionNumber}
                            {child.className ? ` · ${child.className}` : ""}
                            {child.streamName ? ` · ${child.streamName}` : ""}
                            {child.gender ? ` · ${child.gender}` : ""}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" render={<Link href="/parent/children" />}>
                        View progress
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
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