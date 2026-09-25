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
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  notificationUnread?: number;
  profileHref?: string;
};

export function AppShell({
  children,
  sections,
  bottomNav,
  title,
  badge,
  schoolName,
  userName,
  userEmail,
  avatarUrl,
  notificationUnread,
  profileHref,
}: ShellProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-muted/30">
      <div className="flex h-dvh w-full max-w-md flex-col bg-background sm:max-w-lg lg:max-w-3xl lg:border-x lg:shadow-2xl">
        <Header
          sections={sections}
          title={title}
          badge={badge}
          schoolName={schoolName}
          userName={userName}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
          notificationUnread={notificationUnread}
          profileHref={profileHref}
        />
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-8 md:px-6">
          {children}
        </main>
        <MobileBottomNav items={bottomNav} />
      </div>
    </div>
  );
}

export { navIcons };