import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/services/billing";
import { getServerData } from "@/lib/server-cache";

export type PlatformSchoolRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  students: number;
  teachers: number;
  subscriptionStatus: string;
  planName: string | null;
  periodEnd: string | null;
  createdAt: string;
};

export async function getPlatformSchools(): Promise<PlatformSchoolRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  return getServerData("platform:schools", 30_000, async () => {
    const [schoolsRes, studentsRes, teachersRes, subsRes] = await Promise.all([
    admin
      .from("schools")
      .select(
        "id, name, slug, status, city, state, created_at, profiles!schools_owner_id_fkey(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("students").select("school_id"),
    admin.from("teachers").select("school_id"),
    admin
      .from("subscriptions")
      .select("school_id, status, current_period_end, subscription_plans(name)")
      .order("created_at", { ascending: false }),
  ]);

  const studentCount = new Map<string, number>();
  for (const s of (studentsRes.data ?? []) as { school_id: string }[]) {
    studentCount.set(s.school_id, (studentCount.get(s.school_id) ?? 0) + 1);
  }
  const teacherCount = new Map<string, number>();
  for (const t of (teachersRes.data ?? []) as { school_id: string }[]) {
    teacherCount.set(t.school_id, (teacherCount.get(t.school_id) ?? 0) + 1);
  }

  const subBySchool = new Map<
    string,
    { status: string; current_period_end: string | null; planName: string | null }
  >();
  for (const s of (subsRes.data ?? []) as {
    school_id: string;
    status: string;
    current_period_end: string | null;
    subscription_plans: { name: string }[] | null;
  }[]) {
    if (!subBySchool.has(s.school_id)) {
      subBySchool.set(s.school_id, {
        status: s.status,
        current_period_end: s.current_period_end,
        planName: s.subscription_plans?.[0]?.name ?? null,
      });
    }
  }

  return ((schoolsRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    city: string | null;
    state: string | null;
    created_at: string;
    profiles: { full_name: string | null; email: string | null }[] | null;
  }>).map((s) => {
    const sub = subBySchool.get(s.id);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      city: s.city,
      state: s.state,
      ownerName: s.profiles?.[0]?.full_name ?? null,
      ownerEmail: s.profiles?.[0]?.email ?? null,
      students: studentCount.get(s.id) ?? 0,
      teachers: teacherCount.get(s.id) ?? 0,
      subscriptionStatus: sub?.status ?? "inactive",
      planName: sub?.planName ?? null,
      periodEnd: sub?.current_period_end ?? null,
      createdAt: s.created_at,
    };
  });
  });
}

export type PlatformAnalytics = {
  totalSchools: number;
  activeSchools: number;
  pendingSchools: number;
  totalStudents: number;
  totalTeachers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  annualRevenue: number;
  planDistribution: { label: string; count: number }[];
  recentSchools: { id: string; name: string; status: string; createdAt: string }[];
};

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  return getServerData("platform:analytics", 30_000, async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    totalRes,
    activeRes,
    pendingRes,
    studentsRes,
    teachersRes,
    subsRes,
    paidRes,
    schoolsRes,
  ] = await Promise.all([
    admin.from("schools").select("id", { count: "exact", head: true }),
    admin.from("schools").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("schools").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("students").select("id", { count: "exact", head: true }),
    admin.from("teachers").select("id", { count: "exact", head: true }),
    admin
      .from("subscriptions")
      .select("subscription_plans(name)")
      .eq("status", "active"),
    admin.from("payments").select("amount, paid_at").eq("status", "paid"),
    admin
      .from("schools")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  let monthlyRevenue = 0;
  let annualRevenue = 0;
  for (const p of (paidRes.data ?? []) as { amount: number; paid_at: string | null }[]) {
    if (!p.paid_at) continue;
    const amount = Number(p.amount);
    if (p.paid_at >= monthStart) monthlyRevenue += amount;
    if (p.paid_at >= yearStart) annualRevenue += amount;
  }

  const planCount = new Map<string, number>();
  for (const s of (subsRes.data ?? []) as {
    subscription_plans: { name: string }[] | null;
  }[]) {
    const label = s.subscription_plans?.[0]?.name ?? "No plan";
    planCount.set(label, (planCount.get(label) ?? 0) + 1);
  }
  const planDistribution = [...planCount.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSchools: totalRes.count ?? 0,
    activeSchools: activeRes.count ?? 0,
    pendingSchools: pendingRes.count ?? 0,
    totalStudents: studentsRes.count ?? 0,
    totalTeachers: teachersRes.count ?? 0,
    activeSubscriptions: subsRes.data?.length ?? 0,
    monthlyRevenue,
    annualRevenue,
    planDistribution,
    recentSchools: ((schoolsRes.data ?? []) as {
      id: string;
      name: string;
      status: string;
      created_at: string;
    }[]).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.created_at,
    })),
  };
  });
}

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  schoolName: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  createdAt: string;
};

export async function getSupportTickets(): Promise<SupportTicket[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("support_tickets")
    .select("*, schools(name), profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    created_at: string;
    schools: { name: string }[] | null;
    profiles: { full_name: string | null; email: string | null }[] | null;
  }>).map((t) => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    priority: t.priority,
    schoolName: t.schools?.[0]?.name ?? null,
    reporterName: t.profiles?.[0]?.full_name ?? null,
    reporterEmail: t.profiles?.[0]?.email ?? null,
    createdAt: t.created_at,
  }));
}

export async function setSupportTicketStatus(id: string, status: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("support_tickets")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error("We couldn't update the ticket.");
}

export type PlatformUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  memberships: { schoolId: string; schoolName: string; role: string }[];
};

export const USER_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_OWNER: "Owner",
  SCHOOL_ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

export function userRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [profilesRes, rolesRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("user_roles")
      .select("user_id, school_id, role, schools(name)")
      .order("created_at", { ascending: true }),
  ]);

  const rolesByUser = new Map<string, { schoolId: string; schoolName: string; role: string }[]>();
  for (const r of (rolesRes.data ?? []) as {
    user_id: string;
    school_id: string | null;
    role: string;
    schools: { name: string }[] | null;
  }[]) {
    if (!r.user_id) continue;
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push({
      schoolId: r.school_id ?? "",
      schoolName: r.school_id ? (r.schools?.[0]?.name ?? "School") : "Platform",
      role: r.role,
    });
    rolesByUser.set(r.user_id, list);
  }

  return ((profilesRes.data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
  }>).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? "Unnamed user",
    email: p.email,
    phone: p.phone,
    avatarUrl: p.avatar_url,
    createdAt: p.created_at,
    memberships: rolesByUser.get(p.id) ?? [],
  }));
}