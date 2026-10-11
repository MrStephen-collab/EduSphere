import type { Metadata } from "next";
import { GraduationCap, Users, Wallet, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EduSphereLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false, follow: false },
};

const semanticSwatches = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
  { name: "soft-indigo", className: "bg-soft-indigo" },
  { name: "soft-blue", className: "bg-soft-blue" },
  { name: "soft-teal", className: "bg-soft-teal" },
  { name: "primary (indigo)", className: "bg-primary" },
  { name: "blue", className: "bg-blue" },
  { name: "cyan", className: "bg-cyan" },
  { name: "teal", className: "bg-teal" },
  { name: "violet", className: "bg-violet" },
  { name: "amber", className: "bg-gold" },
  { name: "orange", className: "bg-orange" },
  { name: "success", className: "bg-success" },
  { name: "destructive", className: "bg-destructive" },
];

const brandScale = [
  "bg-brand-50",
  "bg-brand-100",
  "bg-brand-200",
  "bg-brand-300",
  "bg-brand-400",
  "bg-brand-500",
  "bg-brand-600",
  "bg-brand-700",
  "bg-brand-800",
  "bg-brand-900",
  "bg-brand-950",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-5 backdrop-blur md:px-8">
        <EduSphereLogo variant="standard" size="sm" />
        <div className="flex items-center gap-3">
          <Badge variant="gold">Foundations</Badge>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-5 py-10 md:px-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EduSphere style guide</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The new foundations: blue and gold brand, dark-first, modern SaaS
            surfaces. This page previews the tokens and primitives before we roll
            them across the app.
          </p>
        </div>

        <Section
          title="Colour tokens"
          description="Semantic colours that drive every surface and action. Switch the theme (top right) to see both."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {semanticSwatches.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-2">
                <div
                  className={`h-16 rounded-lg border border-border ${swatch.className}`}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {swatch.name}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              brand indigo scale
            </span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {brandScale.map((cls) => (
                <div key={cls} className={`h-12 flex-1 ${cls}`} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              brand gradient (selective)
            </span>
            <div className="bg-brand-gradient h-16 rounded-lg" />
          </div>
        </Section>

        <Section title="Typography" description="Inter, tight tracking on headings.">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-card">
            <p className="text-3xl font-bold tracking-tight">Display / 3xl bold</p>
            <p className="text-2xl font-semibold tracking-tight">Heading / 2xl semibold</p>
            <p className="text-lg font-semibold">Subheading / lg semibold</p>
            <p className="text-base">Body / base regular — the quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-muted-foreground">
              Muted / sm — supporting text and descriptions.
            </p>
            <p className="font-mono text-sm">Mono / ADM-00A1B2C3</p>
          </div>
        </Section>

        <Section title="Buttons" description="Primary actions, secondary, ghost and destructive.">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Example icon button">
                <Sparkles />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        <Section title="Badges" description="Status and category chips.">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-card">
            <Badge>Default</Badge>
            <Badge variant="brand">Brand</Badge>
            <Badge variant="blue">Blue</Badge>
            <Badge variant="cyan">Cyan</Badge>
            <Badge variant="teal">Teal</Badge>
            <Badge variant="violet">Violet</Badge>
            <Badge variant="amber">Amber</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-name">Student name</Label>
              <Input id="sg-name" placeholder="e.g. Ada Obi" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-email">Guardian email</Label>
              <Input id="sg-email" type="email" placeholder="parent@example.com" />
            </div>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Term report card</CardTitle>
                <CardDescription>JSS 3 · First term</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Cards use a hairline border and a soft, theme-aware shadow instead
                of a hard ring.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fee statement</CardTitle>
                <CardDescription>Outstanding ₦42,500</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm">Pay now</Button>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Stat cards & empty states">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="Students" value="1,248" icon={Users} tone="sky" index={0} />
            <StatCard title="Teachers" value="86" icon={GraduationCap} tone="indigo" index={1} />
            <StatCard title="Fees collected" value="₦8.2M" icon={Wallet} tone="emerald" index={2} />
            <StatCard title="Courses" value="42" icon={BookOpen} tone="amber" index={3} />
          </div>
          <EmptyState
            icon={Sparkles}
            title="Nothing here yet"
            description="Empty states keep the calm, spacious feel with a dashed surface and a single clear action."
            actionLabel="Add the first item"
            actionHref="#top"
          />
        </Section>
      </div>
    </div>
  );
}
