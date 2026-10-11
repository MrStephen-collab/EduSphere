import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import type { NavItem, NavSection } from "@/config/nav";
import { navIcons } from "@/config/nav";

type ShellProps = {
  children: React.ReactNode;
  sections: NavSection[];
  bottomNav: NavItem[];
  title: string;
  badge?: string;
  schoolName?: string;
  roleLabel?: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  notificationUnread?: React.ReactNode;
  profileHref?: string;
};

export function AppShell({
  children,
  sections,
  bottomNav,
  title,
  badge,
  schoolName,
  roleLabel,
  userName,
  userEmail,
  avatarUrl,
  notificationUnread,
  profileHref,
}: ShellProps) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        sections={sections}
        schoolName={schoolName}
        roleLabel={roleLabel}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        profileHref={profileHref}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          sections={sections}
          title={title}
          badge={badge}
          schoolName={schoolName}
          roleLabel={roleLabel}
          userName={userName}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
          notificationUnread={notificationUnread}
          profileHref={profileHref}
        />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 md:px-6 lg:px-8 lg:pb-10">
            {children}
          </div>
        </main>
        <MobileBottomNav items={bottomNav} />
      </div>
    </div>
  );
}

export { navIcons };
