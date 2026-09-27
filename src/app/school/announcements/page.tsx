import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getAnnouncements } from "@/services/announcements";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AnnouncementComposer,
  AnnouncementList,
} from "@/components/school/announcement-form";
import type { Announcement } from "@/types/database";
import { asArray } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false, follow: false },
};

type AnnouncementStatus = "active" | "scheduled" | "expired";

function announcementStatus(a: Announcement): AnnouncementStatus {
  const now = Date.now();
  if (a.expires_at && Date.parse(a.expires_at) < now) return "expired";
  if (Date.parse(a.published_at) > now) return "scheduled";
  return "active";
}

export default async function AnnouncementsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const [announcements, classesRes] = await Promise.all([
    getAnnouncements(schoolId),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
    ),
  ]);

  const rows: (Announcement & {
    status: AnnouncementStatus;
    className: string | null;
    authorName: string | null;
  })[] = announcements.map((a) => ({
    ...a,
    status: announcementStatus(a),
    className: asArray(a.classes)[0]?.name ?? null,
    authorName: asArray(a.author)[0]?.full_name ?? null,
  }));

  const classes = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <DashboardShell
      title="Announcements"
      badge="School"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New announcement</CardTitle>
            <CardDescription>
              Announcements appear on the relevant dashboards as soon as they
              are published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnnouncementComposer classes={classes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcements ({rows.length})</CardTitle>
            <CardDescription>
              Everyone at your school sees these on their dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnnouncementList announcements={rows} classes={classes} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}