import { Mail, ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "./initials";

export type ProfileTone = "amber" | "indigo" | "fuchsia" | "sky" | "emerald";

const toneStyles: Record<ProfileTone, { wash: string; avatar: string }> = {
  amber: {
    wash: "from-amber-500/15 via-amber-500/5 to-transparent",
    avatar: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
  indigo: {
    wash: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    avatar: "bg-gradient-to-br from-indigo-500 to-violet-600",
  },
  fuchsia: {
    wash: "from-fuchsia-500/15 via-fuchsia-500/5 to-transparent",
    avatar: "bg-gradient-to-br from-fuchsia-500 to-purple-600",
  },
  sky: {
    wash: "from-sky-500/15 via-sky-500/5 to-transparent",
    avatar: "bg-gradient-to-br from-sky-500 to-blue-600",
  },
  emerald: {
    wash: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    avatar: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
};

export function ProfileIdentityCard({
  name,
  subtitle,
  roleLabel,
  email,
  avatarUrl,
  tone = "indigo",
}: {
  name: string;
  subtitle?: string;
  roleLabel?: string;
  email?: string;
  avatarUrl?: string | null;
  tone?: ProfileTone;
}) {
  const styles = toneStyles[tone];

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          styles.wash,
        )}
      />
      <CardContent className="relative grid place-items-center gap-3 py-6">
        <Avatar className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback
            className={cn("text-lg text-white", styles.avatar)}
          >
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid place-items-center gap-0.5 text-center">
          <p className="font-semibold">{name}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {roleLabel && (
          <Badge variant="secondary">
            <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
            {roleLabel}
          </Badge>
        )}
        {email && (
          <span className="flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="break-all">{email}</span>
          </span>
        )}
      </CardContent>
    </Card>
  );
}