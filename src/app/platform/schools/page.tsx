import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { School } from "lucide-react";
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
import {
  getPlatformSchools,
  schoolStatusSchema,
  type PlatformSchoolRow,
} from "@/services/platform";
import { formatPrice, getPlatformPlans, subscriptionDisplayStatus } from "@/services/billing";
import type { SubscriptionStatus } from "@/types/database";
import {
  SchoolsManager,
  type ClientPlanOption,
  type ClientSchool,
} from "@/components/platform/schools-manager";

export const metadata: Metadata = {
  title: "Schools",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The list knows nothing about the database: it is turned into plain strings
 * and ids here so the table can be a client component and drive the management
 * actions without pulling any server-only module into the browser bundle.
 */
function toClientSchool(
  s: PlatformSchoolRow,
): ClientSchool {
  const sub = subscriptionDisplayStatus({
    status: s.subscriptionStatus as SubscriptionStatus,
    current_period_end: s.periodEnd,
  });
  const status = schoolStatusSchema.safeParse(s.status);
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    educationLevel: s.educationLevel,
    status: status.success ? status.data : "inactive",
    archived: s.archived,
    motto: s.motto,
    description: s.description,
    email: s.email,
    phone: s.phone,
    address: s.address,
    city: s.city,
    state: s.state,
    website: s.website,
    ownerName: s.ownerName,
    ownerEmail: s.ownerEmail,
    students: s.students,
    teachers: s.teachers,
    planId: s.planId,
    planName: s.planName,
    subscriptionLabel: s.planName ? `${sub.label} · ${s.planName}` : sub.label,
    subscriptionTone: sub.tone === "ok" ? "ok" : "muted",
    joinedLabel: formatDate(s.createdAt),
  };
}

export default async function PlatformSchoolsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("SUPER_ADMIN")) redirect("/dashboard");

  const [schools, plans] = await Promise.all([
    getPlatformSchools(),
    getPlatformPlans(),
  ]);

  const planOptions: ClientPlanOption[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    priceLabel: `${formatPrice(p.price)}${p.billingInterval === "annual" ? "/yr" : "/mo"}`,
  }));

  return (
    <DashboardShell title="Schools" badge="Super Admin">
      <Card>
        <CardHeader>
          <CardTitle>All schools ({schools.length})</CardTitle>
          <CardDescription>
            Every school on the platform with its team size and subscription.
            Suspending a school signs all of its users out; archiving keeps the
            data and can be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolsManager
            schools={schools.map(toClientSchool)}
            plans={planOptions}
            emptyState={
              <EmptyState
                icon={School}
                title="No schools yet"
                description="Schools appear here as soon as they register and complete onboarding."
              />
            }
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}