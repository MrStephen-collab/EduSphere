"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { PlatformUser } from "@/services/platform";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClientUsersTable({
  users,
  roleLabels,
}: {
  users: PlatformUser[];
  roleLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      for (const m of u.memberships) {
        const label = roleLabels[m.role] ?? m.role;
        const key = label.toLowerCase();
        if (![...set].includes(key + "|" + m.role)) set.add(`${label}|${m.role}`);
      }
    }
    return [...set].map((entry) => {
      const [label, role] = entry.split("|");
      return { label, role };
    });
  }, [users, roleLabels]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQuery =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q);
      const matchesRole =
        roleFilter === "all" ||
        u.memberships.some((m) => (roleLabels[m.role] ?? m.role) === roleFilter);
      return matchesQuery && matchesRole;
    });
  }, [users, query, roleFilter, roleLabels]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone…"
            aria-label="Search users"
          />
        </div>
        <select
          aria-label="Filter by role"
          className="h-9 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r.role} value={r.label}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pr-3 pl-3 font-medium">User</th>
              <th className="py-2.5 pr-3 font-medium">Email</th>
              <th className="py-2.5 pr-3 font-medium">Memberships</th>
              <th className="py-2.5 pr-3 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 pl-3">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {initials(u.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {u.email ?? (u.phone ? `+${u.phone}` : "—")}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {u.memberships.length === 0 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          No school memberships
                        </span>
                      ) : (
                        u.memberships.slice(0, 3).map((m, i) => (
                          <span
                            key={`${u.id}-${m.schoolId}-${m.role}-${i}`}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            title={m.schoolName}
                          >
                            {m.schoolName} · {roleLabels[m.role] ?? m.role}
                          </span>
                        ))
                      )}
                      {u.memberships.length > 3 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{u.memberships.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}