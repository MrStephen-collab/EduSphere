import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Check your internet connection and try again. Some previously viewed
        lessons and pages may still be available.
      </p>
      <Button className="mt-8" render={<Link href="/" />}>
        Try again
      </Button>
      <p className="mt-8 text-xs text-muted-foreground">
        {siteConfig.name} &middot; learn anytime, anywhere
      </p>
    </main>
  );
}