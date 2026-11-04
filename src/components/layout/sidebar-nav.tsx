"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import type { NavItem, NavSection } from "@/config/nav";
import { navIcons } from "@/config/nav";

const PINNED_TITLES = new Set(["Dashboard", "Home"]);

function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (
    href !== "/school" &&
    href !== "/teacher" &&
    href !== "/student" &&
    href !== "/parent"
  ) {
    return pathname.startsWith(href);
  }
  return false;
}

export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  /** Called after a destination is chosen, so a drawer can close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const pinned: NavItem[] = [];
  const groups: NavSection[] = [];

  for (const section of sections) {
    const pinIndex = section.items.findIndex((item) => PINNED_TITLES.has(item.title));
    if (pinIndex !== -1) pinned.push(section.items[pinIndex]);
    const rest = section.items.filter((_, i) => i !== pinIndex);
    if (rest.length > 0) {
      groups.push({ label: section.label, items: rest });
    }
  }

  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {pinned.length > 0 && (
        <div className="flex flex-col gap-1">
          {pinned.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      {groups.map((group) => (
        <NavGroup
          key={group.label ?? "group"}
          group={group}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = navIcons[item.icon];
  const active = isActive(item.href, pathname);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-gradient-to-r from-primary/15 via-primary/10 to-blue-500/10 text-primary shadow-xs"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-blue-500"
        />
      )}
      <Icon className="size-4" aria-hidden="true" />
      {item.title}
    </Link>
  );
}

function NavGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  // On refresh every group starts collapsed except the one holding the current
  // page, so the sidebar unextends but you still see where you are. State is
  // not persisted: the next refresh re-applies the same rule.
  const [open, setOpen] = useState(() =>
    group.items.some((item) => isActive(item.href, pathname)),
  );
  const toggle = useCallback(() => setOpen((value) => !value), []);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {group.label}
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open ? "rotate-90" : "rotate-0",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pt-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}