"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Library,
  Megaphone,
  Search,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchGroup, SearchHit } from "@/services/search";

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  schools: Building2,
  users: Users,
  students: GraduationCap,
  teachers: Users,
  parents: UsersRound,
  children: UsersRound,
  classes: Library,
  subjects: BookOpen,
  courses: BookOpen,
  lessons: Library,
  assignments: ClipboardList,
  questions: HelpCircle,
  examSeries: FileText,
  announcements: Megaphone,
};

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchGroup[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error("Search request failed");
  const payload = (await res.json()) as { groups: SearchGroup[] };
  return payload.groups ?? [];
}

export function SearchDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  const openDialog = useCallback(() => {
    setQuery("");
    setGroups([]);
    setActiveIndex(-1);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openDialog();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDialog]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchSearch(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setGroups(result);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  function moveSelection(delta: number) {
    if (flat.length === 0) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return 0;
      if (next >= flat.length) return flat.length - 1;
      return next;
    });
  }

  useEffect(() => {
    const activeHit = flat[activeIndex];
    if (!activeHit || !listRef.current) return;
    const element = listRef.current.querySelector<HTMLElement>(`[data-search-hit="${activeIndex}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flat]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.key === "Enter") {
      const hit = flat[activeIndex];
      if (hit) router.push(hit.href);
    } else if (event.key === "Escape") {
      closeDialog();
    }
  }

  const canSearch = query.trim().length >= 2;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={openDialog}
        aria-label="Search"
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground"
      >
        <Search className="size-5" aria-hidden="true" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search courses, lessons, students, questions…"
                aria-label="Search"
                className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
                ESC
              </kbd>
              <Button variant="ghost" size="icon-sm" onClick={closeDialog} aria-label="Close search">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div
              ref={listRef}
              className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
            >
              {!canSearch ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Type at least two characters to search.
                </p>
              ) : loading ? (
                <div className="grid gap-4 px-3 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : groups.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => {
                    const Icon = GROUP_ICONS[group.key] ?? Search;
                    const first = flat.indexOf(group.hits[0]);
                    return (
                      <div key={group.key} role="presentation">
                        <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Icon className="size-3.5" aria-hidden="true" />
                          {group.label}
                        </p>
                        <ul className="grid">
                          {group.hits.map((hit, offset) => {
                            const index = first + offset;
                            const active = index === activeIndex;
                            return (
                              <li key={hit.id} data-search-hit={index}>
                                <Link
                                  href={hit.href}
                                  onClick={closeDialog}
                                  className={cn(
                                    "flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2 text-sm",
                                    active
                                      ? "bg-muted text-foreground"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                  )}
                                >
                                  <span className="truncate font-medium text-foreground">
                                    {hit.title}
                                  </span>
                                  {hit.subtitle && (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {hit.subtitle}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {flat.length > 0 && (
              <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1">↑</kbd>
                  <kbd className="rounded border bg-muted px-1">↓</kbd>
                  navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border bg-muted px-1">↵</kbd>
                  open
                </span>
                <span className="ml-auto">
                  {flat.length} {flat.length === 1 ? "result" : "results"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export type { SearchHit };