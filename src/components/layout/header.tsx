"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, UserRound, Bell } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchDialog } from "@/components/search/search-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EduSphereLogo } from "@/components/brand/logo";
import { logoutAction } from "@/lib/auth/actions";
import type { NavSection } from "@/config/nav";
import { SidebarNav } from "./sidebar-nav";

export function Header({
  sections,
  title,
  badge,
  schoolName,
  userName,
  userEmail,
  avatarUrl,
  notificationUnread,
  profileHref,
}: {
  sections: NavSection[];
  title: string;
  badge?: string;
  schoolName?: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  notificationUnread?: React.ReactNode;
  profileHref?: string;
}) {
  const [open, setOpen] = useState(false);

  const initials = (userName ?? userEmail ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Open menu"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="flex h-16 flex-row items-center gap-3 border-b px-5 text-left">
            <EduSphereLogo variant="icon" size="md" className="shrink-0" />
            <SheetTitle>EduSphere</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SidebarNav sections={sections} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-base font-semibold md:text-lg">{title}</h1>
        {badge && <Badge variant="secondary" className="hidden sm:inline-flex">{badge}</Badge>}
      </div>

      {schoolName && (
        <span className="hidden truncate text-sm text-muted-foreground md:inline">
          {schoolName}
        </span>
      )}

      <SearchDialog />

      {notificationUnread !== undefined && (
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-5" aria-hidden="true" />
          {notificationUnread}
        </Link>
      )}

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={cn(
                "flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-muted",
              )}
              aria-label="Account menu"
            />
          }
        >
          <Avatar className="size-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{userName ?? "Account"}</span>
              {userEmail && <span className="text-xs text-muted-foreground">{userEmail}</span>}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={profileHref ?? "/dashboard"} />}>
            <UserRound className="mr-2 size-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await logoutAction();
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}