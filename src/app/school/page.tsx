import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
} from "lucide-react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "School dashboard",
  robots: { index: false, follow: false },
};

const QUICK_ACTIONS = [
  { title: "Students", href: "/school/students", icon: Users, hint: "Add or import students" },
  { title: "Teachers", href: "/school/teachers", icon: GraduationCap, hint: "Add teachers" },
  { title: "Classes & streams", href: "/school/classes", icon: BookOpen, hint: "Organise your classes" },
  { title: "Sessions", href: "/school/sessions", icon: CalendarClock, hint: "Manage terms" },
  { title: "Parents", href: "/school/parents", icon: HeartHandshake, hint: "Link students' parents" },
];

export default async function SchoolDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const isSchoolStaff = context.roles.some((role) =>
    ["SCHOOL_OWNER", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role),
  );
  if (!isSchoolStaff) redirect("/dashboard");

  const membership = context.memberships[0];
  const schoolId = membership?.school.id;

  const supabase = await createSupabaseServerClient();

  const [studentsRes, teachersRes, classesRes, subjectsRes, sessionsRes] = schoolId
    ? await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("teachers").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("subjects").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("academic_sessions").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
      ])
    : [null, null, null, null, null];

  const counts = {
    students: studentsRes?.count ?? 0,
    teachers: teachersRes?.count ?? 0,
    classes: classesRes?.count ?? 0,
    subjects: subjectsRes?.count ?? 0,
    sessions: sessionsRes?.count ?? 0,
  };

  const setupSteps = [
    { label: "Create an academic session", done: counts.sessions > 0, href: "/school/sessions" },
    { label: "Add classes", done: counts.classes > 0, href: "/school/classes" },
    { label: "Add subjects", done: counts.subjects > 0, href: "/school/subjects" },
    { label: "Add teachers", done: counts.teachers > 0, href: "/school/teachers" },
    { label: "Add students", done: counts.students > 0, href: "/school/students" },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;

  return (
    <DashboardShell title="School Dashboard" badge="Administrator">
      {welcome && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          <span>
            Your school is set up. Welcome to {membership?.school.name ?? "EduSphere"}!
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Students" value={counts.students} icon={Users} href="/school/students" tone="emerald" />
        <StatCard title="Teachers" value={counts.teachers} icon={GraduationCap} href="/school/teachers" tone="sky" index={1} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card className="animate-card-enter" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle>Setup progress</CardTitle>
            <CardDescription>
              {setupDone} of {setupSteps.length} steps complete
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5">
              {setupSteps.map((step) => (
                <li key={step.label}>
                  <Link
                    href={step.href}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      {step.done ? (
                        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <span className="size-4 rounded-full border border-muted-foreground/40" />
                      )}
                      {step.label}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="animate-card-enter" style={{ animationDelay: "280ms" }}>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common things you do every day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <action.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{action.title}</span>
                    <span className="block text-xs text-muted-foreground">{action.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}