import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotificationList } from "@/components/notifications/notification-list";
import { getNotifications } from "@/services/notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const { items, unreadCount, now } = await getNotifications(context.user.id);

  return (
    <DashboardShell title="Notifications">
      <Card>
        <CardHeader>
          <CardTitle>In-app notifications</CardTitle>
          <CardDescription>
            Announcements, assignment updates and exam results all appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationList items={items} unreadCount={unreadCount} now={now} />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}