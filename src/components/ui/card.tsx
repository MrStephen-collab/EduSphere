import * as React from "react"
import { cn } from "cn"

/**
 * The card colour palette.
 *
 * Each tone reuses the brand's existing accent colours (indigo, blue, cyan,
 * teal, violet, amber, rose, emerald, sky) rather than inventing new ones, so a
 * coloured card still reads as EduSphere. A toned card gets five things: a
 * saturated gradient wash, a coloured glow behind the header, a matching border,
 * a slim gradient rail along the top and an accent-coloured title.
 *
 * Light mode carries the stronger treatment — on white a faint tint disappears,
 * so the daylight values sit near 30% while the dark theme, which already reads
 * clearly, keeps its softer 12%. Muted text is darkened inside a toned card so
 * contrast stays legible on the tinted surface.
 *
 * `neutral` is the plain card and stays the default, so a card only grows colour
 * when a page asks for it.
 */
export type CardTone =
  | "neutral"
  | "indigo"
  | "blue"
  | "cyan"
  | "teal"
  | "violet"
  | "fuchsia"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"

type ToneStyle = {
  /** Gradient wash over the card surface. */
  surface: string
  /** Coloured glow that sits behind the header. */
  glow: string
  /** Border tint that matches the wash. */
  border: string
  /** Gradient rail along the top edge. */
  rail: string
  /** Title colour; 700-level in daylight, 300-level at night. */
  accent: string
}

const toneStyles: Record<Exclude<CardTone, "neutral">, ToneStyle> = {
  indigo: {
    surface:
      "from-indigo-500/[0.30] via-indigo-500/[0.12] to-card dark:from-indigo-500/[0.12] dark:via-indigo-500/[0.04]",
    glow: "after:from-indigo-500/[0.20] dark:after:from-indigo-500/[0.10]",
    border: "border-indigo-500/55 dark:border-indigo-500/25",
    rail: "before:from-indigo-500 before:to-violet-500",
    accent: "[--card-accent:#3730a3] dark:[--card-accent:#a5b4fc]",
  },
  blue: {
    surface:
      "from-blue-500/[0.30] via-blue-500/[0.12] to-card dark:from-blue-500/[0.12] dark:via-blue-500/[0.04]",
    glow: "after:from-blue-500/[0.20] dark:after:from-blue-500/[0.10]",
    border: "border-blue-500/55 dark:border-blue-500/25",
    rail: "before:from-blue-500 before:to-indigo-500",
    accent: "[--card-accent:#1e40af] dark:[--card-accent:#93c5fd]",
  },
  cyan: {
    surface:
      "from-cyan-500/[0.30] via-cyan-500/[0.12] to-card dark:from-cyan-500/[0.12] dark:via-cyan-500/[0.04]",
    glow: "after:from-cyan-500/[0.20] dark:after:from-cyan-500/[0.10]",
    border: "border-cyan-500/55 dark:border-cyan-500/25",
    rail: "before:from-cyan-500 before:to-sky-500",
    accent: "[--card-accent:#0e7490] dark:[--card-accent:#67e8f9]",
  },
  teal: {
    surface:
      "from-teal-500/[0.30] via-teal-500/[0.12] to-card dark:from-teal-500/[0.12] dark:via-teal-500/[0.04]",
    glow: "after:from-teal-500/[0.20] dark:after:from-teal-500/[0.10]",
    border: "border-teal-500/55 dark:border-teal-500/25",
    rail: "before:from-teal-500 before:to-emerald-500",
    accent: "[--card-accent:#0f766e] dark:[--card-accent:#5eead4]",
  },
  violet: {
    surface:
      "from-violet-500/[0.30] via-violet-500/[0.12] to-card dark:from-violet-500/[0.12] dark:via-violet-500/[0.04]",
    glow: "after:from-violet-500/[0.20] dark:after:from-violet-500/[0.10]",
    border: "border-violet-500/55 dark:border-violet-500/25",
    rail: "before:from-violet-500 before:to-fuchsia-500",
    accent: "[--card-accent:#6d28d9] dark:[--card-accent:#c4b5fd]",
  },
  fuchsia: {
    surface:
      "from-fuchsia-500/[0.30] via-fuchsia-500/[0.12] to-card dark:from-fuchsia-500/[0.12] dark:via-fuchsia-500/[0.04]",
    glow: "after:from-fuchsia-500/[0.20] dark:after:from-fuchsia-500/[0.10]",
    border: "border-fuchsia-500/55 dark:border-fuchsia-500/25",
    rail: "before:from-fuchsia-500 before:to-purple-500",
    accent: "[--card-accent:#a21caf] dark:[--card-accent:#f0abfc]",
  },
  sky: {
    surface:
      "from-sky-500/[0.30] via-sky-500/[0.12] to-card dark:from-sky-500/[0.12] dark:via-sky-500/[0.04]",
    glow: "after:from-sky-500/[0.20] dark:after:from-sky-500/[0.10]",
    border: "border-sky-500/55 dark:border-sky-500/25",
    rail: "before:from-sky-500 before:to-blue-500",
    accent: "[--card-accent:#0369a1] dark:[--card-accent:#7dd3fc]",
  },
  emerald: {
    surface:
      "from-emerald-500/[0.30] via-emerald-500/[0.12] to-card dark:from-emerald-500/[0.12] dark:via-emerald-500/[0.04]",
    glow: "after:from-emerald-500/[0.20] dark:after:from-emerald-500/[0.10]",
    border: "border-emerald-500/55 dark:border-emerald-500/25",
    rail: "before:from-emerald-500 before:to-teal-500",
    accent: "[--card-accent:#047857] dark:[--card-accent:#6ee7b7]",
  },
  amber: {
    surface:
      "from-amber-500/[0.34] via-amber-500/[0.14] to-card dark:from-amber-500/[0.14] dark:via-amber-500/[0.05]",
    glow: "after:from-amber-500/[0.24] dark:after:from-amber-500/[0.12]",
    border: "border-amber-500/60 dark:border-amber-500/30",
    rail: "before:from-amber-500 before:to-orange-500",
    accent: "[--card-accent:#92400e] dark:[--card-accent:#fcd34d]",
  },
  rose: {
    surface:
      "from-rose-500/[0.30] via-rose-500/[0.12] to-card dark:from-rose-500/[0.12] dark:via-rose-500/[0.04]",
    glow: "after:from-rose-500/[0.20] dark:after:from-rose-500/[0.10]",
    border: "border-rose-500/55 dark:border-rose-500/25",
    rail: "before:from-rose-500 before:to-pink-500",
    accent: "[--card-accent:#9f1239] dark:[--card-accent:#fda4af]",
  },
}

function Card({
  className,
  size = "default",
  tone = "neutral",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /** Optional colour wash. Defaults to the plain neutral card. */
  tone?: CardTone
}) {
  const style = tone === "neutral" ? null : toneStyles[tone]

  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(
        "group/card relative isolate flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-card [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        // A slim rail along the top edge is the card's signature: a toned card
        // paints it in its own accent, an untinted one in the brand's indigo →
        // blue → cyan. It never prints and never takes pointer events. The
        // matching `after` layer is a soft glow under the header, painted behind
        // the content so text stays crisp.
        "bg-gradient-to-br before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:-z-10 after:h-24 after:bg-gradient-to-b after:to-transparent after:content-[''] print:before:hidden print:after:hidden",
        style
          ? cn(
              style.surface,
              style.glow,
              style.border,
              style.rail,
              style.accent,
              // Darken secondary text on the tinted surface so it keeps its
              // contrast; the night value stays the theme default.
              "[--muted-foreground:#475569] dark:[--muted-foreground:#94a3b8]",
            )
          : // Every card carries a wash of brand indigo, so the surface is never
            // a flat white slab. Daylight gets the stronger tint; the dark theme
            // keeps its softer one.
            "from-primary/[0.10] via-transparent to-transparent dark:from-primary/[0.04] after:from-primary/[0.07] dark:after:from-primary/[0.04] before:from-primary/70 before:via-blue-500/55 before:to-cyan-500/55 dark:before:from-primary/35 dark:before:via-blue-500/25 dark:before:to-cyan-500/25",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        // Toned cards set --card-accent on the root, which inherits down here;
        // plain cards fall back to the normal card foreground.
        "text-[color:var(--card-accent,inherit)]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
