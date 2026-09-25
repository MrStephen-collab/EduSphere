import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { siteConfig } from "@/config/site";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/#features" className="hover:text-foreground">Features</Link>
            <Link href="/#how-it-works" className="hover:text-foreground">How it works</Link>
            <Link href="/#pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/about" className="hover:text-foreground">About</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" render={<Link href="/auth/login" />}>
              Sign in
            </Button>
            <Button size="sm" render={<Link href="/auth/register" />} className="hidden sm:inline-flex">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4" aria-hidden="true" />
            <span>{siteConfig.name} — Better schools through technology.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}