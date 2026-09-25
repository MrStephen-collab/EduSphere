import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your school",
  robots: { index: false, follow: false },
};

export type OnboardingInit = {
  schoolId: string | null;
  schoolName: string | null;
  hasSession: boolean;
  classNames: string[];
  subjects: { name: string; code: string | null }[];
};

export default async function OnboardingPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  if (context.memberships.length > 0) {
    const supabase = await createSupabaseServerClient();
    const schoolId = context.memberships[0].school.id;

    const [classesRes, sessionsRes] = await Promise.all([
      supabase.from("classes").select("id").eq("school_id", schoolId).limit(1),
      supabase
        .from("academic_sessions")
        .select("id")
        .eq("school_id", schoolId)
        .limit(1),
    ]);

    const complete =
      (classesRes.data?.length ?? 0) > 0 &&
      (sessionsRes.data?.length ?? 0) > 0;
    if (complete) redirect("/school");

    const [classesFull, subjectsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("name")
        .eq("school_id", schoolId)
        .order("order", { ascending: true }),
      supabase
        .from("subjects")
        .select("name, code")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
    ]);

    const init: OnboardingInit = {
      schoolId,
      schoolName: context.memberships[0].school.name,
      hasSession: (sessionsRes.data?.length ?? 0) > 0,
      classNames: classesFull.data?.map((c) => c.name) ?? [],
      subjects:
        subjectsRes.data?.map((s) => ({ name: s.name, code: s.code })) ?? [],
    };
    return <OnboardingWizard init={init} />;
  }

  return <OnboardingWizard init={{ schoolId: null, schoolName: null, hasSession: false, classNames: [], subjects: [] }} />;
}