import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare, UsersRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ClientUsersTable } from "@/components/platform/users-table";
import { getPlatformUsers, USER_ROLE_LABELS } from "@/services/platform";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default async function PlatformUsersPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const users = await getPlatformUsers();
  const totalMemberships = users.reduce((sum, u) => sum + u.memberships.length, 0);

  return (
    <DashboardShell title="Users" badge="Platform">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="grid gap-1 pt-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UsersRound className="size-4" aria-hidden="true" />
                Accounts
              </p>
              <p className="text-2xl font-semibold">{users.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-1 pt-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MessagesSquare className="size-4" aria-hidden="true" />
                School memberships
              </p>
              <p className="text-2xl font-semibold">{totalMemberships}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-1 pt-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UsersRound className="size-4" aria-hidden="true" />
                Roles in use
              </p>
              <p className="text-2xl font-semibold">
                {new Set(users.flatMap((u) => u.memberships.map((m) => USER_ROLE_LABELS[m.role] ?? m.role))).size}
              </p>
            </CardContent>
          </Card>
        </div>

        {users.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No users yet"
            description="Accounts appear here as schools onboard students, teachers and parents."
          />
        ) : (
          <ClientUsersTable users={users} roleLabels={USER_ROLE_LABELS} />
        )}
      </div>
    </DashboardShell>
  );
}