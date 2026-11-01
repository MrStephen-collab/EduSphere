import * as React from "react"
import { cn } from "cn"

/**
 * The card colour palette.
 *
 * Each tone reuses the brand's existing accent colours (indigo, blue, cyan,
 * teal, violet, amber, rose, emerald, sky) rather than inventing new ones, so a
 * coloured card still reads as EduSphere. A toned card gets three things: a soft
 * gradient wash, a matching border tint and a slim gradient rail along the top.
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
  /** Border tint that matches the wash. */
  border: string
  /** Gradient rail along the top edge. */
  rail: string
}

const toneStyles: Record<Exclude<CardTone, "neutral">, ToneStyle> = {
  indigo: {
    surface: "bg-gradient-to-br from-indigo-500/[0.12] via-indigo-500/[0.04] to-card",
    border: "border-indigo-500/25",
    rail: "before:from-indigo-500 before:to-violet-500",
  },
  blue: {
    surface: "bg-gradient-to-br from-blue-500/[0.12] via-blue-500/[0.04] to-card",
    border: "border-blue-500/25",
    rail: "before:from-blue-500 before:to-indigo-500",
  },
  cyan: {
    surface: "bg-gradient-to-br from-cyan-500/[0.12] via-cyan-500/[0.04] to-card",
    border: "border-cyan-500/25",
    rail: "before:from-cyan-500 before:to-sky-500",
  },
  teal: {
    surface: "bg-gradient-to-br from-teal-500/[0.12] via-teal-500/[0.04] to-card",
    border: "border-teal-500/25",
    rail: "before:from-teal-500 before:to-emerald-500",
  },
  violet: {
    surface: "bg-gradient-to-br from-violet-500/[0.12] via-violet-500/[0.04] to-card",
    border: "border-violet-500/25",
    rail: "before:from-violet-500 before:to-fuchsia-500",
  },
  fuchsia: {
    surface: "bg-gradient-to-br from-fuchsia-500/[0.12] via-fuchsia-500/[0.04] to-card",
    border: "border-fuchsia-500/25",
    rail: "before:from-fuchsia-500 before:to-purple-500",
  },
  sky: {
    surface: "bg-gradient-to-br from-sky-500/[0.12] via-sky-500/[0.04] to-card",
    border: "border-sky-500/25",
    rail: "before:from-sky-500 before:to-blue-500",
  },
  emerald: {
    surface: "bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-card",
    border: "border-emerald-500/25",
    rail: "before:from-emerald-500 before:to-teal-500",
  },
  amber: {
    surface: "bg-gradient-to-br from-amber-500/[0.14] via-amber-500/[0.05] to-card",
    border: "border-amber-500/30",
    rail: "before:from-amber-500 before:to-orange-500",
  },
  rose: {
    surface: "bg-gradient-to-br from-rose-500/[0.12] via-rose-500/[0.04] to-card",
    border: "border-rose-500/25",
    rail: "before:from-rose-500 before:to-pink-500",
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
        "group/card relative flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-card [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        // A slim rail along the top edge is the card's signature: a toned card
        // paints it in its own accent, an untinted one in the brand's indigo →
        // blue → cyan. It never prints and never takes pointer events.
        "bg-gradient-to-br before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:content-[''] print:before:hidden",
        style
          ? cn(style.surface, style.border, style.rail)
          : // Every card carries a whisper of brand indigo, so the surface is
            // never a flat white slab.
            "from-primary/[0.04] via-transparent to-transparent before:from-primary/35 before:via-blue-500/25 before:to-cyan-500/25",
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
