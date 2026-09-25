import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SupportTicketList } from "@/components/platform/support-tickets";
import { getSupportTickets } from "@/services/platform";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function PlatformSupportPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const tickets = await getSupportTickets();

  return (
    <DashboardShell title="Support" badge="Super Admin">
      <Card>
        <CardHeader>
          <CardTitle>Support tickets ({tickets.length})</CardTitle>
          <CardDescription>
            Open issues raised by schools across the platform. Change a ticket
            status to keep it moving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No support tickets"
              description="Tickets raised by schools will appear here."
            />
          ) : (
            <SupportTicketList tickets={tickets} />
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}