import Link from "next/link";
import { BookOpen, ClipboardList, FileText, BarChart3 } from "lucide-react";
import { EduSphereLogo, LogoMark } from "@/components/brand/logo";

const HIGHLIGHTS = [
  { icon: BookOpen, label: "Digital learning & materials" },
  { icon: ClipboardList, label: "Assignments & submissions" },
  { icon: FileText, label: "CBT and online examinations" },
  { icon: BarChart3, label: "Results & progress tracking" },
];

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="bg-brand-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/3 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-cyan-300/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-1/4 size-64 rounded-full bg-indigo-400/20 blur-3xl"
        />

        <Link href="/" className="relative z-10 inline-flex">
          <EduSphereLogo variant="standard" theme="dark" size="md" />
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Welcome to EduSphere
          </h2>
          <p className="mt-3 text-base text-white/80">
            Sign in to access your learning portal and explore a world of knowledge.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-white/70">
          Your School. Your Learning Sphere.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center bg-background px-4 py-8 sm:justify-center sm:py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center lg:hidden"
          >
            <EduSphereLogo variant="standard" size="lg" className="shrink-0" />
          </Link>

          <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 flex items-center gap-2">
              <span className="lg:hidden">
                <LogoMark size="sm" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
            {children}
          </div>

          {footer && (
            <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
