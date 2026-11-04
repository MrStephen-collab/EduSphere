"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { siteConfig } from "@/config/site";

/**
 * The bottom of a sidebar: help, then the signed-in account.
 *
 * Shared by the desktop rail and the mobile drawer, so the avatar is present and
 * tappable wherever the navigation is. On the phone the drawer passes
 * `onNavigate` to dismiss itself once a destination is chosen.
 */
export function SidebarAccount({
  collapsed = false,
  avatarUrl,
  initials,
  userName,
  roleLabel,
  schoolName,
  profileHref,
  onNavigate,
  className,
}: {
  collapsed?: boolean;
  avatarUrl?: string | null;
  initials: string;
  userName?: string;
  roleLabel?: string;
  schoolName?: string;
  profileHref?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-t", collapsed ? "p-2" : "p-3", className)}>
      <a
        href={`mailto:${siteConfig.supportEmail}`}
        title="Help & support"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed ? "justify-center py-2" : "px-3 py-2",
        )}
      >
        <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed && "Help & support"}
      </a>

      <Link
        href={profileHref ?? "/dashboard"}
        title={userName ?? "Account"}
        onClick={onNavigate}
        className={cn(
          "mt-1 flex items-center gap-3 rounded-lg transition-colors hover:bg-muted",
          collapsed ? "justify-center py-2" : "p-2",
        )}
      >
        <Avatar className="size-8 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {userName ?? "Account"}
            </span>
            {(roleLabel || schoolName) && (
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel ?? schoolName}
              </span>
            )}
          </span>
        )}
      </Link>
    </div>
  );
}
