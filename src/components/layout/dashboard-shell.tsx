import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthContext, type AuthContext, type Membership } from "@/lib/auth/auth-context";
import { AppShell } from "./app-shell";
import { getUnreadNotificationCount } from "@/services/notifications";
import {
  parentNav,
  platformNav,
  schoolNav,
  studentNav,
  teacherNav,
  type NavItem,
  type NavSection,
} from "@/config/nav";

type ShellKind =
  | "platform"
  | "school"
  | "teacher"
  | "student"
  | "parent"
  | "no-role";

function resolveKind(context: AuthContext): ShellKind {
  const roles = context.roles;
  if (roles.includes("SUPER_ADMIN")) return "platform";
  if (roles.includes("SCHOOL_OWNER") || roles.includes("SCHOOL_ADMIN") || roles.includes("PRINCIPAL")) {
    return "school";
  }
  if (roles.includes("TEACHER")) return "teacher";
  if (roles.includes("STUDENT")) return "student";
  if (roles.includes("PARENT")) return "parent";
  return "no-role";
}

const navFor: Record<ShellKind, { sections: NavSection[]; bottom: NavItem[]; profileHref: string }> = {
  platform: {
    sections: platformNav,
    profileHref: "/platform/profile",
    bottom: [
      { title: "Home", href: "/platform", icon: "home" },
      { title: "Schools", href: "/platform/schools", icon: "students" },
      { title: "Settings", href: "/platform/settings", icon: "settings" },
    ],
  },
  school: {
    sections: schoolNav,
    profileHref: "/school/profile",
    bottom: [
      { title: "Home", href: "/school", icon: "home" },
      { title: "Students", href: "/school/students", icon: "students" },
      { title: "Classes", href: "/school/classes", icon: "classes" },
      { title: "Settings", href: "/school/settings", icon: "settings" },
    ],
  },
  teacher: {
    sections: teacherNav,
    profileHref: "/teacher/profile",
    bottom: [
      { title: "Home", href: "/teacher", icon: "home" },
      { title: "Content", href: "/teacher/courses", icon: "courses" },
      { title: "Tests", href: "/teacher/exam-series", icon: "examinations" },
      { title: "More", href: "/teacher/question-bank", icon: "questionBank" },
    ],
  },
  student: {
    sections: studentNav,
    profileHref: "/student/profile",
    bottom: [
      { title: "Home", href: "/student", icon: "home" },
      { title: "Learn", href: "/student/courses", icon: "courses" },
      { title: "Tests", href: "/student/exam-series", icon: "examinations" },
      { title: "Results", href: "/student/results", icon: "results" },
      { title: "Profile", href: "/student/profile", icon: "profile" },
    ],
  },
  parent: {
    sections: parentNav,
    profileHref: "/parent/profile",
    bottom: [
      { title: "Home", href: "/parent", icon: "home" },
      { title: "Children", href: "/parent/children", icon: "students" },
      { title: "Results", href: "/parent/results", icon: "results" },
      { title: "Profile", href: "/parent/profile", icon: "profile" },
    ],
  },
  "no-role": {
    sections: [],
    profileHref: "/dashboard",
    bottom: [],
  },
};

async function NotificationUnreadBadge({ userId }: { userId: string }) {
  const unread = await getUnreadNotificationCount(userId);
  if (unread === 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}

export async function DashboardShell({
  children,
  title,
  badge,
}: {
  children: React.ReactNode;
  title: string;
  badge?: string;
}) {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/auth/login");
  }

  const kind = resolveKind(context);

  if (kind === "no-role") {
    redirect("/auth/login");
  }

  const firstMembership: Membership | undefined = context.memberships[0];
  const notificationUnread = context.user ? (
    <Suspense fallback={null}>
      <NotificationUnreadBadge userId={context.user.id} />
    </Suspense>
  ) : undefined;

  return (
    <AppShell
      sections={navFor[kind].sections}
      bottomNav={navFor[kind].bottom}
      title={title}
      badge={badge}
      schoolName={firstMembership?.school.name}
      userName={context.profile?.full_name ?? undefined}
      userEmail={context.user.email ?? undefined}
      avatarUrl={context.profile?.avatar_url}
      notificationUnread={notificationUnread}
      profileHref={navFor[kind].profileHref}
    >
      {children}
    </AppShell>
  );
}