"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import type { NavItem } from "@/config/nav";
import { navIcons } from "@/config/nav";

export function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className="grid shrink-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      aria-label="Bottom navigation"
    >
      {items.map((item) => {
        const Icon = navIcons[item.icon];
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-13 flex-col items-center justify-center gap-0.5 py-2 text-[0.7rem] font-medium transition-colors active:opacity-70",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-16 items-center justify-center rounded-full transition-colors",
                active && "bg-primary/10",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}