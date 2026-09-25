import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireSchoolAdmin } from "@/services/shared";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingForm, type BrandingFormData } from "@/components/school/branding-form";

export const metadata: Metadata = {
  title: "Branding",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  const { schoolId } = await requireSchoolAdmin();

  const supabase = await createSupabaseServerClient();
  const [schoolRes, brandingRes] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId).single(),
    supabase.from("school_branding").select("*").eq("school_id", schoolId).maybeSingle(),
  ]);

  const school = schoolRes.data;
  const branding = brandingRes.data;

  const initial: BrandingFormData = {
    name: school?.name ?? "",
    motto: school?.motto ?? "",
    email: school?.email ?? "",
    phone: school?.phone ?? "",
    address: school?.address ?? "",
    city: school?.city ?? "",
    state: school?.state ?? "",
    website: school?.website ?? "",
    primaryColor: branding?.primary_color ?? "#2563eb",
    secondaryColor: branding?.secondary_color ?? "#334155",
    accentColor: branding?.accent_color ?? "#0ea5e9",
  };

  return (
    <DashboardShell title="Branding & Settings">
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>School details</CardTitle>
            <CardDescription>
              These details appear on certificates, reports and the public profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingForm initial={initial} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4" aria-hidden="true" />
              Public website
            </CardTitle>
            <CardDescription>
              A public page for this school on the EduSphere network. Students, parents
              and visitors can see news, events, gallery and admissions info — no login
              required.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {school?.slug ? (
              <>
                <code className="rounded-md bg-muted px-2.5 py-1 text-sm">
                  {`/schools/${school.slug}`}
                </code>
                <Button
                  size="sm"
                  render={<Link href={`/schools/${school.slug}`} target="_blank" />}
                >
                  Preview website
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Save the school name to generate a public website link.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}