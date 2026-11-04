"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "cn";
import { EduSphereLogo, LogoMark } from "@/components/brand/logo";
import type { NavItem, NavSection } from "@/config/nav";
import { navIcons } from "@/config/nav";
import { SidebarAccount } from "./sidebar-account";
import { SidebarNav } from "./sidebar-nav";

const PINNED_TITLES = new Set(["Dashboard", "Home"]);
const STORAGE_KEY = "sidebar-collapsed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readServerCollapsed(): boolean {
  return false;
}

function toggleCollapsed() {
  try {
    localStorage.setItem(STORAGE_KEY, readCollapsed() ? "0" : "1");
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((listener) => listener());
}

function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (
    href !== "/school" &&
    href !== "/teacher" &&
    href !== "/student" &&
    href !== "/parent" &&
    href !== "/platform"
  ) {
    return pathname.startsWith(href);
  }
  return false;
}

function flattenNav(sections: NavSection[]): NavItem[] {
  const pinned: NavItem[] = [];
  const rest: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (PINNED_TITLES.has(item.title)) pinned.push(item);
      else rest.push(item);
    }
  }
  return [...pinned, ...rest];
}

export function Sidebar({
  sections,
  schoolName,
  roleLabel,
  userName,
  userEmail,
  avatarUrl,
  profileHref,
}: {
  sections: NavSection[];
  schoolName?: string;
  roleLabel?: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  profileHref?: string;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, readServerCollapsed);

  const initials = (userName ?? userEmail ?? "U")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const flat = flattenNav(sections);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card/60 lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {collapsed ? (
          <LogoMark size="sm" />
        ) : (
          <EduSphereLogo variant="standard" size="sm" />
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "hidden",
          )}
        >
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {collapsed ? (
          <nav className="flex flex-col items-center gap-1 px-2 py-4">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="mb-1 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            </button>
            {flat.map((item) => {
              const Icon = navIcons[item.icon];
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="sr-only">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <SidebarNav sections={sections} />
        )}
      </div>

      <SidebarAccount
        collapsed={collapsed}
        avatarUrl={avatarUrl}
        initials={initials}
        userName={userName}
        roleLabel={roleLabel}
        schoolName={schoolName}
        profileHref={profileHref}
      />
    </aside>
  );
}
