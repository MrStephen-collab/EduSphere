import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Talk to us</h1>
      <p className="mt-2 text-muted-foreground">
        Book a demo or ask us anything. We usually reply within one business day.
      </p>
      <div className="mt-8 flex flex-col items-start gap-4 rounded-xl border bg-card p-6">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mail className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium">Email us at</p>
          <p className="text-sm text-muted-foreground">{siteConfig.supportEmail}</p>
        </div>
        <Button render={<Link href={`mailto:${siteConfig.supportEmail}?subject=EduSphere%20Demo%20Request`} />}>
          Send us an email
        </Button>
      </div>
    </div>
  );
}