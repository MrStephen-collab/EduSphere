import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { getSchoolGallery } from "@/services/school-media";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  AddGalleryItemForm,
  GalleryGrid,
} from "@/components/school/gallery-manager";

export const metadata: Metadata = {
  title: "School media",
  robots: { index: false, follow: false },
};

export default async function SchoolMediaPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const items = await getSchoolGallery(schoolId);

  return (
    <DashboardShell title="School Media" badge="Admin">
      <div className="grid gap-4">
        <AddGalleryItemForm />
        <GalleryGrid items={items} />
      </div>
    </DashboardShell>
  );
}